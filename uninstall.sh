#!/bin/bash

# Logtime Widget GNOME Extension Uninstaller
# For LogtimeWidget@zsonie

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  Logtime Widget Extension Uninstaller${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

EXTENSION_UUID="LogtimeWidget@zsonie"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

# Disable extension first
echo "Disabling extension..."
gnome-extensions disable "$EXTENSION_UUID" 2>/dev/null || echo "Extension already disabled"

# Remove extension directory
if [ -d "$EXTENSION_DIR" ]; then
    echo "Removing extension files..."
    rm -rf "$EXTENSION_DIR"
    echo -e "${GREEN}✓ Extension removed${NC}"
else
    echo -e "${YELLOW}Extension directory not found${NC}"
fi

echo ""
echo -e "${GREEN}Uninstallation complete!${NC}"
echo "Please restart GNOME Shell to complete removal."
