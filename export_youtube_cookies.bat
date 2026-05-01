@echo off
echo Exporting YouTube cookies from Chrome...
yt-dlp --cookies-from-browser chrome --cookies youtube_cookies.txt --skip-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
echo.
echo Done! Check youtube_cookies.txt file
pause
