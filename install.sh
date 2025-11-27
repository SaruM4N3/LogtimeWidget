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
# 1. The permanent source directory (Git Repo Root)
SOURCE_DIR="$HOME/.config/gnome-extensions-source/$EXTENSION_UUID"
# 2. The GNOME extensions directory (Runtime)
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

echo -e "${YELLOW}Checking dependencies...${NC}"
pip3 install --user selenium psutil || echo -e "${RED}Warning: Python dependencies failed${NC}"

# ---------------------------------------------------------
# NEW INSTALLATION LOGIC
# ---------------------------------------------------------

echo -e "${YELLOW}Setting up source repository in $SOURCE_DIR...${NC}"

# Remove old directories to ensure clean state
rm -rf "$SOURCE_DIR"
rm -rf "$INSTALL_DIR"

# Create parent directories
mkdir -p "$(dirname "$SOURCE_DIR")"
mkdir -p "$(dirname "$INSTALL_DIR")"

# Copy CURRENT directory (repo root) to SOURCE_DIR
# This preserves .git, install.sh, extension/, everything
cp -r . "$SOURCE_DIR"

echo -e "${YELLOW}Linking extension to GNOME Shell...${NC}"

# Create the symlink: GNOME Extension Dir -> Source Dir's 'extension' folder
# This is the magic step. GNOME runs files from here, but they are physically in SOURCE_DIR
ln -s "$SOURCE_DIR/extension" "$INSTALL_DIR"

# Make Python script executable in the SOURCE directory (symlink sees it automatically)
chmod +x "$SOURCE_DIR/extension/connect/capture_cookies.py"

echo -e "${GREEN}✓ Extension installed via symlink${NC}"
echo -e "  Source:  $SOURCE_DIR"
echo -e "  Link:    $INSTALL_DIR"

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