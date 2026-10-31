@echo off
echo ===================================================
echo  Wispr Flow bridge - pushes your dictations to the hosted site
echo ===================================================
set /p SITE_URL=Your site URL (e.g. https://your-app.onrender.com): 
set /p WISPR_BRIDGE_TOKEN=Bridge token: 
cd /d "%~dp0"
node scripts\wispr-bridge.cjs %SITE_URL% %WISPR_BRIDGE_TOKEN%
pause
