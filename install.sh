#!/bin/bash

# Logtime Widget GNOME Extension Installer
# For LogtimeWidget@zsonie

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Logtime Widget Extension Installer${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Extension details
EXTENSION_UUID="LogtimeWidget@zsonie"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

# Install Python dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip3 install --user selenium psutil

# Create extension directory
echo -e "${YELLOW}Installing extension...${NC}"
mkdir -p "$EXTENSION_DIR"

# Copy extension files
echo "Copying files to $EXTENSION_DIR"
cp -rf extension/* "$EXTENSION_DIR/"

# Make Python script executable
chmod +x "$EXTENSION_DIR/connect/capture_cookies.py"

echo -e "${GREEN}✓ Extension files installed${NC}"

# Enable extension
echo -e "${YELLOW}Enabling extension...${NC}"
gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null || {
    echo -e "${YELLOW}Note: Extension will be enabled after GNOME Shell restart${NC}"
}

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

killall -3 gnome-shell
sleep 1
gnome-extensions enable "$EXTENSION_UUID"