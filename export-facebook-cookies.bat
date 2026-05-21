@echo off
echo Exporting Facebook cookies from browser...
echo Close Chrome/Edge completely first, then press any key...
pause >nul
yt-dlp --cookies-from-browser edge --cookies www.facebook.com_cookies.txt --skip-download "https://www.facebook.com/"
if errorlevel 1 (
  echo Edge failed, trying Chrome...
  yt-dlp --cookies-from-browser chrome --cookies www.facebook.com_cookies.txt --skip-download "https://www.facebook.com/"
)
echo.
if exist www.facebook.com_cookies.txt (
  echo Done! Restart the server: npm start
) else (
  echo FAILED. Use "Get cookies.txt LOCALLY" on facebook.com while logged in.
  echo Save as www.facebook.com_cookies.txt in this folder.
)
pause
