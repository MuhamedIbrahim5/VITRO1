# VITRO - Social Media Video Downloader

Download videos from TikTok, Instagram, YouTube, and Facebook without watermarks.

## 🌐 Live Demo

- **Firebase**: https://vitro-hosting-20260520.web.app
- **Local Server**: http://localhost:3001

## ✨ Features

- ✅ Download from TikTok, Instagram, YouTube, Facebook
- ✅ No watermarks
- ✅ 720p quality (optimized)
- ✅ Arabic & English support
- ✅ Mobile responsive

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Server
```bash
npm start
```

### 3. Open Browser
Visit: http://localhost:3001

## 📁 Project Structure

```
VITRO/
├── server.js           # Backend server (Node.js + Express)
├── app.js              # Frontend JavaScript
├── index.html          # Main HTML
├── style.css           # Styles
├── Dockerfile          # Docker configuration
├── package.json        # Dependencies
├── cookies.txt         # Instagram cookies
├── youtube_cookies.txt # YouTube cookies
├── www.facebook.com_cookies.txt # Facebook cookies
└── public/             # Static files for Firebase
```

## 🔧 Configuration

### Environment Variables
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (production/development)

### Cookies Setup
For Instagram/Facebook/YouTube downloads, you need valid cookies:

1. Install [Cookie-Editor](https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm) extension
2. Login to Instagram/Facebook/YouTube
3. Export cookies as "Netscape" format
4. Save as:
   - `cookies.txt` (Instagram)
   - `www.facebook.com_cookies.txt` (Facebook)
   - `youtube_cookies.txt` (YouTube)

## 📦 Deployment

### Firebase Hosting
```bash
firebase deploy --only hosting
```

### Docker
```bash
docker build -t vitro .
docker run -p 3001:3001 vitro
```

### ngrok (Public Access)
```bash
ngrok http 3001
```

## 🛠️ Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript
- **Downloader**: yt-dlp
- **Video Processing**: FFmpeg
- **Hosting**: Firebase, Docker

## 📝 Notes

- YouTube downloads require valid cookies due to bot detection
- TikTok works without authentication
- Instagram/Facebook need cookies for private content
- Free tier limitations apply to some platforms

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a PR.

## 📄 License

MIT License

---

Made with ❤️ by VITROAPPS
