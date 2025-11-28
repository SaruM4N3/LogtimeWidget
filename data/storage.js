/* storage.js
 * Persistent storage utilities
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.utils.debug;

// Storage file path
const STORAGE_DIR = GLib.get_home_dir() + '/.config/LogtimeWidget';
const STORAGE_FILE = GLib.build_filenamev([STORAGE_DIR, 'saved_days.json']);

// Default colors
const DEFAULT_START_COLOR = '#ef4444';
const DEFAULT_END_COLOR = '#4ade80';
const DEFAULT_AHEAD_COLOR = '#00c8ff';

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
        });
        let file = Gio.File.new_for_path(STORAGE_FILE);

        file.replace_contents(
            data,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );

        Debug.logSuccess(`Saved: bonus=${bonusDays}, gift=${giftDays}, minutes=${showMinutes}, format=${displayFormat} for ${getCurrentMonth()}`);
    } catch (e) {
        Debug.logError(`Failed to save days: ${e.message}`);
    }
}

function loadDays() {
    try {
        let file = Gio.File.new_for_path(STORAGE_FILE);

        if (!file.query_exists(null)) {
            Debug.logInfo('No saved days found, starting at 0');
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

        let [success, contents] = file.load_contents(null);

        if (success) {
            let contentsString = ByteArray.toString(contents);
            let data = JSON.parse(contentsString);
            let currentMonth = getCurrentMonth();

            if (data.month === currentMonth) {
                Debug.logInfo(`Loaded: bonus=${data.bonusDays}, gift=${data.giftDays}, minutes=${data.showMinutes}, format=${data.displayFormat} for ${currentMonth}`);
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
                Debug.logInfo(`Month changed from ${data.month} to ${currentMonth}, resetting to 0`);
                saveDays(0, 0, true, 'ratio', DEFAULT_START_COLOR, DEFAULT_END_COLOR, DEFAULT_AHEAD_COLOR);
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
        }
    } catch (e) {
        Debug.logError(`Failed to load days: ${e.message}`);
    }

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

var Storage = {
    saveDays,
    loadDays
};
