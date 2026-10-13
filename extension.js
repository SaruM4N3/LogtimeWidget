const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Me = ExtensionUtils.getCurrentExtension();
const Updater = Me.imports.connect.updater;

const { Connect } = Me.imports.connect.connect;
const { Data } = Me.imports.data.data;
const { MyStorage } = Me.imports.data.storage;
const { Calculation } = Me.imports.utils.calculation;
const { Settings } = Me.imports.utils.settings;
const { Debug } = Me.imports.utils.debug;
const { Menu } = Me.imports.utils.menu;

const ATTENDANCE_DATA_URL = 'https://attendance.42lyon.fr/me/__data.json';
// Must match .logtime-bar width in stylesheet.css
const BAR_WIDTH = 100;
// The badge bar blinks red when the session expires in less than this
const BADGE_WARNING_MS = 15 * 60 * 1000;
const BLINK_INTERVAL_MS = 500;

class LogWidget {
	constructor() {
		this._applySettings(MyStorage.loadSettings());
		this._refreshTimeoutId = null;
		this._checkTimeout = null;
		this._blinkTimeoutId = null;
		this._blinkOn = false;
		this._cachedData = null;
		this._fileMonitor = null;
		this._sessionMonitor = null;
		this._updateAvailable = false;
	}

	enable() {
		Menu.setupApp(this);
		this._setupStorageMonitoring();
		this._connect();

		this.updateManager = new Updater.UpdateManager();

		this._checkTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
			this.updateManager.checkForUpdates((_count) => {
				this._updateAvailable = true;
				this._updateLogtime();
				if (this.updateItem) {
					this.updateItem.label.text = 'Update Available';
					this.updateItem.actor.visible = true;
					this.updateItem.label.set_style('color: #4ade80; font-weight: bold;');
				}
			});
			return GLib.SOURCE_CONTINUE;
		});
	}

	disable() {
		Connect.cancelLogin();
		this._stopBlink();

		[this._fileMonitor, this._sessionMonitor].forEach((m) => {
			if (m) m.cancel();
		});
		this._fileMonitor = null;
		this._sessionMonitor = null;

		[this._refreshTimeoutId, this._checkTimeout].forEach((id) => {
			if (id) GLib.source_remove(id);
		});
		this._refreshTimeoutId = null;
		this._checkTimeout = null;

		if (this._indicator) {
			this._indicator.destroy();
			this._indicator = null;
		}
	}

	// Settings come complete from MyStorage.loadSettings (defaults live in storage.js)
	_applySettings(saved) {
		this.showMinutes = saved.showMinutes;
		this.displayFormat = saved.displayFormat;
		this.showCurrentDay = saved.showCurrentDay;
		this.birthDate = saved.birthDate;
		this.showMoney = saved.showMoney;
		this.colorGradient = saved.colorGradient;
		this.startColor = saved.startColor;
		this.endColor = saved.endColor;
		this.aheadColor = saved.aheadColor;
		this.displayMode = saved.displayMode;
		this.panelPosition = saved.panelPosition;
		this.barColor = saved.barColor;
		this.badgeColor = saved.badgeColor;
		this.badgeAlertColor = saved.badgeAlertColor;
	}

	_setupStorageMonitoring() {
		this._fileMonitor = Settings.setupStorageMonitoring(() => {
			let previousPosition = this.panelPosition;
			this._applySettings(MyStorage.loadSettings());
			if (this.panelPosition !== previousPosition)
				Menu.moveToPanel(this, this.panelPosition);
			Debug.logInfo(`Settings reloaded: format=${this.displayFormat}`);
			this._updateLogtime();
		});

		// Reconnect when the login window saves a new session, or when it's cleared from Settings
		let sessionFile = Gio.File.new_for_path(MyStorage.SESSION_FILE);
		let sessionDir = Gio.File.new_for_path(GLib.path_get_dirname(MyStorage.SESSION_FILE));
		this._sessionMonitor = sessionDir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
		this._sessionMonitor.connect('changed', (_monitor, file, _otherFile, eventType) => {
			if (file && file.equal(sessionFile) &&
				(eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT || eventType === Gio.FileMonitorEvent.DELETED)) {
				Debug.logInfo(`Session changed (Event: ${eventType}), reconnecting...`);
				GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
					this._connect();
					return GLib.SOURCE_REMOVE;
				});
			}
		});
	}

	_stopRefresh() {
		if (this._refreshTimeoutId) {
			GLib.source_remove(this._refreshTimeoutId);
			this._refreshTimeoutId = null;
		}
	}

	_connect() {
		this._stopRefresh();

		let session = MyStorage.loadSession();
		if (!session.cookie) {
			this._login();
			return;
		}

		this._hideBars();
		this._label.set_text('Connecting...');
		this._label.set_style('color: #10b981; font-weight: 600;');

		this._refreshTimeoutId = Data.startPeriodicRefresh(
			ATTENDANCE_DATA_URL,
			session.cookie,
			60,
			(data) => {
				this._cachedData = data;
				this._updateLogtime();
			},
			() => this._login()
		);
	}

	// Opens the attendance login window; the session monitor reconnects once it saves the cookie
	_login() {
		this._stopRefresh();
		this._hideBars();
		this._label.set_text('Log in to Attendance...');
		this._label.set_style('color: #f59e0b; font-weight: 600;');

		Connect.login((success) => {
			if (!success) {
				this._hideBars();
				this._label.set_text('Not logged in: click to reconnect');
				this._label.set_style('color: #ef4444; font-weight: 600;');
			}
		});
	}

	_updateLogtime() {
		if (!this._cachedData) {
			Debug.logWarn('No cached data yet, will update on next refresh...');
			return;
		}

		let stats = Calculation.calculateStats(this._cachedData);
		let result = Calculation.formatTimeDisplay(
			stats,
			this.showMinutes,
			this.displayFormat,
			this.showCurrentDay,
			this.birthDate,
			this.showMoney
		);

		this._label.set_text(result.text);
		this._label.visible = this.displayMode !== 'bar';

		let percentage = Math.min(1.0, Math.max(0.0, result.percent / 100));
		let color = this._interpolateColor(percentage);
		this._label.set_style(`color: ${color}; font-weight: 600;`);
		this._updateBars(percentage);

		Debug.logSuccess(`Updated: ${result.text} [minutes:${this.showMinutes}, format:${this.displayFormat}]`);
	}

	// Display mode 'bar' or 'combined': the display format picks the bars,
	// ratio -> month progress, remaining -> time before next badge, all -> both
	_updateBars(percentage) {
		let showBars = this.displayMode !== 'text';
		let showMonth = showBars && this.displayFormat !== 'remaining';
		let showBadge = showBars && this.displayFormat !== 'ratio';

		if (showMonth) {
			this._fillBar(this._monthBar, percentage, this.barColor);
			this._monthLabel.set_text(`${Math.round(percentage * 100)}%`);
			this._monthLabel.set_style(`color: ${this.barColor}; font-weight: 600; margin-right: 6px;`);
		}
		this._monthBar.visible = showMonth;
		this._monthLabel.visible = showMonth;

		this._badgeBar.visible = showBadge;
		this._badgeLabel.visible = showBadge;

		if (!showBadge || !this._renderBadge())
			this._stopBlink();
		else
			this._startBlink();
	}

	// Draws the badge bar and countdown; returns true when the session is about to expire
	_renderBadge() {
		let badge = Calculation.getBadgeStatus(this._cachedData);
		let ratio = badge.ttlMs > 0 ? badge.remainingMs / badge.ttlMs : 0;
		let warning = badge.active && badge.remainingMs <= BADGE_WARNING_MS;

		if (warning) {
			let seconds = Math.ceil(badge.remainingMs / 1000);
			let countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
			this._fillBar(this._badgeBar, ratio, this.badgeAlertColor);
			this._badgeLabel.set_text(`Badge! ${countdown}`);
			this._badgeLabel.set_style(`color: ${this.badgeAlertColor}; font-weight: 700;`);
			return true;
		}

		this._fillBar(this._badgeBar, ratio, this.badgeColor);
		this._badgeLabel.set_text(badge.active ? Calculation.formatDuration(badge.remainingMs, true) : 'No session');
		this._badgeLabel.set_style(`color: ${badge.active ? this.badgeColor : '#9ca3af'}; font-weight: 600;`);
		return false;
	}

	// Blinks the badge bar and countdown, refreshing the countdown each tick until the warning ends
	_startBlink() {
		if (this._blinkTimeoutId) return;
		this._blinkTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, BLINK_INTERVAL_MS, () => {
			if (!this._badgeBar.visible || !this._renderBadge()) {
				this._blinkTimeoutId = null;
				this._stopBlink();
				return GLib.SOURCE_REMOVE;
			}
			this._blinkOn = !this._blinkOn;
			let opacity = this._blinkOn ? 60 : 255;
			this._badgeBar.opacity = opacity;
			this._badgeLabel.opacity = opacity;
			return GLib.SOURCE_CONTINUE;
		});
	}

	_stopBlink() {
		if (this._blinkTimeoutId) {
			GLib.source_remove(this._blinkTimeoutId);
			this._blinkTimeoutId = null;
		}
		this._blinkOn = false;
		if (this._badgeBar) this._badgeBar.opacity = 255;
		if (this._badgeLabel) this._badgeLabel.opacity = 255;
	}

	_fillBar(bar, ratio, color) {
		let fill = Math.round(BAR_WIDTH * Math.min(1, Math.max(0, ratio)));
		bar.fill.set_style(`width: ${fill}px; background-color: ${color};`);
		bar.fill.visible = fill > 0;
	}

	// Back to the plain label, for status messages (connecting, login...)
	_hideBars() {
		this._stopBlink();
		this._label.show();
		[this._monthBar, this._monthLabel, this._badgeBar, this._badgeLabel].forEach((w) => w.hide());
	}

	_applyGradientCurve(t) {
		switch (this.colorGradient) {
			// Baseline
			case 'linear':       return t;
			// Decelerating
			case 'ease-out':     return 1 - (1 - t) ** 2;
			case 'cosine':       return Math.sin(t * Math.PI / 2);
			// S-curves
			case 'sine':         return (1 - Math.cos(t * Math.PI)) / 2;
			case 'smoothstep':   return t * t * (3 - 2 * t);
			case 'ease-in-out':  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
			case 'smootherstep': return t * t * t * (t * (t * 6 - 15) + 10);
			// Accelerating
			case 'quadratic':    return t ** 2;
			case 'cubic':        return t ** 3;
			case 'circular':     return 1 - Math.sqrt(1 - t * t);
			case 'bounce': {
				if (t < 1 / 2.75) return 7.5625 * t * t;
				if (t < 2 / 2.75) { t -= 1.5 / 2.75;   return 7.5625 * t * t + 0.75; }
				if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
				t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
			}
			case 'exponential':
			default:             return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
		}
	}

	_interpolateColor(percentage) {
		let parseHex = (hex) => ({
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
		});

		let toHex = (n) => {
			let hex = Math.round(n).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};

		let r, g, b;

		if (percentage < 1.0) {
			let start = parseHex(this.startColor);
			let end = parseHex(this.endColor);
			let t = this._applyGradientCurve(percentage);
			r = start.r + (end.r - start.r) * t;
			g = start.g + (end.g - start.g) * t;
			b = start.b + (end.b - start.b) * t;
		} else {
			let ahead = parseHex(this.aheadColor);
			r = ahead.r;
			g = ahead.g;
			b = ahead.b;
		}

		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}
}

function init() {
	return new LogWidget();
}
