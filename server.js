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
const IS_CLOUD_HOST = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RENDER ||
    (!HAS_LOCAL_WINDOWS_FFMPEG && process.platform !== 'win32')
);
const DEPLOY_VERSION = '2026-05-21-instagram-fix';
const YT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const YOUTUBE_CLIENTS = IS_CLOUD_HOST
    ? ['android,web', 'android', 'ios', 'web', 'mweb', 'tv_embedded']
    : ['android', 'web', 'ios'];
const YT_COOKIES_PATH = path.join(__dirname, 'youtube_cookies.txt');
const IG_COOKIES_PATH = path.join(__dirname, 'cookies.txt');
let youtubeCookiesReady = false;
let instagramCookiesReady = false;

async function initInstagramCookies() {
    const b64 = process.env.INSTAGRAM_COOKIES_BASE64;
    if (b64) {
        await fs.writeFile(IG_COOKIES_PATH, Buffer.from(b64, 'base64'));
        console.log('✓ Instagram cookies loaded from INSTAGRAM_COOKIES_BASE64');
    }
    instagramCookiesReady = await fileExists(IG_COOKIES_PATH);
    if (instagramCookiesReady) {
        const stats = await fs.stat(IG_COOKIES_PATH);
        console.log(`✓ Instagram cookies ready (${stats.size} bytes)`);
    } else if (IS_CLOUD_HOST) {
        console.warn('⚠ No cookies.txt — Instagram downloads will fail on cloud');
    }
}

async function initYoutubeCookies() {
    const b64 = process.env.YOUTUBE_COOKIES_BASE64;
    if (b64) {
        await fs.writeFile(YT_COOKIES_PATH, Buffer.from(b64, 'base64'));
        console.log('✓ YouTube cookies loaded from YOUTUBE_COOKIES_BASE64');
    }
    youtubeCookiesReady = await fileExists(YT_COOKIES_PATH);
    if (youtubeCookiesReady) {
        const stats = await fs.stat(YT_COOKIES_PATH);
        console.log(`✓ YouTube cookies ready (${stats.size} bytes)`);
    } else if (IS_CLOUD_HOST) {
        console.warn('⚠ No youtube_cookies.txt on cloud — some YouTube videos may fail');
    }
}

function normalizeYoutubeUrl(url) {
    const shorts = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/i);
    if (shorts) {
        return `https://www.youtube.com/watch?v=${shorts[1]}`;
    }
    return url;
}

fs.mkdir(DOWNLOADS_DIR, { recursive: true }).catch(console.error);
initYoutubeCookies().catch(console.error);
initInstagramCookies().catch(console.error);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        version: DEPLOY_VERSION,
        cloud: IS_CLOUD_HOST,
        youtubeCookies: youtubeCookiesReady,
        instagramCookies: instagramCookiesReady,
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

        let videoUrl = url;
        if (/youtube\.com|youtu\.be/i.test(url)) {
            videoUrl = normalizeYoutubeUrl(url);
            if (videoUrl !== url) {
                console.log('📝 Normalized YouTube URL:', videoUrl);
            }
        }

        const platform = detectPlatform(videoUrl);
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
        downloadWithProgress(videoUrl, platform, downloadId);

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'An error occurred'
        });
    }
});

