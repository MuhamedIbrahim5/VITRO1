# Social Media Video Downloader

Download videos from TikTok, Instagram, YouTube, and Facebook without watermarks.

## Features

- ⚡ Fast & Free
- ✨ No Watermark
- 🔓 No Registration Required
- 🌐 Multi-language (English/Arabic)
- ⭐ User Reviews System

## Architecture

| Layer | Host | Role |
|-------|------|------|
| Frontend | Firebase / GitHub Pages | Static UI (`public/`) |
| Backend | Railway | API + yt-dlp (`server.js`) |

Production API: `https://vitro1-production-be78.up.railway.app`

## Deploy

```bash
# Sync root frontend -> public/ (Firebase + GitHub Pages)
npm run sync

# Firebase hosting
npm run deploy:firebase

# Railway: push to main, then Redeploy in Railway dashboard if /health has no "version" field
git push origin main

# Optional: fresh YouTube cookies for Railway
powershell -File scripts/export-railway-cookies.ps1
# Paste output into Railway variable YOUTUBE_COOKIES_BASE64, then Redeploy
```

## Local Development

```bash
npm install
npm start
```

Visit http://localhost:3001

## Requirements

- Node.js 18+
- yt-dlp (installed automatically in Docker)
- ffmpeg (installed automatically in Docker)

## Environment Variables

- `PORT` - Server port (default: 3001)

## License

MIT
