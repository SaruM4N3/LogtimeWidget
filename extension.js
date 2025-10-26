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

const { Calculation } = Me.imports.calculation;
const { Connect } = Me.imports.connect;
const { Data } = Me.imports.data;
const { Debug } = Me.imports.debug;
const { _Storage } = Me.imports.storage;

// DEBUGS
const AppName = '[LogtimeWidget]';

// CONST VAR
const username = GLib.get_user_name();

/*-------------------------------------------FUNCTIONS-------------------------------------------------*/

class LogWidget {
    constructor() {
        let saved = _Storage.loadDays();
        this.bonusDays = saved.bonusDays;
        this.giftDays = saved.giftDays;
        this._refreshTimeoutId = null;
        this._cachedData = null;
        this._testData = null;

        Debug.logInfo(`Loaded from storage: bonus=${this.bonusDays}, gift=${this.giftDays}`);
    }

    enable() {
        //Setup
        Debug.logInfo(`enable called`);
        this._setupApp();

        //Choose a method
        this._scrapMethod();
        // this.apiMethod();
    }

    disable() {
        if (this._refreshTimeoutId) {
            GLib.source_remove(this._refreshTimeoutId);
            this._refreshTimeoutId = null;
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
            text: 'Wait for login...',
            y_align: St.Align.MIDDLE,
            style_class: 'logtime-label',
        });

        this._box.add_child(this._label);
        this._indicator.add_child(this._box);
        Main.panel.addToStatusArea(AppName, this._indicator, 1, 'center');

