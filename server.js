const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/downloads', express.static('downloads'));

// Store active downloads with their progress
const activeDownloads = new Map();

// Create downloads folder
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
fs.mkdir(DOWNLOADS_DIR, { recursive: true }).catch(console.error);

// SSE endpoint for real-time progress
app.get('/api/progress/:downloadId', (req, res) => {
    const { downloadId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', downloadId })}\n\n`);

    // Store the response object for this download
    if (!activeDownloads.has(downloadId)) {
        activeDownloads.set(downloadId, { clients: [] });
    }
    activeDownloads.get(downloadId).clients.push(res);

    // Clean up on client disconnect
    req.on('close', () => {
        const download = activeDownloads.get(downloadId);
        if (download) {
            download.clients = download.clients.filter(client => client !== res);
            if (download.clients.length === 0) {
                activeDownloads.delete(downloadId);
            }
        }
    });
});

// Helper function to send progress updates
function sendProgress(downloadId, data) {
    const download = activeDownloads.get(downloadId);
    if (download && download.clients) {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        download.clients.forEach(client => {
            try {
                client.write(message);
            } catch (error) {
                console.error('Error sending progress:', error);
            }
        });
    }
}

// Main download endpoint
app.post('/api/download', async (req, res) => {
    try {
        const { url } = req.body;
        const downloadId = Date.now().toString();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 New download request');
        console.log('📝 URL:', url);
        console.log('🆔 Download ID:', downloadId);

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'Please enter a video URL'
            });
        }

        const platform = detectPlatform(url);
        console.log('🎯 Platform detected:', platform);

        if (!platform) {
            return res.status(400).json({
                success: false,
                error: 'Platform not supported. Supported: TikTok, Instagram, YouTube, Facebook'
            });
        }

        // Return download ID immediately
        res.json({
            success: true,
            downloadId: downloadId,
            message: 'Download started'
        });

        // Start download in background with progress tracking
        downloadWithProgress(url, platform, downloadId);

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'An error occurred'
        });
    }
});

// Download function with real-time progress tracking
async function downloadWithProgress(url, platform, downloadId) {
    const filename = `${platform}_${downloadId}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, filename);

    try {
        sendProgress(downloadId, { type: 'status', message: 'Starting download...', progress: 0 });

        // Build yt-dlp command
        let args = ['--newline', '--no-warnings', '--no-playlist'];

        if (platform === 'youtube') {
            // Download best single file format (no merge needed)
            args.push('-f', 'best[ext=mp4]/best');
        } else if (platform === 'instagram') {
            const cookiesPath = path.join(__dirname, 'cookies.txt');
            try {
                await fs.access(cookiesPath);
                args.push('--cookies', cookiesPath);
            } catch {
                sendProgress(downloadId, { type: 'error', message: 'Instagram requires cookies.txt file' });
                return;
            }
        } else if (platform === 'facebook') {
            const fbCookies = 'D:\\Vitro\\www.facebook.com_cookies.txt';
            try {
                await fs.access(fbCookies);
                args.push('--cookies', fbCookies);
            } catch {
                sendProgress(downloadId, { type: 'error', message: 'Facebook requires cookies file' });
                return;
            }
        }

        args.push('-o', outputPath, url);

        console.log(`🔧 Command: yt-dlp ${args.join(' ')}`);

        // Spawn yt-dlp process
        const proc = spawn('yt-dlp', args, { shell: true });

        let lastProgress = 0;

        proc.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('yt-dlp:', output);

            // Parse progress: [download]  45.2% of 10.50MiB at 1.23MiB/s ETA 00:05
            const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
            if (progressMatch) {
                const progress = parseFloat(progressMatch[1]);
                if (progress > lastProgress) {
                    lastProgress = progress;
                    sendProgress(downloadId, {
                        type: 'progress',
                        progress: Math.min(progress, 99),
                        message: `Downloading... ${progress.toFixed(1)}%`
                    });
                }
            }

            if (output.includes('[Merger]') || output.includes('Merging')) {
                sendProgress(downloadId, {
                    type: 'progress',
                    progress: 95,
                    message: 'Merging video and audio...'
                });
            }
        });

        proc.stderr.on('data', (data) => {
            console.error('yt-dlp error:', data.toString());
        });

        proc.on('close', async (code) => {
            if (code === 0) {
                try {
                    await fs.access(outputPath);
                    const stats = await fs.stat(outputPath);

                    if (stats.size > 0) {
                        console.log(`✅ Download complete: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                        sendProgress(downloadId, {
                            type: 'complete',
                            progress: 100,
                            message: 'Download complete!',
                            downloadUrl: `/downloads/${filename}`,
                            filename: filename
                        });
                    } else {
                        throw new Error('File is empty');
                    }
                } catch (error) {
                    sendProgress(downloadId, { type: 'error', message: 'Failed to save video' });
                }
            } else {
                sendProgress(downloadId, { type: 'error', message: 'Download failed' });
            }
        });

    } catch (error) {
        console.error('❌ Download error:', error);
        sendProgress(downloadId, { type: 'error', message: error.message || 'Download failed' });
    }
}

// Platform detection
function detectPlatform(url) {
    if (/tiktok\.com/.test(url)) return 'tiktok';
    if (/instagram\.com/.test(url)) return 'instagram';
    if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
    if (/facebook\.com|fb\.watch/.test(url)) return 'facebook';
    return null;
}

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📡 http://localhost:${PORT}\n`);
});
