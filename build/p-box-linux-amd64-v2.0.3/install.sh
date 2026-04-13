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
