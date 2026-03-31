@echo off
REM Co-Working Space Platform - Admin Startup Script (Windows)
REM This script starts backend + admin frontend

echo ==========================================
echo   Co-Working Space Platform (Admin)
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Start Backend Server only if port 3001 is free
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [1/2] Backend already running on port 3001. Reusing existing instance.
) else (
    echo [1/2] Starting Backend Server...
    start "Backend Server" cmd /k "cd backend && npm start"
    timeout /t 3 /nobreak >nul
)

REM Start Admin Frontend only if port 8081 is free
netstat -ano | findstr ":8081" | findstr "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [2/2] Admin frontend already running on port 8081. Reusing existing instance.
) else (
    echo [2/2] Starting Admin Frontend...
    start "Admin Frontend" cmd /k "cd admin-frontend && npm start"
    timeout /t 2 /nobreak >nul
)

echo.
echo ==========================================
echo   Admin Services Started Successfully!
echo ==========================================
echo.
echo Backend API:    http://localhost:3001
echo Admin Panel:    http://localhost:8081/login.html
echo.
echo Opening admin login page...
timeout /t 1 /nobreak >nul

REM Open browser
start http://localhost:8081/login.html

echo.
echo Close the server windows to stop the services.
echo.
pause
