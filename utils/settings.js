/* settings.js
 * Settings monitoring utilities
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { MyStorage } = Me.imports.data.storage;
const { Debug } = Me.imports.utils.debug;

const STORAGE_DIR = Me.path + '/data';
const STORAGE_FILE = GLib.build_filenamev([STORAGE_DIR, '.saved_days.json']);

/**
 * Setup file monitoring for storage changes
 * @param {LogWidget} widget - The LogWidget instance to update
 * @returns {Gio.FileMonitor} The file monitor instance
 */
function setupStorageMonitoring(extension, onChangeCallback) {
    let file = Gio.File.new_for_path(Storage.STORAGE_FILE);
    let monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);

    monitor.connect('changed', (file, otherFile, eventType) => {
        if (eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT || 
            eventType === Gio.FileMonitorEvent.CHANGED) {
            
            // If a callback is provided, use it (to reload settings)
            if (onChangeCallback) {
                onChangeCallback();
            } else {
                // Fallback for old behavior
                extension._updateLogtime();
            }
        }
    });
    
    return monitor;
}

var Settings = {
	setupStorageMonitoring,
};
