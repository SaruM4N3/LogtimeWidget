/* storage.js
 * Persistent storage utilities
 */
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.utils.debug;

// Settings and session live outside the extension dir: it is a git checkout that
// updates reset and install.sh wipes, so nothing user-made should be kept in it
const DATA_DIR = GLib.build_filenamev([GLib.get_user_data_dir(), 'LogtimeWidget']);
const STORAGE_FILE = GLib.build_filenamev([DATA_DIR, 'settings.json']);
const SESSION_FILE = GLib.build_filenamev([DATA_DIR, 'session.json']);
// Browser data of the login window (keeps the intra login)
const WEBKIT_DIR = GLib.build_filenamev([DATA_DIR, 'webkit']);
// Written by the Settings "Test" button, watched by the extension to blink the badge bar
const BLINK_TEST_FILE = GLib.build_filenamev([DATA_DIR, 'blink_test']);

// Older versions kept their files in <extension>/utils/
const LEGACY_FILES = [
    [GLib.build_filenamev([Me.path, 'utils', 'saved_days.json']), STORAGE_FILE],
    [GLib.build_filenamev([Me.path, 'utils', 'session.json']), SESSION_FILE],
];

// Default colors
const DEFAULT_START_COLOR = '#fff000';
const DEFAULT_END_COLOR = '#47ff00';
const DEFAULT_AHEAD_COLOR = '#00c8ff';
const DEFAULT_BAR_COLOR = '#47ff00';
const DEFAULT_BADGE_COLOR = '#facc15';
const DEFAULT_BADGE_ALERT_COLOR = '#ef4444';
// Minutes before the session expires when the badge bar starts blinking
const DEFAULT_BADGE_WARNING_MINUTES = 15;

function ensureStorageDir() {
    GLib.mkdir_with_parents(DATA_DIR, 0o700);
}

// Copies files of older versions to DATA_DIR once (copy, not move: a shell that
// still runs the old code until its restart keeps reading them)
function migrateLegacyFiles() {
    ensureStorageDir();
    for (let [from, to] of LEGACY_FILES) {
        let source = Gio.File.new_for_path(from);
        let dest = Gio.File.new_for_path(to);
        if (dest.query_exists(null) || !source.query_exists(null)) continue;
        try {
            source.copy(dest, Gio.FileCopyFlags.NONE, null, null);
            Debug.logSuccess(`Migrated ${from} to ${to}`);
        } catch (e) {
            Debug.logError(`Failed to migrate ${from}: ${e.message}`);
        }
    }
}
migrateLegacyFiles();

// Keeps only known settings, falling back to defaults for missing ones
function withDefaults(settings) {
    let result = getDefaults();
    for (let key in result) {
        if (settings[key] !== undefined && settings[key] !== null && settings[key] !== '')
            result[key] = settings[key];
    }
    if (settings.birthDate !== undefined) result.birthDate = settings.birthDate;
    return result;
}

function saveSettings(settings) {
    try {
        ensureStorageDir();
        let data = JSON.stringify(withDefaults(settings), null, 2);
        let file = Gio.File.new_for_path(STORAGE_FILE);
        file.replace_contents(data, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        Debug.logSuccess(`Saved settings to ${STORAGE_FILE}`);
    } catch (e) {
        Debug.logError(`Failed to save settings: ${e}`);
    }
}

function loadSettings() {
    try {
        let file = Gio.File.new_for_path(STORAGE_FILE);
        if (!file.query_exists(null)) return getDefaults();

        let [success, contents] = file.load_contents(null);
        if (success) {
            let data = JSON.parse(ByteArray.toString(contents));
            // Older versions: 'bar' display format, then a showBar toggle
            if (data.displayFormat === 'bar') {
                data.displayFormat = 'ratio';
                data.showBar = true;
            }
            if (!data.displayMode && data.showBar !== undefined)
                data.displayMode = data.showBar ? 'combined' : 'text';
            return withDefaults(data);
        }
    } catch (e) {
        Debug.logError(`Failed to load settings: ${e.message}`);
    }
    return getDefaults();
}

function getDefaults() {
    return {
        showMinutes: true,
        displayFormat: 'all',
        startColor: DEFAULT_START_COLOR,
        endColor: DEFAULT_END_COLOR,
        aheadColor: DEFAULT_AHEAD_COLOR,
        showCurrentDay: false,
        birthDate: '',
        showMoney: true,
        colorGradient: 'ease-out',
        displayMode: 'bar',
        panelPosition: 'right',
        barColor: DEFAULT_BAR_COLOR,
        badgeColor: DEFAULT_BADGE_COLOR,
        badgeAlertColor: DEFAULT_BADGE_ALERT_COLOR,
        badgeWarningMinutes: DEFAULT_BADGE_WARNING_MINUTES,
    };
}

function loadSession() {
    try {
        let file = Gio.File.new_for_path(SESSION_FILE);
        if (!file.query_exists(null)) return { cookie: '' };
        let [success, contents] = file.load_contents(null);
        if (success) return JSON.parse(ByteArray.toString(contents));
    } catch (e) {
        Debug.logError(`Failed to load session: ${e}`);
    }
    return { cookie: '' };
}

// Removes the saved cookie and the login window's browser data, so the next login asks for intra credentials
function clearSession() {
    try {
        let file = Gio.File.new_for_path(SESSION_FILE);
        if (file.query_exists(null)) file.delete(null);
        GLib.spawn_command_line_sync(`rm -rf ${GLib.shell_quote(WEBKIT_DIR)}`);
        Debug.logSuccess('Session cleared');
    } catch (e) {
        Debug.logError(`Failed to clear session: ${e}`);
    }
}

// Asks the running extension to blink the badge bar for a few seconds
function requestBlinkTest() {
    try {
        ensureStorageDir();
        Gio.File.new_for_path(BLINK_TEST_FILE).replace_contents(
            `${Date.now()}`, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    } catch (e) {
        Debug.logError(`Failed to request blink test: ${e}`);
    }
}

var MyStorage = {
    saveSettings: saveSettings,
    loadSettings: loadSettings,
    loadSession: loadSession,
    clearSession: clearSession,
    requestBlinkTest: requestBlinkTest,
    STORAGE_FILE: STORAGE_FILE,
    SESSION_FILE: SESSION_FILE,
    WEBKIT_DIR: WEBKIT_DIR,
    BLINK_TEST_FILE: BLINK_TEST_FILE
};
