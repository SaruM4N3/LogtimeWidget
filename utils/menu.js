/* menu.js
 * UI setup: panel button, menu items
 */

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const Me = ExtensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const { Debug } = Me.imports.utils.debug;

const APP_NAME = '[LogtimeWidget]';
const ATTENDANCE_URL = 'https://attendance.42lyon.fr/me';
// Index in the panel box: end of the left box, after the clock in the center, first in the right box
const PANEL_INDEX = { left: -1, center: 1, right: 0 };

function _panelBox(position) {
	return { left: Main.panel._leftBox, center: Main.panel._centerBox, right: Main.panel._rightBox }[position]
		|| Main.panel._centerBox;
}

function setupApp(widget) {
	widget._indicator = new PanelMenu.Button(0.0, Me.metadata.name, false);

	widget._box = new St.BoxLayout({
		vertical: false,
		style_class: 'logtime-box',
		x_align: Clutter.ActorAlign.CENTER,
		y_align: Clutter.ActorAlign.CENTER,
		reactive: true,
		track_hover: true,
		x_expand: true,
		y_expand: true,
	});

	widget._label = new St.Label({
		text: 'Connecting...',
		y_align: St.Align.MIDDLE,
	});

	// Progress bars (Show Progress Bar), filled by LogWidget._updateBars
	widget._monthBar = _createBar();
	widget._monthLabel = new St.Label({
		y_align: Clutter.ActorAlign.CENTER,
		visible: false,
	});
	widget._badgeBar = _createBar();
	widget._badgeLabel = new St.Label({
		y_align: Clutter.ActorAlign.CENTER,
		visible: false,
	});

	widget._box.add_child(widget._monthBar);
	widget._box.add_child(widget._monthLabel);
	widget._box.add_child(widget._label);
	widget._box.add_child(widget._badgeBar);
	widget._box.add_child(widget._badgeLabel);
	widget._indicator.add_child(widget._box);
	let position = PANEL_INDEX[widget.panelPosition] !== undefined ? widget.panelPosition : 'center';
	Main.panel.addToStatusArea(APP_NAME, widget._indicator, PANEL_INDEX[position], position);

	setupMenu(widget);
}

function setupMenu(widget) {
	widget._indicator.menu.addMenuItem(_createMenuItem('Refresh / Reconnect', () => widget._connect()));
	widget._indicator.menu.addMenuItem(_createMenuItem('Open Attendance', () => openAttendance()));
	widget._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	widget._indicator.menu.addMenuItem(_createMenuItem('Restart widget', () => restartWidget()));
	widget._indicator.menu.addMenuItem(_createMenuItem('Settings', () => openSettings()));

	widget.updateItem = new PopupMenu.PopupMenuItem('Update Available');
	widget.updateItem.actor.visible = false;
	widget.updateItem.connect('activate', () => {
		widget.updateManager._performUpdate();
		widget.updateItem.actor.visible = false;
		widget.updateItem.label.text = 'Updating...';
	});
	widget._indicator.menu.addMenuItem(widget.updateItem);
}

function _createBar() {
	let bar = new St.Widget({
		style_class: 'logtime-bar',
		y_align: Clutter.ActorAlign.CENTER,
		visible: false,
	});
	bar.fill = new St.Widget({ style_class: 'logtime-bar-fill' });
	bar.add_child(bar.fill);
	return bar;
}

function _createMenuItem(label, callback) {
	let item = new PopupMenu.PopupMenuItem(label);
	item.connect('activate', callback);
	return item;
}

function restartWidget() {
	Debug.logDebug('Restarting widget…');
	const uuid = Me.metadata.uuid;
	const extension = Main.extensionManager.lookup(uuid);

	if (extension) {
		Main.extensionManager.disableExtension(uuid);
		Main.extensionManager.enableExtension(uuid);
		Debug.logSuccess('Widget restarted successfully');
	} else {
		Debug.logError(`Could not find extension: ${uuid}`);
	}
}

// Opens the attendance page in the user's default browser
function openAttendance() {
	try {
		Gio.AppInfo.launch_default_for_uri(ATTENDANCE_URL, global.create_app_launch_context(0, -1));
	} catch (e) {
		Debug.logError(`Failed to open attendance: ${e}`);
	}
}

function openSettings() {
	try {
		ExtensionUtils.openPrefs();
	} catch (e) {
		Debug.logError(`Failed to open settings: ${e}`);
	}
}

// Moves the widget to another panel box without recreating it
function moveToPanel(widget, position) {
	if (!widget._indicator || PANEL_INDEX[position] === undefined) return;
	let container = widget._indicator.container;
	let box = _panelBox(position);
	if (container.get_parent() === box) return;
	if (container.get_parent()) container.get_parent().remove_child(container);
	let index = PANEL_INDEX[position];
	box.insert_child_at_index(container, index < 0 ? box.get_n_children() : index);
}

var Menu = {
	setupApp,
	moveToPanel,
};
