const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Me = ExtensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const Updater = Me.imports.connect.updater;
const PopupMenu = imports.ui.popupMenu;
const Soup = imports.gi.Soup;
const St = imports.gi.St;

const { Connect } = Me.imports.connect.connect;
const { Data } = Me.imports.data.data;
const { MyStorage } = Me.imports.data.storage;
const { Calculation } = Me.imports.utils.calculation;
const { Settings } = Me.imports.utils.settings;
const { Debug } = Me.imports.utils.debug;

// CONST VAR
const AppName = '[LogtimeWidget]';
const username = GLib.get_user_name();

/*-------------------------------------------FUNCTIONS-------------------------------------------------*/

class LogWidget {
	constructor() {
		let saved = MyStorage.loadDays();
		this.bonusDays = saved.bonusDays;
		this.giftDays = saved.giftDays;
		this.showMinutes = saved.showMinutes !== undefined ? saved.showMinutes : true;
		this.displayFormat = saved.displayFormat || 'ratio';
		this.startColor = saved.startColor || '#ef4444';
		this.endColor = saved.endColor || '#4ade80';
		this.aheadColor = saved.aheadColor || '#00c8ff';
		this._refreshTimeoutId = null;
		this._tokenRefreshTimeoutId = null;
		this._cachedData = null;
		this._fileMonitor = null;
		this._updateAvailable = false;

		Debug.logInfo(`Loaded from storage: bonus=${this.bonusDays}, gift=${this.giftDays}, colors=[${this.startColor},${this.endColor},${this.aheadColor}]`);
	}

