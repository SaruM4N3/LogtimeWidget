/* settings.js
 * Settings monitoring utilities
 */
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { MyStorage } = Me.imports.data.storage;
const { Debug } = Me.imports.utils.debug;

/**
 * Setup file monitoring for storage changes
 * @param {LogWidget} widget - The LogWidget instance to update
 * @returns {Gio.FileMonitor} The file monitor instance
 */
function setupStorageMonitoring(extension, onChangeCallback) {
    let dirPath = GLib.path_get_dirname(MyStorage.STORAGE_FILE);
    let dir = Gio.File.new_for_path(dirPath);
    
    let storageFileObj = Gio.File.new_for_path(MyStorage.STORAGE_FILE);
    
    let monitor = dir.monitor_directory(Gio.FileMonitorFlags.NONE, null);

    monitor.connect('changed', (monitor, file, otherFile, eventType) => {
        if (file && file.equal(storageFileObj)) {
            Debug.logInfo(`Storage file changed (Event: ${eventType})`);
            
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                if (onChangeCallback) {
                    onChangeCallback();
                } else {
                    extension._updateLogtime();
                }
                return GLib.SOURCE_REMOVE;
            });
        }
    });
    
    return monitor;
}

var Settings = {
    setupStorageMonitoring,
};
