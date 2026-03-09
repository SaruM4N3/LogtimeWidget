/* menu.js
 * UI setup: panel button, menu items, day submenus
 */

const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const Me = ExtensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const { MyStorage } = Me.imports.data.storage;
const { Calculation } = Me.imports.utils.calculation;
const { Debug } = Me.imports.utils.debug;

const APP_NAME = '[LogtimeWidget]';

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

	widget._box.add_child(widget._label);
	widget._indicator.add_child(widget._box);
	Main.panel.addToStatusArea(APP_NAME, widget._indicator, 1, 'center');

	setupMenu(widget);
}

function setupMenu(widget) {
	widget._indicator.menu.addMenuItem(_createMenuItem('Refresh / Reconnect', () => widget._apiMethod()));
	widget._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	_setupDaySubmenu(widget, 'Bonus Days', () => widget.bonusDays, (v) => { widget.bonusDays = v; });
	_setupDaySubmenu(widget, 'Gift Days', () => widget.giftDays, (v) => { widget.giftDays = v; });
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

function _createMenuItem(label, callback) {
	let item = new PopupMenu.PopupMenuItem(label);
	item.connect('activate', callback);
	return item;
}

function _setupDaySubmenu(widget, title, getVal, setVal) {
	let maxDays = Calculation.calculateWorkingDaysInMonth();
	let item = new PopupMenu.PopupSubMenuMenuItem(title);
	widget._indicator.menu.addMenuItem(item);

	let controlItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
	let box = new St.BoxLayout({
		vertical: false,
		x_expand: true,
		x_align: Clutter.ActorAlign.CENTER,
		y_align: Clutter.ActorAlign.CENTER,
	});

	let countLabel = new St.Label({
		text: String(getVal()),
		style: 'font-size: 14px; font-weight: bold; text-align: center; padding: 0 8px;',
		y_align: Clutter.ActorAlign.CENTER,
		x_align: Clutter.ActorAlign.CENTER,
	});

	let makeBtn = (label, onClick) => {
		let btn = new St.Button({ label, style_class: 'button', x_expand: false });
		btn.connect('clicked', onClick);
		return btn;
	};

	let save = () => {
		MyStorage.saveDays(widget.bonusDays, widget.giftDays, widget.showMinutes, widget.displayFormat, widget.startColor, widget.endColor, widget.aheadColor, widget.showCurrentDay, widget.birthDate, widget.showMoney, widget.colorGradient);
		widget._updateLogtime();
	};

	box.add_child(makeBtn('−', () => {
		if (getVal() > 0) {
			setVal(getVal() - 1);
			countLabel.set_text(String(getVal()));
			save();
		}
	}));
	box.add_child(countLabel);
	box.add_child(makeBtn('+', () => {
		if (getVal() < maxDays) {
			setVal(getVal() + 1);
			countLabel.set_text(String(getVal()));
			save();
		}
	}));

	controlItem.actor.add_child(box);
	item.menu.addMenuItem(controlItem);
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

function openSettings() {
	try {
		ExtensionUtils.openPrefs();
	} catch (e) {
		Debug.logError(`Failed to open settings: ${e}`);
	}
}

var Menu = {
	setupApp,
};