function isYoutubeAuthError(text) {
    return /Sign in|cookies|authentication|not a bot/i.test(String(text || ''));
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function buildYtDlpArgs(url, platform, outputPath, options = {}) {
    const {
        useYoutubeCookies = false,
        cloudYoutubeMode = false,
        youtubeClient = 'android'
    } = options;
    const args = ['--newline', '--no-warnings', '--no-playlist'];

    if (FFMPEG_DIR) {
        args.push('--ffmpeg-location', FFMPEG_DIR);
    }

    if (platform === 'youtube') {
        args.push('--user-agent', YT_USER_AGENT);
        args.push('--extractor-args', `youtube:player_client=${youtubeClient}`);
        args.push('--skip-unavailable-fragments');
        args.push('--retries', '10');
        args.push('--fragment-retries', '10');
        args.push('--add-header', 'Referer:https://www.youtube.com/');

        if (IS_CLOUD_HOST) {
            args.push('--remote-components', 'ejs:github');
            args.push('--js-runtimes', `deno:/usr/local/bin/deno,node:${process.execPath}`);
        }

        if (useYoutubeCookies && (await fileExists(YT_COOKIES_PATH))) {
            const stats = await fs.stat(YT_COOKIES_PATH);
            console.log(`✓ Using YouTube cookies (${stats.size} bytes)`);
            args.push('--cookies', YT_COOKIES_PATH);
        }

        if (cloudYoutubeMode || IS_CLOUD_HOST) {
            args.push('-f', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best');
        } else {
            args.push('-f', 'best[ext=mp4][vcodec!=none][acodec!=none]/best[height<=720][vcodec!=none][acodec!=none]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best');
        }

        args.push('--merge-output-format', 'mp4');
    } else if (platform === 'instagram') {
        if (!(await fileExists(IG_COOKIES_PATH))) {
            throw new Error(
                IS_CLOUD_HOST
                    ? 'Instagram needs cookies on Railway. Set INSTAGRAM_COOKIES_BASE64 variable and redeploy.'
                    : 'Instagram needs cookies.txt. Run export-instagram-cookies.bat then restart the server.'
            );
        }
        const cookieText = await fs.readFile(IG_COOKIES_PATH, 'utf8');
        if (!/\bsessionid\b/i.test(cookieText)) {
            throw new Error(
                'Instagram cookies are incomplete (missing sessionid). Log in to Instagram in your browser, export cookies again, then restart.'
            );
        }
        args.push('--cookies', IG_COOKIES_PATH);
        args.push('-f', 'best[ext=mp4]/bestvideo+bestaudio/best');
        args.push('--merge-output-format', 'mp4');
    } else if (platform === 'facebook') {
        const fbCookies = path.join(__dirname, 'www.facebook.com_cookies.txt');
        if (!(await fileExists(fbCookies))) {
            throw new Error('Facebook requires cookies file');
        }
        args.push('--cookies', fbCookies);
        args.push('-f', 'best[ext=mp4][vcodec*=avc1][acodec!=none]/best[ext=mp4][vcodec!=none][acodec!=none]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best');
        args.push('--merge-output-format', 'mp4');
    }

    args.push('-o', outputPath, url);
    return args;
}

function runYtDlp(args, downloadId) {
    return new Promise((resolve) => {
        console.log(`🔧 Command: yt-dlp ${args.join(' ')}`);

        const proc = spawn('yt-dlp', args, { shell: false });
        let lastProgress = 0;
        let lastError = '';

        proc.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('yt-dlp:', output);

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
            console.error('yt-dlp stderr:', errorMsg);
        });

        proc.on('close', (code) => {
            console.log(`yt-dlp process exited with code: ${code}`);
            resolve({ code, lastError });
        });

        proc.on('error', (error) => {
            console.error('yt-dlp spawn error:', error);
            resolve({ code: 1, lastError: error.message });
        });
    });
}

