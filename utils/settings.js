/* settings.js
 * Settings monitoring utilities
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Storage } = Me.imports.data.storage;
const { Debug } = Me.imports.utils.debug;

const STORAGE_DIR = Me.path + '/data';
const STORAGE_FILE = GLib.build_filenamev([STORAGE_DIR, '.saved_days.json']);

/**
 * Setup file monitoring for storage changes
 * @param {LogWidget} widget - The LogWidget instance to update
 * @returns {Gio.FileMonitor} The file monitor instance
 */
function setupStorageMonitoring(widget) {
	const storageFile = Gio.File.new_for_path(STORAGE_FILE);

	try {
		let fileMonitor = storageFile.monitor_file(Gio.FileMonitorFlags.NONE, null);

		fileMonitor.connect('changed', (monitor, file, otherFile, eventType) => {
			if (eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
				eventType === Gio.FileMonitorEvent.CREATED) {

				Debug.logInfo('Storage file changed, reloading...');

				let saved = Storage.loadDays();
				widget.bonusDays = saved.bonusDays;
				widget.giftDays = saved.giftDays;
				widget.showMinutes = saved.showMinutes !== undefined ? saved.showMinutes : true;
				widget.displayFormat = saved.displayFormat || 'ratio';
				widget.startColor = saved.startColor || '#ef4444';
				widget.endColor = saved.endColor || '#4ade80';
				widget.aheadColor = saved.aheadColor || '#00c8ff';

				widget._updateLogtime();

				Debug.logSuccess(`Reloaded with custom colors`);
			}
		});

		Debug.logInfo('Storage file monitoring enabled');
		return fileMonitor;

	} catch (e) {
		Debug.logError(`Failed to setup file monitoring: ${e}`);
		return null;
	}
}

var Settings = {
	setupStorageMonitoring,
};
