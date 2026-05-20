const express = require('express');
const cors = require('cors');
const path = require('path');
const fsSync = require('fs');
const fs = require('fs').promises;
const { spawn } = require('child_process');

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false
}));
app.use(express.json());
app.use(express.static(__dirname));
app.use('/downloads', express.static('downloads'));

// Store active downloads with their progress
const activeDownloads = new Map();

// Create downloads folder
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const LOCAL_FFMPEG_DIR = path.join(__dirname, 'ffmpeg-8.0.1-essentials_build', 'bin');
const LOCAL_FFMPEG_EXE = path.join(LOCAL_FFMPEG_DIR, 'ffmpeg.exe');
const LOCAL_FFPROBE_EXE = path.join(LOCAL_FFMPEG_DIR, 'ffprobe.exe');
const HAS_LOCAL_WINDOWS_FFMPEG =
    process.platform === 'win32' &&
    fsSync.existsSync(LOCAL_FFMPEG_EXE) &&
    fsSync.existsSync(LOCAL_FFPROBE_EXE);

// Windows local dev uses bundled ffmpeg; Linux hosts (Railway/Docker) use system binaries.
const FFMPEG_DIR = HAS_LOCAL_WINDOWS_FFMPEG ? LOCAL_FFMPEG_DIR : null;
const FFMPEG_PATH = HAS_LOCAL_WINDOWS_FFMPEG ? LOCAL_FFMPEG_EXE : 'ffmpeg';
const FFPROBE_PATH = HAS_LOCAL_WINDOWS_FFMPEG ? LOCAL_FFPROBE_EXE : 'ffprobe';
fs.mkdir(DOWNLOADS_DIR, { recursive: true }).catch(console.error);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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
        if (FFMPEG_DIR) {
            args.push('--ffmpeg-location', FFMPEG_DIR);
        }

        if (platform === 'youtube') {
            // Add YouTube cookies if available
            const ytCookies = path.join(__dirname, 'youtube_cookies.txt');
            try {
                await fs.access(ytCookies);
                const stats = await fs.stat(ytCookies);
                console.log(`✓ Found YouTube cookies file (${stats.size} bytes)`);
                args.push('--cookies', ytCookies);
            } catch (error) {
                console.log('⚠ No YouTube cookies found:', error.message);
            }
            // Prefer a ready-to-serve MP4 file, then fall back to mergeable MP4 streams.
            args.push('-f', 'best[ext=mp4][vcodec!=none][acodec!=none]/best[height<=720][vcodec!=none][acodec!=none]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best');
            args.push('--merge-output-format', 'mp4');
            // Add user agent to avoid bot detection
            args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        } else if (platform === 'instagram') {
            const cookiesPath = path.join(__dirname, 'cookies.txt');
            try {
                await fs.access(cookiesPath);
                args.push('--cookies', cookiesPath);
                args.push('--merge-output-format', 'mp4');
            } catch {
                sendProgress(downloadId, { type: 'error', message: 'Instagram requires cookies.txt file' });
                return;
            }
        } else if (platform === 'facebook') {
            const fbCookies = 'D:\\Vitro\\www.facebook.com_cookies.txt';
            try {
                await fs.access(fbCookies);
                args.push('--cookies', fbCookies);
                args.push('-f', 'best[ext=mp4][vcodec*=avc1][acodec!=none]/best[ext=mp4][vcodec!=none][acodec!=none]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best');
                args.push('--merge-output-format', 'mp4');
            } catch {
                sendProgress(downloadId, { type: 'error', message: 'Facebook requires cookies file' });
                return;
            }
        }

        args.push('-o', outputPath, url);

        console.log(`🔧 Command: yt-dlp ${args.join(' ')}`);

        // Spawn yt-dlp process
        const proc = spawn('yt-dlp', args, { shell: false });

        let lastProgress = 0;
        let lastError = '';
        let progressErrorSent = false;

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
            const errorMsg = data.toString();
            lastError += errorMsg;
            console.error('yt-dlp error:', errorMsg);
            
            // Send specific error messages
            if (errorMsg.includes('Sign in')) {
                progressErrorSent = true;
                sendProgress(downloadId, { 
                    type: 'error', 
                    message: 'YouTube requires authentication for this video' 
                });
            } else if (errorMsg.includes('Video unavailable')) {
                progressErrorSent = true;
                sendProgress(downloadId, { 
                    type: 'error', 
                    message: 'Video is unavailable or private' 
                });
            }
        });

        proc.on('close', async (code) => {
            console.log(`yt-dlp process exited with code: ${code}`);
            
            if (code === 0) {
                try {
                    if (platform === 'instagram' || platform === 'facebook') {
                        await ensureCompatibleMp4(outputPath, downloadId);
                    }

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
                    console.error('File check error:', error);
                    sendProgress(downloadId, { type: 'error', message: error.message || 'Failed to save video' });
                }
            } else {
                console.error(`Download failed with exit code: ${code}`);
                if (!progressErrorSent) {
                    sendProgress(downloadId, {
                        type: 'error',
                        message: getDownloadErrorMessage(lastError, code)
                    });
                }
            }
        });

    } catch (error) {
        console.error('❌ Download error:', error);
        sendProgress(downloadId, { type: 'error', message: error.message || 'Download failed' });
    }
}

