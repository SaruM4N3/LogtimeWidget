/* settings.js
 * Settings monitoring utilities
 */
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { MyStorage } = Me.imports.data.storage;
const { Debug } = Me.imports.utils.debug;

// onChangeCallback runs when the settings file changes, onBlinkTest when Settings asks for a blink test
function setupStorageMonitoring(onChangeCallback, onBlinkTest) {
    let dirPath = GLib.path_get_dirname(MyStorage.STORAGE_FILE);
    let dir = Gio.File.new_for_path(dirPath);
    let storageFileObj = Gio.File.new_for_path(MyStorage.STORAGE_FILE);
    let blinkTestFileObj = Gio.File.new_for_path(MyStorage.BLINK_TEST_FILE);

    let monitor = dir.monitor_directory(Gio.FileMonitorFlags.NONE, null);

    monitor.connect('changed', (_monitor, file, _otherFile, eventType) => {
        if (file && file.equal(storageFileObj)) {
            Debug.logInfo(`Storage file changed (Event: ${eventType})`);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                if (onChangeCallback) onChangeCallback();
                return GLib.SOURCE_REMOVE;
            });
        } else if (file && file.equal(blinkTestFileObj) &&
            eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT) {
            if (onBlinkTest) onBlinkTest();
        }
    });

    return monitor;
}

var Settings = {
    setupStorageMonitoring,
};
