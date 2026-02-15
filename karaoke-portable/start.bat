@echo off
title Karaoke Server
echo.
echo   Starting Karaoke Server...
echo   Browser will open at http://localhost:5173
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5173
node server.js
pause
