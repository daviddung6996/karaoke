@echo off
chcp 65001 >nul
title 🎤 Karaoke Server
color 0F

echo.
echo   ╔══════════════════════════════════════╗
echo   ║   🎤  KARAOKE - Khoi dong...         ║
echo   ╚══════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   ❌ Chua cai Node.js!
    echo   Tai tai: https://nodejs.org
    pause
    exit /b 1
)

:: Install deps if needed
if not exist "node_modules\" (
    echo   📥 Dang cai thu vien lan dau...
    call npm install
    echo.
)

:: Build if needed
if not exist "dist\" (
    echo   🔨 Dang build giao dien...
    call npm run build
    echo.
)

echo   🚀 Dang khoi dong server...
echo   📺 Trinh duyet se tu mo tai http://localhost:5173
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5173
node server.js
pause
