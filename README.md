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

Copy extension files
```
git clone https://github.com/SaruM4N3/LogtimeWidget.git
cd LogtimeWidget
mkdir -p ~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie
cp -r connect data utils extension.js metadata.json prefs.js stylesheet.css \
    ~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie/
```

Enable the extension
```
gnome-extensions enable LogtimeWidget@zsonie
```

Restart GNOME Shell
```
X11:    Alt+F2 → type 'r' → Enter
Wayland: log out and log back in
```

## First Time Setup

The extension uses the **42 API OAuth2** (Client Credentials flow) — no browser, no cookies.

### 1. Create an API application on the 42 intranet

1. Go to [https://profile.intra.42.fr/oauth/applications](https://profile.intra.42.fr/oauth/applications)
2. Click **REGISTER A NEW APP** (top right of the page)
3. Fill in any name and description(e.g. `LogtimeWidget`)
4. Fill Application type with "campus tool"
5. Set the redirect URI to `https://github.com/SaruM4N3/LogtimeWidget/` (or any valid URI, it won't be used)
6. Submit — you'll get a **Client ID** and a **Client Secret**

### 2. Enter your credentials in the extension settings

1. Click the widget in your top panel → **Settings**
   *or* run `gnome-extensions prefs LogtimeWidget@zsonie`
2. In the **API Credentials** section, paste your **Client ID** and **Client Secret**
3. Click **Save**
4. The widget will authenticate automatically and start displaying your logtime

Tokens are refreshed automatically every ~2 hours — no action required on your part.

## Usage

### Menu Options

- **Refresh Manually** — Force an immediate data refresh
- **Set Bonus Days** — Add bonus days to your monthly calculation (each day = 7h)
- **Set Gift Days** — Add gift days (reduces required working hours)
- **Restart Widget** — Restart the extension
- **Settings** — Open extension preferences

### Display Formats

Choose your preferred format in Settings:

| Format | Example |
|--------|---------|
| **Current / Needed** | `47h30/77h` |
| **Remaining Hours** | `Remaining: 29h30` |
| **Combined** | `47h30/77h \| Remaining: 29h30` |

You can also toggle **Show Minutes** to hide the minutes and keep the display compact.

### Configuration

Credentials and preferences are stored locally in:
```
~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie/storage.json
```

## Features

- **Real-time Logtime Tracking** — Sessions are fetched from the 42 API and updated every 60 seconds, including your currently active session
- **Visual Status Indicators**
  - Red → below target
  - Green → on track
  - Cyan → above target
- **Active Session Aware** — Counts time for sessions still in progress (logged in right now)
- **Bonus & Gift Days** — Manually adjust your calculations
- **OAuth2 Authentication** — Secure, token-based auth via the official 42 API (no browser, no cookies)
- **Auto Token Refresh** — Token is renewed automatically before expiry
- **Manual Refresh** — Force refresh anytime from the dropdown menu

## Requirements

- GNOME Shell 42 or later
- A 42 intranet account with API access

No external dependencies or Python required.

## File Structure

```
./
├── connect/
│   ├── connect.js          # OAuth2 token fetch
│   └── updater.js
├── data/
│   ├── data.js             # API requests & periodic refresh
│   └── storage.js          # Local settings persistence
├── utils/
│   ├── calculation.js      # Logtime calculation from API sessions
│   ├── debug.js
│   └── settings.js
├── extension.js            # Main extension entry point
├── metadata.json
├── prefs.js                # Settings UI
├── stylesheet.css
├── install.sh
├── uninstall.sh
└── README.md
```

## Debugging

View extension logs in real time:
```
journalctl -f -o cat /usr/bin/gnome-shell
```

Or use Looking Glass: `Alt+F2` → type `lg`

## Troubleshooting

### Widget shows "Auth failed: check API keys"

- Double-check your Client ID and Client Secret in Settings
- Make sure the application is not revoked on the intranet
- Verify your internet connection

### Widget shows "Enter login & API keys in settings"

- Open Settings and fill in your **42 login**, **Client ID**, and **Client Secret**

### Extension doesn't appear after installation

```
gnome-extensions list --enabled | grep LogtimeWidget
gnome-extensions enable LogtimeWidget@zsonie
```

Then restart GNOME Shell.

## Uninstallation

```
chmod +x uninstall.sh
./uninstall.sh
```

Or manually:
```
gnome-extensions disable LogtimeWidget@zsonie
rm -rf ~/.local/share/gnome-shell/extensions/LogtimeWidget@zsonie
```

## Privacy & Security

- Your Client Secret is stored **locally only** in `storage.json`
- Authentication uses the official 42 OAuth2 API — no third-party services involved
- No data is sent anywhere except `api.intra.42.fr`

## License

There's no License, come on.

## Credits

- Developed by zsonie
- Built with GNOME Shell Extension APIs and the 42 API

## Support

For issues, questions, or feature requests, please open an issue on the project repository.

---

**Note**: This extension is not officially affiliated with or endorsed by any 42 School.
