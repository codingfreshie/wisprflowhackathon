@echo off
echo ===================================================
echo  Meeting Sync Agent - one-click demo
echo  Backend + dashboard on http://localhost:5000
echo ===================================================
cd /d "%~dp0server"
if not exist node_modules (
  echo Installing server dependencies (first run only)...
  call npm install
)
start "" cmd /c "timeout /t 3 >nul & start http://localhost:5000"
npm start
pause
