#!/bin/bash

# P-BOX Development Startup Script
# Starts both backend and frontend in development mode

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║        P-BOX Development Mode         ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}Error: Please run this script from the P-BOX root directory${NC}"
    exit 1
fi

# Ensure data directory exists
mkdir -p data/configs data/cores data/logs

# Check for prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check Go
if ! command -v go &> /dev/null; then
    echo -e "${RED}Go is not installed. Please install Go 1.21+${NC}"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm${NC}"
    exit 1
fi

# Build backend if needed
if [ ! -f "backend/p-box" ]; then
    echo -e "${BLUE}Building backend...${NC}"
    cd backend
    go mod tidy
    go build -o p-box .
    cd ..
fi

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
fi

# Build frontend if needed
if [ ! -d "frontend/dist" ]; then
    echo -e "${BLUE}Building frontend...${NC}"
    cd frontend
    npm run build
    cd ..
fi

# Copy frontend files to backend
cp -r frontend/dist/* backend/data/

echo -e "${GREEN}Prerequisites check complete!${NC}"
echo ""

# Ask for mode selection
echo -e "${YELLOW}Select startup mode:${NC}"
echo "1) Development Mode (separate ports)"
echo "2) Production Mode (single port)"
echo -n "Enter choice (1 or 2): "
read -r choice

case $choice in
    1)
        echo -e "${BLUE}Starting in Development Mode...${NC}"
        echo "Backend will run on port 8383"
        echo "Frontend will run on port 5173"
        echo ""
        
        # Start backend in background
        cd backend
        nohup ./p-box > ../data/logs/backend.log 2>&1 &
        BACKEND_PID=$!
        cd ..
        
        # Wait a moment for backend to start
        sleep 3
        
        # Start frontend development server
        cd frontend
        echo -e "${GREEN}Backend started with PID: $BACKEND_PID${NC}"
        echo -e "${GREEN}Starting frontend development server...${NC}"
        npm run dev
        ;;
    
    2)
        echo -e "${BLUE}Starting in Production Mode...${NC}"
        echo "Both backend and frontend will run on port 8383"
        echo ""
        
        # Start backend (frontend is already built and copied)
        cd backend
        echo -e "${GREEN}Starting P-BOX in production mode...${NC}"
        ./p-box
        ;;
    
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Stopping P-BOX...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# If we reach here, it means frontend dev server is running
# Wait for user to press Ctrl+C
echo -e "${GREEN}P-BOX is running!${NC}"
echo "Press Ctrl+C to stop"

# Keep script running
while true; do
    sleep 1
done