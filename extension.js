const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Me = ExtensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const Calendar = imports.ui.calendar;
const PopupMenu = imports.ui.popupMenu;
const Soup = imports.gi.Soup;
const St = imports.gi.St;
const ByteArray = imports.byteArray;

const { Connect } = Me.imports.connect.connect;
const Updater = Me.imports.connect.updater;
const { Data } = Me.imports.data.data;
const { MyStorage } = Me.imports.data.storage;
const { Calculation } = Me.imports.utils.calculation;
const { Settings } = Me.imports.utils.settings;
const { Debug } = Me.imports.utils.debug;

let updateManager;

// DEBUGS
const AppName = '[LogtimeWidget]';

// CONST VAR
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
		this._cachedData = null;
		this._testData = null;
		this._fileMonitor = null;
		this._updateAvailable = false;

		Debug.logInfo(`Loaded from storage: bonus=${this.bonusDays}, gift=${this.giftDays}, colors=[${this.startColor},${this.endColor},${this.aheadColor}]`);
	}

	enable() {
		Debug.logInfo(`enable called`);
		this._setupApp();
		this._setupStorageMonitoring();
		this._validateAndLoginIfNeeded();

		this.updateManager = new Updater.UpdateManager();

		this.checkTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
			this.updateManager.checkForUpdates((count) => {
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

		if (this._refreshTimeoutId) {
			GLib.source_remove(this._refreshTimeoutId);
			this._refreshTimeoutId = null;
		}

		if (this._indicator) {
			this._indicator.destroy();
			this._indicator = null;
		}
		updateManager = null;
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
			text: 'Wait for login...',
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
		this._loginItem = this._createMenuItem('Force Login Manually', () => this._onLoginClicked());
		this._settingsItem = this._createMenuItem('Settings', () => this._openSettings());
		this._indicator.menu.addMenuItem(this._refreshItem);
		this._indicator.menu.addMenuItem(this._loginItem);
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
				// this._updateLogtime();
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
			// this._updateLogtime();
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
				// this._updateLogtime();
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
			// this._updateLogtime();
		});

		box.add_child(minusBtn);
		box.add_child(countLabel);
		box.add_child(plusBtn);
		controlItem.actor.add_child(box);
		this._giftItem.menu.addMenuItem(controlItem);
	}

	_manualRefresh() {
		Debug.logDebug(`Menu: refresh selected`);

		let current_time = GLib.DateTime.new_now_local();
		let timeStr = '??:??:??';

		if (current_time) {
			timeStr = current_time.format("%H:%M:%S");
		} else {
			Debug.logError('GLib.DateTime.new_now_local() returned null in _manualRefresh');
		}

		this._label.set_text(`Manual refresh at ${timeStr}`);

		setTimeout(() => {
			this._scrapMethod();
		}, 1000);
	}


	_checkCookieValidity(cookieValue) {
		return new Promise((resolve, reject) => {
			Debug.logInfo("Checking cookie validity");
			let session = new Soup.Session();
			let message = Soup.Message.new(
				'GET',
				`https://translate.intra.42.fr/users/${username}/locations_stats.json`
			);

			message.request_headers.append('Cookie', `_intra_42_session_production=${cookieValue}`);

			session.queue_message(message, (session, message) => {
				if (message.status_code === 200) {
					try {
						let response = message.response_body.data;
						resolve(true);
					} catch (e) {
						resolve(false);
					}
				} else {
					resolve(false);
				}
			});
		});
	}

	_validateAndLoginIfNeeded() {
		Debug.logInfo('Checking for existing valid cookie...');

		const cookieFile = Gio.File.new_for_path(
			GLib.build_filenamev([
				GLib.get_home_dir(),
				'.local/share/gnome-shell/extensions/LogtimeWidget@zsonie',
				'utils/.intra42_cookies.json'
			])
		);

		if (!cookieFile.query_exists(null)) {
			Debug.logInfo('No cookie file found, opening login');
			this._executeCookieCapture();
			return;
		}

		try {
			let [success, contents] = cookieFile.load_contents(null);
			if (!success || contents.length === 0) {
				Debug.logInfo('Cookie file empty, opening login');
				this._executeCookieCapture();
				return;
			}

			const cookieValue = ByteArray.toString(contents).trim();

			if (cookieValue.length === 0) {
				Debug.logInfo('Cookie file empty, opening login');
				this._executeCookieCapture();
				return;
			}

			this._label.set_text('Validating cookie...');
			const testUrl = `https://translate.intra.42.fr/users/${username}/locations_stats.json`;
			let session = new Soup.Session();
			let message = Soup.Message.new('GET', testUrl);
			message.request_headers.append('Cookie', `_intra_42_session_production=${cookieValue}`);

			session.queue_message(message, (sess, msg) => {
				Debug.logInfo(`Cookie validation status: ${msg.status_code}`);

				if (msg.status_code === 200) {
					Debug.logSuccess(`Cookie valid, using existing session`);
					this._intra42Cookie = cookieValue;
					this._label.set_text(`✓ Logged in`);
					this._label.set_style('color: #10b981; font-weight: 600;');
					this._scrapMethod();
				} else {
					Debug.logInfo(`Cookie invalid (status ${msg.status_code}), opening login`);
					this._label.set_text('Cookie expired, logging in...');
					this._label.set_style('color: #ef4444; font-weight: 600;');
					Data.deleteCookiesFile();
					this._executeCookieCapture();
				}
			});
		} catch (e) {
			Debug.logError(`Cookie read error: ${e}, opening login`);
			this._label.set_text('Error reading cookie');
			this._label.set_style('color: #ef4444; font-weight: 600;');
			Data.deleteCookiesFile();
			this._executeCookieCapture();
		}
	}

	_onLoginClicked() {
		Debug.logInfo('Manual login requested');
		this._label.set_text('Starting login...');
		Data.deleteCookiesFile();
		this._executeCookieCapture();
	}

	_executeCookieCapture() {
		Debug.logInfo('Starting cookie capture...');

		const scriptPath = GLib.build_filenamev([
			GLib.get_home_dir(),
			'.local/share/gnome-shell/extensions/LogtimeWidget@zsonie',
			'connect/capture_cookies.py'
		]);

		try {
			let [success, pid] = GLib.spawn_async(
				null,
				['python3.10', scriptPath],
				null,
				GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
				null
			);

			if (success) {
				Debug.logSuccess(`Cookie capture script started with PID ${pid}`);
				this._label.set_text('Login in progress...');
				this._label.set_style('color: #3b82f6; font-weight: 600;');

				GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
					Debug.logInfo(`Cookie capture process exited with status ${status}`);
					GLib.spawn_close_pid(pid);
				});

				this._checkCookieFileRepeatedly();
			} else {
				Debug.logError('Failed to spawn cookie capture process');
				this._label.set_text('Login Failed');
				this._label.set_style('color: #ef4444; font-weight: 600;');
			}

		} catch (e) {
			Debug.logError(`Failed to execute cookie capture: ${e}`);
			this._label.set_text('Login Failed');
			this._label.set_style('color: #ef4444; font-weight: 600;');
		}
	}

	_checkCookieFileRepeatedly() {
		let attempts = 0;
		const maxAttempts = 150;

		this._cookieCheckInterval = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
			attempts++;

			const cookieFile = Gio.File.new_for_path(
				GLib.build_filenamev([
					GLib.get_home_dir(),
					'.local/share/gnome-shell/extensions/LogtimeWidget@zsonie',
					'utils/.intra42_cookies.json'
				])
			);

			if (cookieFile.query_exists(null)) {
				try {
					let [success, contents] = cookieFile.load_contents(null);
					if (success && contents.length > 0) {
						const decoder = new TextDecoder();
						const cookieValue = decoder.decode(contents).trim();

						if (cookieValue.length > 0) {
							Debug.logSuccess(`Cookie loaded: ${cookieValue}`);
							this._intra42Cookie = cookieValue;
							this._label.set_text('✓ Logged In');
							this._label.set_style('color: #10b981; font-weight: 600;');
							this._scrapMethod();

							return false;
						}
					}
				} catch (e) {
					Debug.logError(`Error reading cookie file: ${e}`);
				}
			}

			if (attempts >= maxAttempts) {
				Debug.logError('Cookie capture timeout');
				this._label.set_text('Login Timeout');
				this._label.set_style('color: #ef4444; font-weight: 600;');
				return false;
			}

			Debug.logInfo(`Checking for cookie file... attempt ${attempts}/${maxAttempts}`);
			return true;
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

	_apiMethod() {
		Connect.get_access_token(CLIENT_ID, CLIENT_SECRET, (token) => {
			if (token) {
				const apiUrl = `https://api.intra.42.fr/v2/users/${username}/locations_stats`;
				if (this._refreshTimeoutId) {
					GLib.source_remove(this._refreshTimeoutId);
				}
				this._refreshTimeoutId = Data.startPeriodicRefresh(
					this._label,
					apiUrl,
					token,
					60,
					() => this.bonusDays || 0,
					() => this.giftDays || 0,
					(data) => {
						this._cachedData = data;
						Debug.logInfo('Data cached for instant updates');
					}
				);
			} else {
				this._label.set_text('Failed to get token.');
			}
		});
	}

	_scrapMethod() {
		if (this._refreshTimeoutId) {
			GLib.source_remove(this._refreshTimeoutId);
		}

		this._refreshTimeoutId = Data.scrapedPeriodicRefresh(
			this._label,
			this._intra42Cookie,
			10,
			() => this.showMinutes || true,
			() => this.displayFormat || "ratio",
			() => this.bonusDays || 0,
			() => this.giftDays || 0,
			(data) => {
				this._cachedData = data;
				Debug.logInfo('Data cached for instant updates');
				this._updateLogtime();
			}
		);
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
