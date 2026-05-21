@echo off
echo Exporting Instagram cookies from browser...
echo Close Chrome/Edge completely first, then press any key...
pause >nul
yt-dlp --cookies-from-browser edge --cookies cookies.txt --skip-download "https://www.instagram.com/"
if errorlevel 1 (
  echo Edge failed, trying Chrome...
  yt-dlp --cookies-from-browser chrome --cookies cookies.txt --skip-download "https://www.instagram.com/"
)
echo.
if exist cookies.txt (
  echo Done! cookies.txt saved. Restart the server.
) else (
  echo FAILED. Use browser extension "Get cookies.txt LOCALLY" on instagram.com
  echo Save as cookies.txt in this folder.
)
pause
