# Logtime Widget - GNOME Shell Extension

A GNOME Shell extension that tracks and displays your monthly logtime for 42 School. Shows real-time progress towards your monthly hour requirements with visual status indicators.

## Screenshots

![Preview](screenshots/preview.gif)

## Installation

### Automated Installation

```
git clone https://github.com/SaruM4N3/LogtimeWidget.git
cd LogtimeWidget
./install.sh
```

### Manual Installation

Install Python dependencies  
`pip3 install --user selenium psutil`

Copy extension files
```
git clone https://github.com/SaruM4N3/LogtimeWidget.git
cd LogtimeWidget/extension
mkdir -p ~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie  
cp -r * ~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie/
```

Enable the extension  
`gnome-extensions enable LogtimeWidget@zsonie`

Restart GNOME Shell 
`X11: Press Alt+F2, type 'r', press Enter  
Wayland: Log out and log back in`

## Usage

### First Time Setup

1. Brave browser will open automatically  
2. Log in to your [translate:Intra42] account  
3. Once logged in, the browser will close and your [translate:logtime] will appear
4. When the Cookie token will expire, the browser will automatically reopen (every 2-3 days)

### Menu Options

- **Refresh Manually**: Force an immediate data refresh  
- **Force Login Manually**: Force an immediate login  
- **Set Bonus Days**: Add bonus days to your monthly calculation  
- **Set Gift Days**: Add gift days (exclusions) to your calculation  
- **Restart Widget**: Restart the extension  
- **Settings**: Open extension settings

### Configuration

The extension stores your session cookie securely in:  
`~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie/.intra42_cookies.json`

Bonus and gift days are stored in:  
`~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie/storage.json`

## Features

- **Real-time Logtime Tracking**: Displays current monthly hours directly in your GNOME top panel  
- **Visual Status Indicators**:  
  - Red: from 0%  
  - Green: to 99%  
  - Cyan: Congrats, you are rich!  
- **Bonus & Gift Days**: Manually add bonus days and gift days to your calculations  
- **Automatic Cookie Authentication**: Secure login via Brave browser with automatic session management  
- **Auto-refresh**: Periodic updates every 60 seconds  
- **Manual Refresh**: Force refresh anytime from the dropdown menu

## Requirements

- GNOME Shell 42 or later  
- Python 3.10+  
- Brave Browser  
- ChromeDriver

### Dependencies

- `python3` - Python runtime  
- `python-pip` - Python package manager  
- `brave` or `brave-browser` - Brave browser  
- `chromedriver` - Selenium WebDriver for Chrome/Brave  
- `selenium` - Python Selenium library  
- `psutil` - Python process utilities

## Development

### File Structure

```
./
├── extension/
│   ├── connect/
│   │   ├── capture_cookies.py
│   │   └── connect.js
│   ├── data/
│   │   ├── data.js
│   │   └── storage.js
│   ├── extension.js
│   ├── metadata.json
│   ├── prefs.js
│   ├── stylesheet.css
│   └── utils/
│       ├── calculation.js
│       ├── debug.js
│       └── settings.js
├── install.sh
├── README.md
├── screenshots/
│   └── preview.gif
└── uninstall.sh
```
### Debugging

#### View extension logs:  
Real-time log monitoring  
`journalctl -f -o cat /usr/bin/gnome-shell`

Or use Looking Glass (Alt+F2, type 'lg')

Cookie capture logs are written to:  
`~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie/utils/.cookie_capture.log`

### Building from Source

The extension is written in JavaScript (GJS) and doesn't require compilation. Simply edit the files and restart GNOME Shell to see changes.

## Troubleshooting

### Extension doesn't appear after installation

Restart GNOME Shell  
X11: Alt+F2, type 'r', Enter
Check if extension is enabled  
`gnome-extensions list --enabled | grep LogtimeWidget`

Enable manually if needed  
`gnome-extensions enable LogtimeWidget@zsonie`

### Login window doesn't close automatically

The Brave window should close automatically after successful login. If it doesn't:  
1. Close it manually after logging in  
2. The cookie should still be captured  
3. Check `.cookie_capture.log` for errors

### "Failed to get data" error

1. Click "Login" to refresh your session  
2. Check your internet connection  
3. Verify you have access to profile.intra.42.fr

## Uninstallation

Using uninstall script  
```
chmod +x uninstall.sh
./uninstall.sh
```

Or manually  
```
gnome-extensions disable LogtimeWidget@zsonie  
rm -rf ~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie
```

## Privacy & Security

- Your [translate:Intra42] credentials are **never stored** by this extension  
- Session cookies are stored locally in your home directory  
- Cookies are only used to fetch your [translate:logtime] data  
- No data is sent to external servers (except profile.intra.42.fr)

## License

There's no License, come on.

## Credits

- Developed by zsonie  
- Inspired by [translate:42 School]'s monthly [translate:logtime] requirements  
- Built with GNOME Shell Extension APIs

## Support

For issues, questions, or feature requests, please open an issue on the project repository.

---

**Note**: This extension is not officially affiliated with or endorsed by [translate:42 School].
