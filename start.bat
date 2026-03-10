@echo off
REM Co-Working Space Platform - Startup Script (Windows)
REM This script starts both the backend and frontend servers

echo ==========================================
echo   Co-Working Space Platform Startup
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

REM Start Backend Server
echo [1/2] Starting Backend Server...
start "Backend Server" cmd /k "cd backend && npm start"

REM Wait for backend to initialize
timeout /t 3 /nobreak >nul

REM Start Frontend Server
echo [2/2] Starting Frontend Server...
start "Frontend Server" cmd /k "cd user-frontend && npm start"

REM Wait for frontend to initialize
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo   Servers Started Successfully!
echo ==========================================
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:8080
echo.
echo Opening browser...
timeout /t 1 /nobreak >nul

REM Open browser
start http://localhost:8080

echo.
echo Close the server windows to stop the application.
echo.
pause
