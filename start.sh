#!/bin/bash

# Co-Working Space Platform - Startup Script (Unix/Linux/Mac/Git Bash)
# This script starts both the backend and frontend servers

echo "=========================================="
echo "  Co-Working Space Platform Startup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Detect if running on Windows
IS_WINDOWS=false
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]] || uname -s | grep -qi "mingw\|msys\|cygwin"; then
    IS_WINDOWS=true
fi

# Check if Node.js is installed by trying to run it
NODE_VERSION=$(node --version 2>&1)
if [ $? -ne 0 ]; then
    if [ "$IS_WINDOWS" = true ]; then
        # Try node.exe on Windows (common in Git Bash)
        NODE_VERSION=$(node.exe --version 2>&1)
        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Node.js is not accessible in Git Bash.${NC}"
            echo ""
            echo -e "${YELLOW}For Windows, please use instead:${NC}"
            echo "  start.bat   (CMD/Double-click)"
            echo "  .\\start.ps1  (PowerShell)"
            echo ""
            echo "Or add Node.js to your Git Bash PATH."
            exit 1
        fi
    else
        echo -e "${RED}Error: Node.js is not installed or not in PATH.${NC}"
        echo "Please install Node.js from https://nodejs.org/"
        exit 1
    fi
fi

echo -e "${BLUE}Node.js version: $NODE_VERSION${NC}"
echo ""

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Backend Server
echo -e "${GREEN}[1/2] Starting Backend Server...${NC}"
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start Frontend Server
echo -e "${GREEN}[2/2] Starting Frontend Server...${NC}"
cd user-frontend
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}=========================================="
echo "  ✓ Servers Started Successfully!"
echo "==========================================${NC}"
echo ""
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:8080"
echo ""
echo -e "${BLUE}Opening browser...${NC}"
sleep 2

# Open browser to index.html (smart redirect based on login status)
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8080
elif command -v open &> /dev/null; then
    open http://localhost:8080
elif command -v start &> /dev/null; then
    start http://localhost:8080
fi

echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for background processes
wait