function getDownloadErrorMessage(errorText, code) {
    const text = String(errorText || '').replace(/\s+/g, ' ').trim();

    if (/ffmpeg|ffprobe/i.test(text)) {
        return 'ffmpeg is missing or not reachable. The local ffmpeg path has been configured; restart the server and try again.';
    }

    if (/Sign in|cookies|authentication|not a bot/i.test(text)) {
        return 'YouTube needs fresh cookies for this video. Please update youtube_cookies.txt and try again.';
    }

    if (/Video unavailable|Private video|This video is unavailable/i.test(text)) {
        return 'Video is unavailable or private.';
    }

    if (/Requested format is not available/i.test(text)) {
        return 'Requested video format is not available. Try another video or update yt-dlp.';
    }

    return text ? text.slice(0, 220) : `Download failed (code: ${code})`;
}

async function ensureCompatibleMp4(filePath, downloadId) {
    const mediaInfo = await getMediaInfo(filePath);
    const videoStream = mediaInfo?.streams?.find((stream) => stream.codec_type === 'video');
    const audioStream = mediaInfo?.streams?.find((stream) => stream.codec_type === 'audio');
    const videoCodec = videoStream?.codec_name || '';
    const audioCodec = audioStream?.codec_name || '';

    if (!videoStream) {
        throw new Error('The downloaded file does not contain a playable video stream.');
    }

    if (videoCodec === 'h264' && (!audioStream || audioCodec === 'aac')) {
        return;
    }

    sendProgress(downloadId, {
        type: 'progress',
        progress: 96,
        message: 'Optimizing video compatibility...'
    });

    const tempPath = filePath.replace(/\.mp4$/i, '.compatible.mp4');
    const args = [
        '-y',
        '-i', filePath,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        tempPath
    ];

    const result = await runProcess(FFMPEG_PATH, args);
    if (result.code !== 0) {
        throw new Error(cleanProcessError(result.stderr) || 'Failed to optimize video compatibility');
    }

    await fs.unlink(filePath);
    await fs.rename(tempPath, filePath);
}

async function getMediaInfo(filePath) {
    const result = await runProcess(FFPROBE_PATH, [
        '-v', 'error',
        '-show_entries', 'stream=index,codec_type,codec_name,profile,width,height,r_frame_rate,avg_frame_rate,duration,nb_frames,pix_fmt',
        '-of', 'json',
        filePath
    ]);

    if (result.code !== 0) {
        throw new Error(cleanProcessError(result.stderr) || 'Failed to inspect downloaded video');
    }

    return JSON.parse(result.stdout || '{}');
}

function runProcess(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { shell: false });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
}

function cleanProcessError(errorText) {
    return String(errorText || '').replace(/\s+/g, ' ').trim().slice(0, 220);
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
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📡 http://${HOST}:${PORT}\n`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
