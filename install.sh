#!/bin/bash

# Logtime Widget GNOME Extension Installer
# For LogtimeWidget@zsonie

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Logtime Widget Installer (Dev Mode)  ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

EXTENSION_UUID="LogtimeWidget@zsonie"
SOURCE_DIR="$(pwd)"  # this repo
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

echo -e "${YELLOW}Checking dependencies...${NC}"
pip3 install --user selenium psutil webdriver-manager || echo -e "${RED}Warning: Python dependencies failed${NC}"

echo -e "${YELLOW}Cleaning old $INSTALL_DIR...${NC}"
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

echo -e "${YELLOW}Copying files to $INSTALL_DIR...${NC}"
cp -r "$SOURCE_DIR/"* "$INSTALL_DIR/"
# Copy .git folder (REQUIRED for updater)
if [ -d "$SOURCE_DIR/.git" ]; then
    cp -r "$SOURCE_DIR/.git" "$INSTALL_DIR/"
fi
chmod +x "$INSTALL_DIR/connect/capture_cookies.py"

# ---------------------------------------------------------

echo -e "${YELLOW}Enabling extension...${NC}"
gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}       Installation Complete!           ${NC}"
echo -e "${GREEN}========================================${NC}"

killall -3 gnome-shell
sleep 1
gnome-extensions enable "$EXTENSION_UUID"