async function finalizeDownload(outputPath, filename, platform, downloadId) {
    if (platform === 'instagram' || platform === 'facebook') {
        try {
            await ensureCompatibleMp4(outputPath, downloadId);
        } catch (err) {
            console.warn('Compatibility pass skipped, using original file:', err.message);
            const info = await getMediaInfo(outputPath);
            const hasVideo = info?.streams?.some((s) => s.codec_type === 'video');
            if (!hasVideo) {
                throw new Error('Downloaded file is not a valid video. Update Instagram cookies and try again.');
            }
        }
    }

    await fs.access(outputPath);
    const stats = await fs.stat(outputPath);

    if (stats.size <= 0) {
        throw new Error('File is empty');
    }

    console.log(`✅ Download complete: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    sendProgress(downloadId, {
        type: 'complete',
        progress: 100,
        message: 'Download complete!',
        downloadUrl: `/downloads/${filename}`,
        filename: filename
    });
}

function shouldRetryYoutube(errorText) {
    const text = String(errorText || '');
    return /Sign in|cookies|authentication|not a bot|403|429|confirm you|bot/i.test(text) ||
        /Requested format is not available|Unable to extract|player response/i.test(text);
}

async function runYoutubeDownload(url, outputPath, downloadId) {
    let lastResult = { code: 1, lastError: '' };
    const hasCookies = await fileExists(YT_COOKIES_PATH);

    for (let i = 0; i < YOUTUBE_CLIENTS.length; i++) {
        const client = YOUTUBE_CLIENTS[i];
        const useCookies = hasCookies;

        sendProgress(downloadId, {
            type: 'status',
            message: i === 0 ? 'Starting download...' : `Retrying (${client})...`,
            progress: 0
        });

        const args = await buildYtDlpArgs(url, 'youtube', outputPath, {
            youtubeClient: client,
            useYoutubeCookies: useCookies,
            cloudYoutubeMode: IS_CLOUD_HOST
        });

        lastResult = await runYtDlp(args, downloadId);
        if (lastResult.code === 0) {
            return lastResult;
        }

        console.log(`⚠ YouTube client "${client}" failed, exit ${lastResult.code}`);
        const fatal = /Video unavailable|Private video|This video is unavailable|age.restricted|copyright/i.test(lastResult.lastError);
        if (fatal) break;
        if (!shouldRetryYoutube(lastResult.lastError) && i >= YOUTUBE_CLIENTS.length - 1) {
            break;
        }
    }

    return lastResult;
}

// Download function with real-time progress tracking
async function downloadWithProgress(url, platform, downloadId) {
    const filename = `${platform}_${downloadId}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, filename);

    try {
        sendProgress(downloadId, { type: 'status', message: 'Starting download...', progress: 0 });

        let result;
        if (platform === 'youtube') {
            result = await runYoutubeDownload(url, outputPath, downloadId);
        } else {
            const args = await buildYtDlpArgs(url, platform, outputPath, {
                cloudYoutubeMode: IS_CLOUD_HOST
            });
            result = await runYtDlp(args, downloadId);
        }

        if (result.code === 0) {
            try {
                await finalizeDownload(outputPath, filename, platform, downloadId);
            } catch (error) {
                console.error('File check error:', error);
                sendProgress(downloadId, { type: 'error', message: error.message || 'Failed to save video' });
            }
            return;
        }

        console.error(`Download failed with exit code: ${result.code}`);
        sendProgress(downloadId, {
            type: 'error',
            message: getDownloadErrorMessage(result.lastError, result.code)
        });
    } catch (error) {
        console.error('❌ Download error:', error);
        sendProgress(downloadId, { type: 'error', message: error.message || 'Download failed' });
    }
}

function getDownloadErrorMessage(errorText, code) {
    const text = String(errorText || '').replace(/\s+/g, ' ').trim();

    if (/Instagram.*cookies|empty media response|not granting access|login required/i.test(text)) {
        return IS_CLOUD_HOST
            ? 'Instagram needs fresh cookies on Railway (INSTAGRAM_COOKIES_BASE64).'
            : 'Instagram needs fresh cookies. Run export-instagram-cookies.bat and restart the server.';
    }

    if (/ffmpeg|ffprobe/i.test(text) && /version|Copyright|configuration/i.test(text)) {
        return 'Video processing failed. Try again or update cookies for this platform.';
    }

    if (/ffmpeg|ffprobe/i.test(text)) {
        return 'ffmpeg is missing or not reachable. Restart the server and try again.';
    }

    if (/Sign in|cookies|authentication|not a bot|requires authentication/i.test(text)) {
        return IS_CLOUD_HOST
            ? 'YouTube blocked this video on the server. Redeploy Railway with fresh cookies, or try again in a minute.'
            : 'YouTube needs fresh cookies. Run export_youtube_cookies.bat then restart the server.';
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
        '-hide_banner',
        '-loglevel', 'error',
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
        '-hide_banner',
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
    const lines = String(errorText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const useful = lines.filter((l) =>
        !/^ffmpeg version/i.test(l) &&
        !/^ffprobe version/i.test(l) &&
        !/^Copyright/i.test(l) &&
        !/^built with/i.test(l) &&
        !/^configuration:/i.test(l) &&
        !/^libav/i.test(l)
    );
    const errLine = useful.find((l) => /error|invalid|failed|no such|denied/i.test(l)) || useful[useful.length - 1] || '';
    return errLine.replace(/\s+/g, ' ').trim().slice(0, 220);
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
    const lanIp = Object.values(require('os').networkInterfaces())
        .flat()
        .find((n) => n && n.family === 'IPv4' && !n.internal)?.address;

    console.log('\n========================================');
    console.log(`  Server running on port ${PORT}`);
    console.log('========================================');
    console.log('  This PC:     http://localhost:3001');
    console.log('               http://127.0.0.1:3001');
    if (lanIp) {
        console.log(`  Other device: http://${lanIp}:3001  (same Wi-Fi)`);
    }
    console.log('  Do NOT open 0.0.0.0 in the browser.');
    console.log(`  Version: ${DEPLOY_VERSION}`);
    console.log('========================================\n');
});
