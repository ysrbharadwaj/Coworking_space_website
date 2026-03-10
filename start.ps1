# Co-Working Space Platform - Startup Script (PowerShell)
# This script starts both the backend and frontend servers

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Co-Working Space Platform Startup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Blue
    Write-Host ""
} catch {
    Write-Host "[ERROR] Node.js is not installed." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Start Backend Server
Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Green
$backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm start" -PassThru -WindowStyle Normal

# Wait for backend to initialize
Start-Sleep -Seconds 3

# Start Frontend Server
Write-Host "[2/2] Starting Frontend Server..." -ForegroundColor Green
$frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\user-frontend'; npm start" -PassThru -WindowStyle Normal

# Wait for frontend to initialize
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  ✓ Servers Started Successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "Frontend: http://localhost:8080" -ForegroundColor White
Write-Host ""
Write-Host "Opening browser..." -ForegroundColor Blue
Start-Sleep -Seconds 1

# Open browser to index.html (smart redirect based on login status)
Start-Process "http://localhost:8080"

Write-Host ""
Write-Host "Backend PID:  $($backendJob.Id)" -ForegroundColor DarkGray
Write-Host "Frontend PID: $($frontendJob.Id)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Close the server windows to stop the application." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit this window"
