/* storage.js
 * Persistent storage utilities
 */
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const ExtensionUtils = imports.misc.extensionUtils;
let Me;
try {
    Me = ExtensionUtils.getCurrentExtension();
} catch (e) {
    Me = null;
}
const { Debug } = Me.imports.utils.debug;



function getExtensionDir() {
    let path;
    if (Me) {
        path = Me.path;
    } else {
        path = GLib.build_filenamev([
            GLib.get_home_dir(),
            '.local/share/gnome-shell/extensions/LogtimeWidget@zsonie'
        ]);
    }
    return path;
}

// Storage file path
const STORAGE_DIR = getExtensionDir() + '/utils';
const STORAGE_FILE = GLib.build_filenamev([STORAGE_DIR, 'saved_days.json']);
const CREDENTIALS_FILE = GLib.build_filenamev([STORAGE_DIR, 'credentials.json']);

// Default colors
const DEFAULT_START_COLOR = '#ef4444';
const DEFAULT_END_COLOR = '#4ade80';
const DEFAULT_AHEAD_COLOR = '#00c8ff';

function ensureStorageDir() {
    let dir = Gio.File.new_for_path(STORAGE_DIR);
    if (!dir.query_exists(null)) {
        try {
            dir.make_directory_with_parents(null);
            Debug.logInfo(`Created storage directory: ${STORAGE_DIR}`);
        } catch (e) {
            Debug.logError(`Failed to create dir: ${e.message}`);
        }
    }
}

function getCurrentMonth() {
    let now = GLib.DateTime.new_now_local();
    return `${now.get_year()}-${now.get_month()}`;
}

function saveDays(bonusDays, giftDays, showMinutes, displayFormat, startColor, endColor, aheadColor, showCurrentDay, birthDate, showMoney) {
    try {
        ensureStorageDir();
        let data = JSON.stringify({
            bonusDays: bonusDays,
            giftDays: giftDays,
            showMinutes: showMinutes !== undefined ? showMinutes : true,
            displayFormat: displayFormat || 'ratio',
            startColor: startColor || DEFAULT_START_COLOR,
            endColor: endColor || DEFAULT_END_COLOR,
            aheadColor: aheadColor || DEFAULT_AHEAD_COLOR,
            showCurrentDay: showCurrentDay !== undefined ? showCurrentDay : false,
            birthDate: birthDate || '',
            showMoney: showMoney !== undefined ? showMoney : false,
            month: getCurrentMonth()
        }, null, 2);

        let file = Gio.File.new_for_path(STORAGE_FILE);
        file.replace_contents(data, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        Debug.logSuccess(`Saved settings to ${STORAGE_FILE}`);
    } catch (e) {
        Debug.logError(`Failed to save days: ${e}`);
    }
}

function loadDays() {
    try {
        let file = Gio.File.new_for_path(STORAGE_FILE);
        if (!file.query_exists(null)) {
            return getDefaults();
        }

        let [success, contents] = file.load_contents(null);
        if (success) {
            let data = JSON.parse(ByteArray.toString(contents));
            let currentMonth = getCurrentMonth();

            // Check if month changed
            if (data.month === currentMonth) {
                return {
                    bonusDays: data.bonusDays || 0,
                    giftDays: data.giftDays || 0,
                    showMinutes: data.showMinutes !== undefined ? data.showMinutes : true,
                    displayFormat: data.displayFormat || 'ratio',
                    startColor: data.startColor || DEFAULT_START_COLOR,
                    endColor: data.endColor || DEFAULT_END_COLOR,
                    aheadColor: data.aheadColor || DEFAULT_AHEAD_COLOR,
                    showCurrentDay: data.showCurrentDay !== undefined ? data.showCurrentDay : false,
                    birthDate: data.birthDate || '',
                    showMoney: data.showMoney !== undefined ? data.showMoney : false
                };
            } else {
                // Month changed - reset days but keep settings
                let defaults = getDefaults();
                defaults.displayFormat = data.displayFormat || 'ratio';
                defaults.showMinutes = data.showMinutes;
                defaults.startColor = data.startColor;
                defaults.endColor = data.endColor;
                defaults.aheadColor = data.aheadColor;
                defaults.showCurrentDay = data.showCurrentDay !== undefined ? data.showCurrentDay : false;
                defaults.birthDate = data.birthDate || '';
                defaults.showMoney = data.showMoney !== undefined ? data.showMoney : false;

                saveDays(0, 0, defaults.showMinutes, defaults.displayFormat,
                        defaults.startColor, defaults.endColor, defaults.aheadColor, defaults.showCurrentDay,
                        defaults.birthDate, defaults.showMoney);
                return defaults;
            }
        }
    } catch (e) {
        Debug.logError(`Failed to load days: ${e.message}`);
    }
    return getDefaults();
}

function getDefaults() {
    return {
        bonusDays: 0,
        giftDays: 0,
        showMinutes: true,
        displayFormat: 'ratio',
        startColor: DEFAULT_START_COLOR,
        endColor: DEFAULT_END_COLOR,
        aheadColor: DEFAULT_AHEAD_COLOR,
        showCurrentDay: false,
        birthDate: '',
        showMoney: false
    };
}

function saveCredentials(clientId, clientSecret) {
    try {
        ensureStorageDir();
        let data = JSON.stringify({ clientId: clientId, clientSecret: clientSecret }, null, 2);
        let file = Gio.File.new_for_path(CREDENTIALS_FILE);
        file.replace_contents(data, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        Debug.logSuccess(`Saved credentials to ${CREDENTIALS_FILE}`);
    } catch (e) {
        Debug.logError(`Failed to save credentials: ${e}`);
    }
}

function loadCredentials() {
    try {
        let file = Gio.File.new_for_path(CREDENTIALS_FILE);
        if (!file.query_exists(null)) return { clientId: '', clientSecret: '' };
        let [success, contents] = file.load_contents(null);
        if (success) return JSON.parse(ByteArray.toString(contents));
    } catch (e) {
        Debug.logError(`Failed to load credentials: ${e}`);
    }
    return { clientId: '', clientSecret: '' };
}

var MyStorage = {
    saveDays: saveDays,
    loadDays: loadDays,
    saveCredentials: saveCredentials,
    loadCredentials: loadCredentials,
    STORAGE_FILE: STORAGE_FILE,
    CREDENTIALS_FILE: CREDENTIALS_FILE
};
