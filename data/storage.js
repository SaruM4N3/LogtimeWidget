/* storage.js
 * Persistent storage utilities
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const ExtensionUtils = imports.misc.extensionUtils;

// --- FIX 1: Safe Extension Path Detection ---
let Me;
try {
    Me = ExtensionUtils.getCurrentExtension();
} catch (e) {
    // Prefs context might fail here, we handle it below
}

function getExtensionDir() {
    if (Me) return Me.path;
    
    // Fallback for Prefs window (where Me is missing)
    // We assume the standard installation path relative to user home
    return GLib.build_filenamev([
        GLib.get_home_dir(), 
        '.local/share/gnome-shell/extensions/LogtimeWidget@zsonie'
    ]);
}


// --- FIX 2: Robust Logging ---
// If Me is missing (prefs), don't crash on Debug import
const Debug = Me ? Me.imports.utils.debug.Debug : {
    logInfo: (m) => global.log(`[Logtime] INFO: ${m}`),
    logError: (m) => global.log(`[Logtime] ERROR: ${m}`),
    logSuccess: (m) => global.log(`[Logtime] SUCCESS: ${m}`)
};

// Storage file path
const ROOT_DIR = getExtensionDir();
const STORAGE_DIR = ROOT_DIR + '/data';
// Using visible file for easier debugging
const STORAGE_FILE = GLib.build_filenamev([STORAGE_DIR, '.saved_days.json']); 

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

function saveDays(bonusDays, giftDays, showMinutes, displayFormat, startColor, endColor, aheadColor) {
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
            month: getCurrentMonth()
        }, null, 2);

        let file = Gio.File.new_for_path(STORAGE_FILE);
        file.replace_contents(data, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        Debug.logSuccess(`Saved settings for ${getCurrentMonth()}`);
    } catch (e) {
        Debug.logError(`Failed to save days: ${e.message}`);
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

            if (data.month === currentMonth) {
                return {
                    bonusDays: data.bonusDays || 0,
                    giftDays: data.giftDays || 0,
                    showMinutes: data.showMinutes !== undefined ? data.showMinutes : true,
                    displayFormat: data.displayFormat || 'ratio',
                    startColor: data.startColor || DEFAULT_START_COLOR,
                    endColor: data.endColor || DEFAULT_END_COLOR,
                    aheadColor: data.aheadColor || DEFAULT_AHEAD_COLOR
                };
            } else {
                // Month changed - reset days but keep settings
                Debug.logInfo(`New month (${currentMonth}), resetting days.`);
                let defaults = getDefaults();
                // Preserve settings
                defaults.displayFormat = data.displayFormat || 'ratio';
                defaults.showMinutes = data.showMinutes;
                defaults.startColor = data.startColor;
                defaults.endColor = data.endColor;
                defaults.aheadColor = data.aheadColor;
                
                saveDays(0, 0, defaults.showMinutes, defaults.displayFormat, 
                        defaults.startColor, defaults.endColor, defaults.aheadColor);
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
        aheadColor: DEFAULT_AHEAD_COLOR
    };
}

var MyStorage = {
    saveDays: saveDays,
    loadDays: loadDays,
    STORAGE_FILE: STORAGE_FILE
};
