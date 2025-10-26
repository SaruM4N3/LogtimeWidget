/* storage.js
 * Persistent storage utilities
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.debug;

// _Storage file path
const STORAGE_DIR = GLib.get_home_dir() + '/.config/LogtimeWidget';
const STORAGE_FILE = GLib.build_filenamev([STORAGE_DIR, 'saved_days.json']);

function ensureStorageDir() {
    let dir = Gio.File.new_for_path(STORAGE_DIR);
    if (!dir.query_exists(null)) {
        dir.make_directory_with_parents(null);
        Debug.logInfo(`Created storage directory: ${STORAGE_DIR}`);
    }
}

function getCurrentMonth() {
    let now = GLib.DateTime.new_now_local();
    return `${now.get_year()}-${now.get_month()}`;
}

function saveDays(bonusDays, giftDays) {
    try {
        ensureStorageDir();

        let data = JSON.stringify({
            bonusDays: bonusDays,
            giftDays: giftDays,
            month: getCurrentMonth()
        });
        let file = Gio.File.new_for_path(STORAGE_FILE);

        file.replace_contents(
            data,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );

        Debug.logSuccess(`Saved: bonus=${bonusDays}, gift=${giftDays} for ${getCurrentMonth()}`);
    } catch (e) {
        Debug.logError(`Failed to save days: ${e.message}`);
    }
}


function loadDays() {
    try {
        let file = Gio.File.new_for_path(STORAGE_FILE);

        if (!file.query_exists(null)) {
            Debug.logInfo('No saved days found, starting at 0');
            return { bonusDays: 0, giftDays: 0 };
        }

        let [success, contents] = file.load_contents(null);

        if (success) {
            // Convert Uint8Array to string properly
            let contentsString = ByteArray.toString(contents);
            let data = JSON.parse(contentsString);
            let currentMonth = getCurrentMonth();

            // Check if the saved month matches current month
            if (data.month === currentMonth) {
                Debug.logInfo(`Loaded: bonus=${data.bonusDays}, gift=${data.giftDays} for ${currentMonth}`);
                return {
                    bonusDays: data.bonusDays || 0,
                    giftDays: data.giftDays || 0
                };
            } else {
                Debug.logInfo(`Month changed from ${data.month} to ${currentMonth}, resetting to 0`);
                saveDays(0, 0);
                return { bonusDays: 0, giftDays: 0 };
            }
        }
    } catch (e) {
        Debug.logError(`Failed to load days: ${e.message}`);
    }

    return { bonusDays: 0, giftDays: 0 };
}

var _Storage = {
    saveDays,
    loadDays
};
