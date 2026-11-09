#!/bin/bash

# Logtime Widget GNOME Extension Uninstaller
# Usage: ./uninstall.sh [--purge]   (--purge also deletes settings and session without asking)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}      Logtime Widget Uninstaller        ${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

EXTENSIONS_DIR="$HOME/.local/share/gnome-shell/extensions"
# Current uuid, and the one used by older versions
UUIDS=("soft-brightness@fifi.org" "LogtimeWidget@zsonie")
# Settings, session cookie, login browser data and logs (see data/storage.js)
DATA_DIR="$HOME/.local/share/LogtimeWidget"

for uuid in "${UUIDS[@]}"; do
    dir="$EXTENSIONS_DIR/$uuid"
    gnome-extensions disable "$uuid" 2>/dev/null || true
    if [ -d "$dir" ]; then
        rm -rf "$dir"
        echo -e "${GREEN}✓ Removed $dir${NC}"
    fi
done

if [ -d "$DATA_DIR" ]; then
    if [ "$1" = "--purge" ]; then
        answer=y
    else
        read -r -p "Also delete your settings and attendance session ($DATA_DIR)? [y/N] " answer
    fi
    if [[ "$answer" =~ ^[yY]$ ]]; then
        rm -rf "$DATA_DIR"
        echo -e "${GREEN}✓ Removed $DATA_DIR${NC}"
    else
        echo -e "${YELLOW}Kept $DATA_DIR (a reinstall will reuse it)${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}      Uninstallation Complete!          ${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Restart GNOME Shell (Alt+F2, then r) to remove the widget from the panel."
