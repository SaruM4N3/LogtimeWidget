#!/bin/bash

# Logtime Widget GNOME Extension Installer
# For LogtimeWidget@zsonie

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Logtime Widget Extension Installer${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Extension details
EXTENSION_UUID="LogtimeWidget@zsonie"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

# Check if running on GNOME
if [ "$XDG_CURRENT_DESKTOP" != "GNOME" ]; then
    echo -e "${YELLOW}Warning: This script is designed for GNOME Shell \n${GREEN}(42Lyon sessions are running on GNOME, just press y)${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

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
cp -f extension.js "$EXTENSION_DIR/"
cp -f metadata.json "$EXTENSION_DIR/"
cp -f stylesheet.css "$EXTENSION_DIR/"
cp -f capture_cookies.py "$EXTENSION_DIR/"
cp -f data.js "$EXTENSION_DIR/"
cp -f calculation.js "$EXTENSION_DIR/"
cp -f connect.js "$EXTENSION_DIR/"
cp -f storage.js "$EXTENSION_DIR/"
cp -f debug.js "$EXTENSION_DIR/"

# Make Python script executable
chmod +x "$EXTENSION_DIR/capture_cookies.py"

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
echo ""
echo -e "${GREEN}The extension should now appear in your top panel!\n${NC}"
echo -e "${YELLOW}If not you should go to extension and enable it!${NC}"
echo -e "${YELLOW}or simply execute: gnome-extensions enable "$EXTENSION_UUID"${NC}"

killall -3 gnome-shell
sleep 1
gnome-extensions enable "$EXTENSION_UUID"