	enable() {
		Debug.logInfo(`enable called`);
		this._setupApp();
		this._setupStorageMonitoring();
		this._apiMethod();

		this.updateManager = new Updater.UpdateManager();

		this.checkTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
			this.updateManager.checkForUpdates((_count) => {
				this._updateAvailable = true;
				this._updateLogtime();
				if (this.updateItem) {
					this.updateItem.label.text = `Update Available`;
					this.updateItem.actor.visible = true;
					this.updateItem.label.set_style('color: #4ade80; font-weight: bold;');
				}
			});
			return GLib.SOURCE_CONTINUE;
		});
	}

	disable() {
		if (this._fileMonitor) {
			this._fileMonitor.cancel();
			this._fileMonitor = null;
		}

		if (this._credsMonitor) {
			this._credsMonitor.cancel();
			this._credsMonitor = null;
		}

		if (this._refreshTimeoutId) {
			GLib.source_remove(this._refreshTimeoutId);
			this._refreshTimeoutId = null;
		}

		if (this._tokenRefreshTimeoutId) {
			GLib.source_remove(this._tokenRefreshTimeoutId);
			this._tokenRefreshTimeoutId = null;
		}

		if (this._indicator) {
			this._indicator.destroy();
			this._indicator = null;
		}
	}

	_setupApp() {
		this._indicator = new PanelMenu.Button(0.0, Me.metadata.name, false);

		this._box = new St.BoxLayout({
			vertical: false,
			style_class: 'logtime-box',
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			reactive: true,
			track_hover: true,
			x_expand: true,
			y_expand: true,
		});

		this._label = new St.Label({
			text: 'Connecting...',
			y_align: St.Align.MIDDLE,
		});

		this._box.add_child(this._label);
		this._indicator.add_child(this._box);
		Main.panel.addToStatusArea(AppName, this._indicator, 1, 'center');

		this._setupMenuItems();
	}

	_setupMenuItems() {
		this._refreshItem = this._createMenuItem('Refresh Manually', () => this._manualRefresh());
		this._restartItem = this._createMenuItem('Restart widget', () => this._restartWidget());
		this._reconnectItem = this._createMenuItem('Reconnect / Refresh Token', () => this._apiMethod());
		this._settingsItem = this._createMenuItem('Settings', () => this._openSettings());
		this._indicator.menu.addMenuItem(this._refreshItem);
		this._indicator.menu.addMenuItem(this._reconnectItem);
		this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this._setupBonusDaySubmenu();
		this._setupGiftDaySubmenu();
		this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this._indicator.menu.addMenuItem(this._restartItem);
		this._indicator.menu.addMenuItem(this._settingsItem);
		this.updateItem = new PopupMenu.PopupMenuItem('Update Available');
		this.updateItem.actor.visible = false;
		this.updateItem.connect('activate', () => {
			this.updateManager._performUpdate();
			this.updateItem.actor.visible = false;
			this.updateItem.label.text = "Updating...";
		});
		this._indicator.menu.addMenuItem(this.updateItem);
	}

	_createMenuItem(label, callback) {
		let item = new PopupMenu.PopupMenuItem(label);
		item.connect('activate', callback);
		return item;
	}

	_setupStorageMonitoring() {
		this._fileMonitor = Settings.setupStorageMonitoring(this, () => {
			let saved = MyStorage.loadDays();

			this.bonusDays = saved.bonusDays;
			this.giftDays = saved.giftDays;
			this.showMinutes = saved.showMinutes;
			this.displayFormat = saved.displayFormat || 'ratio';
			this.startColor = saved.startColor;
			this.endColor = saved.endColor;
			this.aheadColor = saved.aheadColor;

			Debug.logInfo(`Settings reloaded: format=${this.displayFormat}`);
			this._updateLogtime();
		});

		// Monitor credentials file and reconnect when it changes
		let credsFile = Gio.File.new_for_path(MyStorage.CREDENTIALS_FILE);
		let credsDir = Gio.File.new_for_path(GLib.path_get_dirname(MyStorage.CREDENTIALS_FILE));
		this._credsMonitor = credsDir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
		this._credsMonitor.connect('changed', (_monitor, file, _otherFile, eventType) => {
			if (file && file.equal(credsFile)) {
				Debug.logInfo(`Credentials file changed (Event: ${eventType}), reconnecting...`);
				GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
					this._apiMethod();
					return GLib.SOURCE_REMOVE;
				});
			}
		});
	}

	_setupBonusDaySubmenu() {
		this._bonusItem = new PopupMenu.PopupSubMenuMenuItem('Bonus Days');
		this._indicator.menu.addMenuItem(this._bonusItem);

		let controlItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
		let box = new St.BoxLayout({
			vertical: false,
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
		});

		let minusBtn = new St.Button({
			label: '−',
			style_class: 'button',
			x_expand: false,
		});
		minusBtn.connect('clicked', () => {
			if (this.bonusDays > 0) {
				this.bonusDays--;
				countLabel.set_text(String(this.bonusDays));
				MyStorage.saveDays(
					this.bonusDays,
					this.giftDays,
					this.showMinutes,
					this.displayFormat,
					this.startColor,
					this.endColor,
					this.aheadColor
				);
				Debug.logInfo(`Bonus days: ${this.bonusDays}`);
				this._setupStorageMonitoring();
			}
		});

		let countLabel = new St.Label({
			text: String(this.bonusDays),
			style: 'font-size: 14px; font-weight: bold; text-align: center; padding: 0 8px;',
			y_align: Clutter.ActorAlign.CENTER,
			x_align: Clutter.ActorAlign.CENTER,
		});

		let plusBtn = new St.Button({
			label: '+',
			style_class: 'button',
			x_expand: false,
		});
		plusBtn.connect('clicked', () => {
			this.bonusDays++;
			countLabel.set_text(String(this.bonusDays));
			MyStorage.saveDays(
				this.bonusDays,
				this.giftDays,
				this.showMinutes,
				this.displayFormat,
				this.startColor,
				this.endColor,
				this.aheadColor
			);
			Debug.logInfo(`Bonus days: ${this.bonusDays}`);
			this._setupStorageMonitoring();
		});

		box.add_child(minusBtn);
		box.add_child(countLabel);
		box.add_child(plusBtn);
		controlItem.actor.add_child(box);
		this._bonusItem.menu.addMenuItem(controlItem);
	}

	_setupGiftDaySubmenu() {
		this._giftItem = new PopupMenu.PopupSubMenuMenuItem('Gift Days');
		this._indicator.menu.addMenuItem(this._giftItem);

		let controlItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
		let box = new St.BoxLayout({
			vertical: false,
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
		});

		let minusBtn = new St.Button({
			label: '−',
			style_class: 'button',
			x_expand: false,
		});
		minusBtn.connect('clicked', () => {
			if (this.giftDays > 0) {
				this.giftDays--;
				countLabel.set_text(String(this.giftDays));
				MyStorage.saveDays(
					this.bonusDays,
					this.giftDays,
					this.showMinutes,
					this.displayFormat,
					this.startColor,
					this.endColor,
					this.aheadColor
				);
				Debug.logInfo(`Gift days: ${this.giftDays}`);
				this._setupStorageMonitoring();
			}
		});

		let countLabel = new St.Label({
			text: String(this.giftDays),
			style: 'font-size: 14px; font-weight: bold; text-align: center; padding: 0 8px;',
			y_align: Clutter.ActorAlign.CENTER,
			x_align: Clutter.ActorAlign.CENTER,
		});

		let plusBtn = new St.Button({
			label: '+',
			style_class: 'button',
			x_expand: false,
		});
		plusBtn.connect('clicked', () => {
			this.giftDays++;
			countLabel.set_text(String(this.giftDays));
			MyStorage.saveDays(
				this.bonusDays,
				this.giftDays,
				this.showMinutes,
				this.displayFormat,
				this.startColor,
				this.endColor,
				this.aheadColor
			);
			Debug.logInfo(`Gift days: ${this.giftDays}`);
			this._setupStorageMonitoring();
		});

		box.add_child(minusBtn);
		box.add_child(countLabel);
		box.add_child(plusBtn);
		controlItem.actor.add_child(box);
		this._giftItem.menu.addMenuItem(controlItem);
	}

	_manualRefresh() {
		Debug.logDebug(`Menu: refresh selected`);
		this._apiMethod();
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

			Debug.logSuccess(`Got access token, starting periodic refresh`);
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
				this._label,
				apiUrl,
				token,
				60,
				() => this.showMinutes,
				() => this.displayFormat || 'ratio',
				() => this.bonusDays || 0,
				() => this.giftDays || 0,
				(data) => {
					this._cachedData = data;
					this._updateLogtime();
				},
				() => this._apiMethod()
			);

			// Proactively refresh the token after 1h50 (token expires in 2h)
			this._tokenRefreshTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 6600, () => {
				Debug.logInfo('Proactive token refresh');
				this._apiMethod();
				return GLib.SOURCE_REMOVE;
			});
		});
	}

	_restartWidget() {
		Debug.logDebug(`Restarting widget…`);
		const uuid = Me.metadata.uuid;
		const extension = Main.extensionManager.lookup(uuid);

		if (extension) {
			Main.extensionManager.disableExtension(uuid);
			Main.extensionManager.enableExtension(uuid);
			Debug.logSuccess(`Widget restarted successfully`);
		} else {
			Debug.logError(`Could not find extension: ${uuid}`);
		}
	}

	_openSettings() {
		Debug.logInfo('Opening extension settings');
		try {
			ExtensionUtils.openPrefs();
		} catch (e) {
			Debug.logError(`Failed to open settings: ${e}`);
		}
	}

	_updateLogtime() {
		if (!this._cachedData) {
			Debug.logWarn("No cached data yet, will update on next refresh...");
			return;
		}
		let result = Calculation.formatTimeDisplay(
			this._cachedData,
			this.bonusDays || 0,
			this.giftDays || 0,
			this.showMinutes,
			this.displayFormat
		);

		this._label.set_text(result.text);

		let percentage = Math.min(1.0, Math.max(0.0, result.totalHours / result.workingHours));
		let color = this._interpolateColor(percentage);
		this._label.set_style(`color: ${color}; font-weight: 600;`);

		let displayText = result.text;
		Debug.logDebug(`Update available ${this._updateAvailable}`);
		if (this._updateAvailable) {
			displayText += "  [UPDATE]";
		}
		Debug.logSuccess(`Updated: ${result.text} [minutes:${this.showMinutes}, format:${this.displayFormat}]`);
	}

	_interpolateColor(percentage) {
		let parseHex = (hex) => {
			let r = parseInt(hex.slice(1, 3), 16);
			let g = parseInt(hex.slice(3, 5), 16);
			let b = parseInt(hex.slice(5, 7), 16);
			return { r, g, b };
		};

		let toHex = (n) => {
			let hex = Math.round(n).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};

		let r, g, b;

		if (percentage < 1.0) {
			let startRGB = parseHex(this.startColor);
			let endRGB = parseHex(this.endColor);
			let easedPercentage = percentage ** 2.5;
			r = startRGB.r + (endRGB.r - startRGB.r) * easedPercentage;
			g = startRGB.g + (endRGB.g - startRGB.g) * easedPercentage;
			b = startRGB.b + (endRGB.b - startRGB.b) * easedPercentage;
		} else {
			let aheadRGB = parseHex(this.aheadColor);
			r = aheadRGB.r;
			g = aheadRGB.g;
			b = aheadRGB.b;
		}

		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}
}

function init() {
	return new LogWidget();
}
