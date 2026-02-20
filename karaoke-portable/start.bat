@echo off
title Karaoke Server
echo.
echo   Checking components...
if not exist node_modules (
  echo   [!] Missing dependencies. Installing... (Internet required for first run)
  npm install --omit=dev
)
echo.
echo   Starting Karaoke Server...
echo   Browser will open at http://localhost:5173
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5173
node server.js
pause
