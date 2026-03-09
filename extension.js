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

const username = GLib.get_user_name();

class LogWidget {
	constructor() {
		let saved = MyStorage.loadDays();
		this.bonusDays = saved.bonusDays;
		this.giftDays = saved.giftDays;
		this.showMinutes = saved.showMinutes !== undefined ? saved.showMinutes : true;
		this.displayFormat = saved.displayFormat || 'ratio';
		this.showCurrentDay = saved.showCurrentDay !== undefined ? saved.showCurrentDay : false;
		this.birthDate = saved.birthDate || '';
		this.showMoney = saved.showMoney !== undefined ? saved.showMoney : false;
		this.colorGradient = saved.colorGradient || 'exponential';
		this.startColor = saved.startColor || '#ef4444';
		this.endColor = saved.endColor || '#4ade80';
		this.aheadColor = saved.aheadColor || '#00c8ff';
		this._refreshTimeoutId = null;
		this._tokenRefreshTimeoutId = null;
		this._checkTimeout = null;
		this._cachedData = null;
		this._fileMonitor = null;
		this._credsMonitor = null;
		this._updateAvailable = false;

		Debug.logInfo(`Loaded from storage: bonus=${this.bonusDays}, gift=${this.giftDays}`);
	}

	enable() {
		Menu.setupApp(this);
		this._setupStorageMonitoring();
		this._apiMethod();

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
		[this._fileMonitor, this._credsMonitor].forEach((m) => {
			if (m) m.cancel();
		});
		this._fileMonitor = null;
		this._credsMonitor = null;

		[this._refreshTimeoutId, this._tokenRefreshTimeoutId, this._checkTimeout].forEach((id) => {
			if (id) GLib.source_remove(id);
		});
		this._refreshTimeoutId = null;
		this._tokenRefreshTimeoutId = null;
		this._checkTimeout = null;

		if (this._indicator) {
			this._indicator.destroy();
			this._indicator = null;
		}
	}

	_setupStorageMonitoring() {
		this._fileMonitor = Settings.setupStorageMonitoring(() => {
			let saved = MyStorage.loadDays();
			this.bonusDays = saved.bonusDays;
			this.giftDays = saved.giftDays;
			this.showMinutes = saved.showMinutes;
			this.displayFormat = saved.displayFormat || 'ratio';
			this.showCurrentDay = saved.showCurrentDay !== undefined ? saved.showCurrentDay : false;
			this.birthDate = saved.birthDate || '';
			this.showMoney = saved.showMoney !== undefined ? saved.showMoney : false;
			this.colorGradient = saved.colorGradient || 'exponential';
			this.startColor = saved.startColor;
			this.endColor = saved.endColor;
			this.aheadColor = saved.aheadColor;
			Debug.logInfo(`Settings reloaded: format=${this.displayFormat}`);
			this._updateLogtime();
		});

		let credsFile = Gio.File.new_for_path(MyStorage.CREDENTIALS_FILE);
		let credsDir = Gio.File.new_for_path(GLib.path_get_dirname(MyStorage.CREDENTIALS_FILE));
		this._credsMonitor = credsDir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
		this._credsMonitor.connect('changed', (_monitor, file, _otherFile, eventType) => {
			if (file && file.equal(credsFile)) {
				Debug.logInfo(`Credentials changed (Event: ${eventType}), reconnecting...`);
				GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
					this._apiMethod();
					return GLib.SOURCE_REMOVE;
				});
			}
		});
	}

	_apiMethod() {
		let creds = MyStorage.loadCredentials();
		if (!creds.clientId || !creds.clientSecret) {
			this._label.set_text('Set API keys in Settings');
			this._label.set_style('color: #f59e0b; font-weight: 600;');
			Gio.AppInfo.launch_default_for_uri('https://github.com/SaruM4N3/LogtimeWidget#first-time-setup', null);
			return;
		}

		Connect.get_access_token(creds.clientId, creds.clientSecret, (token) => {
			if (!token) {
				this._label.set_text('Auth failed: check API keys');
				this._label.set_style('color: #ef4444; font-weight: 600;');
				return;
			}

			Debug.logSuccess('Got access token, starting periodic refresh');
			this._label.set_text('✓ Connected');
			this._label.set_style('color: #10b981; font-weight: 600;');

			const apiUrl = `https://api.intra.42.fr/v2/users/${username}/locations?per_page=100`;

			if (this._refreshTimeoutId) {
				GLib.source_remove(this._refreshTimeoutId);
				this._refreshTimeoutId = null;
			}
			if (this._tokenRefreshTimeoutId) {
				GLib.source_remove(this._tokenRefreshTimeoutId);
				this._tokenRefreshTimeoutId = null;
			}

			this._refreshTimeoutId = Data.startPeriodicRefresh(
				apiUrl,
				token,
				60,
				(data) => {
					this._cachedData = data;
					this._updateLogtime();
				},
				() => {
					this._label.set_text('Token expired, reconnecting...');
					this._apiMethod();
				}
			);

			// Proactively refresh the token after 1h50 (token expires in 2h)
			this._tokenRefreshTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 6600, () => {
				Debug.logInfo('Proactive token refresh');
				this._apiMethod();
				return GLib.SOURCE_REMOVE;
			});
		});
	}

	_updateLogtime() {
		if (!this._cachedData) {
			Debug.logWarn('No cached data yet, will update on next refresh...');
			return;
		}

		let result = Calculation.formatTimeDisplay(
			this._cachedData,
			this.bonusDays || 0,
			this.giftDays || 0,
			this.showMinutes,
			this.displayFormat,
			this.showCurrentDay,
			this.birthDate,
			this.showMoney
		);

		this._label.set_text(result.text);

		let percentage = Math.min(1.0, Math.max(0.0, result.totalHours / result.workingHours));
		this._label.set_style(`color: ${this._interpolateColor(percentage)}; font-weight: 600;`);

		Debug.logSuccess(`Updated: ${result.text} [minutes:${this.showMinutes}, format:${this.displayFormat}]`);
	}

	_applyGradientCurve(t) {
		switch (this.colorGradient) {
			case 'linear':      return t;
			case 'quadratic':   return t ** 2;
			case 'cubic':       return t ** 3;
			case 'sine':        return (1 - Math.cos(t * Math.PI)) / 2;
			case 'smoothstep':  return t * t * (3 - 2 * t);
			case 'circular':    return 1 - Math.sqrt(1 - t * t);
			case 'bounce': {
				if (t < 1 / 2.75) return 7.5625 * t * t;
				if (t < 2 / 2.75) { t -= 1.5 / 2.75;   return 7.5625 * t * t + 0.75; }
				if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
				t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
			}
			case 'exponential':
			default:            return t ** 2.5;
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
