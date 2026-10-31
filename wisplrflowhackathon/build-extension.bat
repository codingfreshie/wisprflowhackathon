@echo off
echo ===================================================
echo Building Chrome Extension into client\dist...
echo ===================================================
cd /d "%~dp0\client"
npm run build
echo.
echo Build complete! You can load the directory "client\dist"
echo into Google Chrome at chrome://extensions (Load unpacked).
pause
