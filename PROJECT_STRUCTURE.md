# 📁 Project Structure

```
VITRO/
│
├── 📄 Core Files
│   ├── server.js               # Backend API (Express + yt-dlp)
│   ├── app.js                  # Frontend JavaScript
│   ├── index.html              # Main HTML page
│   └── style.css               # Styles
│
├── 🔧 Configuration
│   ├── package.json            # Dependencies & scripts
│   ├── Dockerfile              # Docker deployment
│   ├── firebase.json           # Firebase hosting config
│   └── .gitignore              # Git ignore rules
│
├── 🍪 Cookies (for authentication)
│   ├── cookies.txt             # Instagram cookies
│   ├── youtube_cookies.txt     # YouTube cookies
│   └── www.facebook.com_cookies.txt  # Facebook cookies
│
├── 📦 Folders
│   ├── public/                 # Firebase hosting files
│   │   ├── index.html
│   │   ├── app.js
│   │   └── style.css
│   │
│   ├── downloads/              # Temporary video downloads
│   ├── node_modules/           # NPM packages
│   └── ffmpeg-8.0.1.../        # FFmpeg binaries (Windows)
│
└── 📝 Documentation
    ├── README.md               # Main documentation
    └── PROJECT_STRUCTURE.md   # This file
```

---

## 🎯 Key Files Explained

### `server.js`
- Express server
- Handles download requests
- Manages yt-dlp process
- Serves SSE progress updates

### `app.js`
- Frontend logic
- API communication
- Language switching (AR/EN)
- Download UI & progress

### `Dockerfile`
- Node.js 18 Alpine
- Python + yt-dlp
- FFmpeg for video processing
- Deno for YouTube JS challenges

### Cookies Files
- Required for Instagram/Facebook/YouTube
- Format: Netscape HTTP Cookie File
- Must be updated regularly (expire after ~2 weeks)

---

## 🚀 Deployment Options

| Platform | Status | Notes |
|----------|--------|-------|
| **Local** | ✅ Active | Port 3001 |
| **ngrok** | ✅ Active | Public URL |
| **Firebase** | ✅ Active | Static hosting |
| **Railway** | ❌ Trial ended | Needs payment |
| **Render** | ❌ Not used | Needs payment |
| **Fly.io** | ❌ Not used | Needs payment |

---

## 📦 Dependencies

### Production
- `express` - Web server
- `cors` - CORS handling
- `yt-dlp` - Video downloader (Python)
- `ffmpeg` - Video processing

### Development
- `nodemon` - Auto-restart server

---

## 🔄 Workflow

1. User pastes video URL
2. Frontend sends POST to `/api/download`
3. Backend detects platform (TikTok/Instagram/YouTube/Facebook)
4. Spawns `yt-dlp` process with appropriate args
5. Streams progress via SSE
6. Returns download URL
7. User downloads video

---

## 🛡️ Security Notes

- Cookies contain sensitive auth tokens
- Never commit cookies to public repos
- `.gitignore` configured to exclude them
- Rotate cookies regularly