        this._setupMenuItems();
    }
    _setupMenuItems() {


        this._refreshItem = this._createMenuItem('Refresh Manually', () => this._manualRefresh());
        this._restartItem = this._createMenuItem('Restart widget', () => this._restartWidget());
        this._loginItem = this._createMenuItem('Login', () => this._onLoginClicked());
        this._quitItem = this._createMenuItem('Quit widget', () => this._quitWidget());
        this._indicator.menu.addMenuItem(this._refreshItem);
        this._setupBonusDaySubmenu();
        this._setupGiftDaySubmenu();
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addMenuItem(this._loginItem);
        this._indicator.menu.addMenuItem(this._restartItem);
        this._indicator.menu.addMenuItem(this._quitItem);
    }

    _createMenuItem(label, callback) {
        let item = new PopupMenu.PopupMenuItem(label);
        item.connect('activate', callback);
        return item;
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
                _Storage.saveDays(this.bonusDays, this.giftDays);
                Debug.logInfo(`Bonus days: ${this.bonusDays}`);
                this._updateLogtime();
            }
        });

        // FIX: Add y_align for vertical centering
        let countLabel = new St.Label({
            text: String(this.bonusDays),
            style: 'font-size: 14px; font-weight: bold; text-align: center; padding: 0 8px;',
            y_align: Clutter.ActorAlign.CENTER,  // THIS IS KEY
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
            _Storage.saveDays(this.bonusDays, this.giftDays);
            Debug.logInfo(`Bonus days: ${this.bonusDays}`);
            this._updateLogtime();
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
                _Storage.saveDays(this.bonusDays, this.giftDays);
                Debug.logInfo(`Gift days: ${this.giftDays}`);
                this._updateLogtime();
            }
        });

        // FIX: Add y_align for vertical centering
        let countLabel = new St.Label({
            text: String(this.giftDays),
            style: 'font-size: 14px; font-weight: bold; text-align: center; padding: 0 8px;',
            y_align: Clutter.ActorAlign.CENTER,  // THIS IS KEY
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
            _Storage.saveDays(this.bonusDays, this.giftDays);
            Debug.logInfo(`Gift days: ${this.giftDays}`);
            this._updateLogtime();
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
        this._label.set_text(`Manual refresh at ${current_time.format("%H:%M:%S")}`);

        setTimeout(() => {
            this._scrapMethod();
            //this._apiMethod();
        }, 1000);
    }

    _checkCookieValidity(cookieValue) {
        return new Promise((resolve, reject) => {
            Debug.logInfo("Checking cookie validity");
            let session = new Soup.Session();
            let message = Soup.Message.new(
                'GET',
                `https://profile.intra.42.fr/users/${username}/locations_stats.json`
            );

            // Add the cookie header
            message.request_headers.append('Cookie', `_intra_42_session_production=${cookieValue}`);

            session.queue_message(message, (session, message) => {
                if (message.status_code === 200) {
                    try {
                        let response = message.response_body.data;
                        // Optional: validate response content if needed
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

    async _onLoginClicked() {
        Debug.logInfo('Login button clicked');

        // Check if cookie file already exists and is valid
        const cookieFile = Gio.File.new_for_path(
            GLib.build_filenamev([
                GLib.get_home_dir(),
                '.local/share/gnome-shell/extensions/LogtimeWidget@zsonie',
                'intra42_cookies.json'
            ])
        );

        if (cookieFile.query_exists(null)) {
            try {
                let [success, contents] = cookieFile.load_contents(null);
                if (success) {
                    const cookieValue = ByteArray.toString(contents).trim();

                    // Test if cookie is still valid by making a request
                    const testUrl = `https://profile.intra.42.fr/users/${username}/locations_stats.json`;
                    let session = new Soup.Session();
                    let message = Soup.Message.new('GET', testUrl);
                    message.request_headers.append('Cookie', `_intra_42_session_production=${cookieValue}`);

                    session.send_async(message, null, (session, result) => {
                        try {
                            let response = session.send_finish(result);
                            if (message.status_code === 200) {
                                // Cookie is valid
                                Debug.logSuccess('Cookie is still valid');
                                this._intra42Cookie = cookieValue;
                                this._label.set_text('✓ Logged In');
                                this._label.set_style('color: #10b981; font-weight: 600;');
                                this._scrapMethod();
                                return;
                            } else {
                                // Cookie invalid, need new login
                                Debug.logInfo('Cookie expired, opening login window');
                                this._executeCookieCapture();
                            }
                        } catch (e) {
                            Debug.logError(`Cookie validation failed: ${e}`);
                            this._executeCookieCapture();
                        }
                    });
                    return;
                }
            } catch (e) {
                Debug.logError(`Error reading cookie: ${e}`);
            }
        }

        // No cookie file or couldn't read it, start login flow
        this._executeCookieCapture();
    }

    _executeCookieCapture() {
        Debug.logInfo('Starting cookie capture...');

        const scriptPath = GLib.build_filenamev([
            GLib.get_home_dir(),
            '.local/share/gnome-shell/extensions/LogtimeWidget@zsonie',
            'capture_cookies.py'
        ]);

        try {
            // Use spawn_async with proper environment and flags
            let [success, pid] = GLib.spawn_async(
                null, // working directory (null = current)
                ['python3.10', scriptPath], // argv
                null, // envp (null = inherit parent environment)
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null // child setup function
            );

            if (success) {
                Debug.logSuccess(`Cookie capture script started with PID ${pid}`);
                this._label.set_text('Login in progress...');
                this._label.set_style('color: #3b82f6; font-weight: 600;');

                // Monitor child process
                GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
                    Debug.logInfo(`Cookie capture process exited with status ${status}`);
                    GLib.spawn_close_pid(pid);
                });

                // Start checking for cookie file
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
        const maxAttempts = 150; // 150 * 2 seconds = 5 minutes

        this._cookieCheckInterval = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            attempts++;

            const cookieFile = Gio.File.new_for_path(
                GLib.build_filenamev([
                    GLib.get_home_dir(),
                    '.local/share/gnome-shell/extensions/LogtimeWidget@zsonie',
                    'intra42_cookies.json'
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

                            // Trigger your scraping method or whatever comes next
                            this._scrapMethod();

                            return false; // Stop interval
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
                return false; // Stop interval
            }

            Debug.logInfo(`Checking for cookie file... attempt ${attempts}/${maxAttempts}`);
            return true; // Continue interval
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

    _quitWidget() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        Debug.logDebug(`Widget destroyed`);
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
            60,
            () => this.bonusDays || 0,
            () => this.giftDays || 0,
            (data) => {
                this._cachedData = data;
                Debug.logInfo('Data cached for instant updates');
            }
        );
    }

    _updateLogtime() {
        if (!this._cachedData) {
            Debug.logWarn('No cached data yet, will update on next refresh');
            return;
        }

        let result = Calculation.calculateMonthlyTotal(this._cachedData, this.bonusDays || 0, this.giftDays || 0);
        this._label.set_text(result.text);

        // Update color
        if (result.isOnTrack) {
            this._label.set_style('color: #4ade80; font-weight: 600;'); // Green
        } else {
            this._label.set_style('color: #ef4444; font-weight: 600;'); // Red
        }

        Debug.logSuccess(`Updated with bonus=${this.bonusDays}, gift=${this.giftDays}: ${result.text}`);
    }
}

function init() {
    return new LogWidget();
}
