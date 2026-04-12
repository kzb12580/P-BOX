#!/bin/bash

# P-BOX Linux Build Script
# Builds binaries for Linux platforms

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║        P-BOX Linux Build Script       ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
VERSION="2.0.3"
BUILD_DIR="build"
DIST_DIR="dist"

# Create directories
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Build frontend
echo -e "${BLUE}Building frontend...${NC}"
cd frontend
npm install
npm run build
cd ..

# Copy frontend to backend
cp -r frontend/dist/* backend/data/

# Build for Linux amd64
echo -e "${BLUE}Building Linux amd64...${NC}"
cd backend
GOOS=linux GOARCH=amd64 go build -ldflags="-X main.BuildTime=$(date +%Y-%m-%d)" -o ../$BUILD_DIR/p-box-linux-amd64 .
cd ..

# Build for Linux arm64
echo -e "${BLUE}Building Linux arm64...${NC}"
cd backend
GOOS=linux GOARCH=arm64 go build -ldflags="-X main.BuildTime=$(date +%Y-%m-%d)" -o ../$BUILD_DIR/p-box-linux-arm64 .
cd ..

# Create package directories and copy files
for arch in amd64 arm64; do
    echo -e "${BLUE}Packaging Linux $arch...${NC}"
    PKG_DIR="$BUILD_DIR/p-box-linux-$arch-v$VERSION"
    mkdir -p "$PKG_DIR"
    
    # Copy binary
    cp "$BUILD_DIR/p-box-linux-$arch" "$PKG_DIR/p-box"
    
    # Copy configuration files
    cp README.md "$PKG_DIR/"
    cp AI-REBUILD.md "$PKG_DIR/"
    cp LICENSE "$PKG_DIR/"
    
    # Create default config if not exists
    if [ ! -f "data/config.yaml" ]; then
        cat > "$PKG_DIR/config.yaml" << EOF
# P-BOX Configuration
server:
  host: "127.0.0.1"
  port: 8383

proxy:
  mixedPort: 7890

log:
  level: "info"
  file: "p-box.log"
EOF
    else
        cp data/config.yaml "$PKG_DIR/"
    fi
    
    # Create data directories structure
    mkdir -p "$PKG_DIR/data/configs" "$PKG_DIR/data/cores" "$PKG_DIR/data/logs"
    
    # Create install script
    cat > "$PKG_DIR/install.sh" << 'EOF'
#!/bin/bash

# P-BOX Installation Script

set -e

INSTALL_DIR="/etc/p-box"

# Check root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo)"
    exit 1
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Copy files
cp -r . "$INSTALL_DIR/"

# Set permissions
chmod 755 "$INSTALL_DIR/p-box"

# Create systemd service
cat > /etc/systemd/system/p-box.service << EOFSERVICE
[Unit]
Description=P-BOX Proxy Management Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/p-box
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOFSERVICE

# Enable and start service
systemctl daemon-reload
systemctl enable p-box
systemctl start p-box

echo "P-BOX installed successfully!"
echo "Access at: http://localhost:8383"
echo "Manage with: systemctl status p-box"
EOF
    
    chmod +x "$PKG_DIR/install.sh"
    
    # Create tar package
    cd "$BUILD_DIR"
    tar -czf "../$DIST_DIR/p-box-linux-$arch-v$VERSION.tar.gz" "p-box-linux-$arch-v$VERSION"
    cd ..
    
    echo -e "${GREEN}Created: $DIST_DIR/p-box-linux-$arch-v$VERSION.tar.gz${NC}"
done

# Create release notes
cat > "$DIST_DIR/RELEASE_NOTES.md" << EOF
# P-BOX v$VERSION Release Notes

## 🚀 What's New

- AI-rebuilt version based on original P-BOX project
- Modern cross-platform proxy management panel
- Beautiful Apple Glass style UI
- Support for multiple proxy protocols
- Real-time traffic monitoring

## 📦 Installation

### Linux amd64
\`\`\`bash
# Download and install
wget https://github.com/kzb12580/P-BOX/releases/download/v$VERSION/p-box-linux-amd64-v$VERSION.tar.gz
tar -xzf p-box-linux-amd64-v$VERSION.tar.gz
cd p-box-linux-amd64-v$VERSION
sudo ./install.sh
\`\`\`

### Linux arm64
\`\`\`bash
wget https://github.com/kzb12580/P-BOX/releases/download/v$VERSION/p-box-linux-arm64-v$VERSION.tar.gz
tar -xzf p-box-linux-arm64-v$VERSION.tar.gz
cd p-box-linux-arm64-v$VERSION
sudo ./install.sh
\`\`\`

## 🔧 Features

- 🎨 Modern UI with dark/light themes
- 🌐 Cross-platform support (Linux/macOS/Windows)
- 📊 Real-time dashboard with traffic stats
- 📦 Subscription management
- ⚡ Config generator
- 🔐 Authentication system

## 📋 System Requirements

- Linux x86_64 or ARM64
- 1GB+ RAM
- 100MB+ disk space

## 🙏 Acknowledgments

This project was AI-rebuilt based on the original P-BOX project by dl185.

EOF

echo -e "${GREEN}"
echo "══════════════════════════════════════════"
echo "Build completed successfully!"
echo "Packages created in: $DIST_DIR/"
echo ""
echo "Files created:"
ls -la "$DIST_DIR/"
echo "══════════════════════════════════════════"
echo -e "${NC}"