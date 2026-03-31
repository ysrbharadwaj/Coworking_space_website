#!/bin/bash

# Co-Working Space Platform - Admin Startup Script
# Starts backend API + admin frontend

echo "=========================================="
echo "  Co-Working Space Platform (Admin)"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

IS_WINDOWS=false
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]] || uname -s | grep -qi "mingw\|msys\|cygwin"; then
    IS_WINDOWS=true
fi

NODE_VERSION=$(node --version 2>&1)
if [ $? -ne 0 ]; then
    if [ "$IS_WINDOWS" = true ]; then
        NODE_VERSION=$(node.exe --version 2>&1)
        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Node.js is not accessible in this shell.${NC}"
            echo "Use start.bat or start.ps1 on Windows, or add Node.js to PATH."
            exit 1
        fi
    else
        echo -e "${RED}Error: Node.js is not installed or not in PATH.${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}Node.js version: $NODE_VERSION${NC}"
echo ""

is_port_in_use() {
    local port="$1"

    if command -v lsof >/dev/null 2>&1; then
        lsof -iTCP:"$port" -sTCP:LISTEN -Pn >/dev/null 2>&1
        return $?
    fi

    if command -v ss >/dev/null 2>&1; then
        ss -ltn | grep -E "[:.]${port}[[:space:]]" >/dev/null 2>&1
        return $?
    fi

    netstat -an 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -Ei "LISTEN|LISTENING" >/dev/null 2>&1
    return $?
}

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down admin services...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null
    fi
    if [ -n "$ADMIN_PID" ]; then
        kill "$ADMIN_PID" 2>/dev/null
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

if is_port_in_use 3001; then
    echo -e "${GREEN}[1/2] Backend already running on port 3001. Reusing existing instance.${NC}"
else
    echo -e "${GREEN}[1/2] Starting Backend Server...${NC}"
    cd backend
    npm start &
    BACKEND_PID=$!
    cd ..
    sleep 3
fi

if is_port_in_use 8081; then
    echo -e "${GREEN}[2/2] Admin frontend already running on port 8081. Reusing existing instance.${NC}"
else
    echo -e "${GREEN}[2/2] Starting Admin Frontend...${NC}"
    cd admin-frontend
    npm start &
    ADMIN_PID=$!
    cd ..
fi

echo ""
echo -e "${GREEN}=========================================="
echo "  ✓ Admin Services Started!"
echo "==========================================${NC}"
echo ""
echo "Backend API:     http://localhost:3001"
echo "Admin Frontend:  http://localhost:8081/login.html"
echo ""
echo -e "${BLUE}Opening admin login page...${NC}"
sleep 1

if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8081/login.html
elif command -v open &> /dev/null; then
    open http://localhost:8081/login.html
elif command -v start &> /dev/null; then
    start http://localhost:8081/login.html
fi

echo ""
echo "Press Ctrl+C to stop backend + admin frontend"
echo ""

wait
