'use strict';

const { Adw, Gio, Gtk, GLib, Gdk } = imports.gi;  // Add Gdk for colors
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const ByteArray = imports.byteArray;

// Storage paths
const STORAGE_DIR = Me.path + '/data';
const STORAGE_FILE = GLib.build_filenamev([STORAGE_DIR, '.saved_days.json']);

// Default colors
const DEFAULT_START_COLOR = '#ef4444'; // Red
const DEFAULT_END_COLOR = '#4ade80';   // Green
const DEFAULT_AHEAD_COLOR = '#00c8ff';  // Cyan

function ensureStorageDir() {
    let dir = Gio.File.new_for_path(STORAGE_DIR);
    if (!dir.query_exists(null)) {
        dir.make_directory_with_parents(null);
    }
}

function getCurrentMonth() {
    let now = GLib.DateTime.new_now_local();
    return `${now.get_year()}-${now.get_month()}`;
}

function saveSettings(bonusDays, giftDays, showMinutes, displayFormat, startColor, endColor, aheadColor) {
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
        log(`LogtimeWidget Prefs: Saved settings`);
    } catch (e) {
        logError(e, 'LogtimeWidget Prefs: Failed to save settings');
    }
}

function loadSettings() {
    try {
        let file = Gio.File.new_for_path(STORAGE_FILE);
        if (!file.query_exists(null)) {
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
                saveSettings(0, 0, true, 'ratio', DEFAULT_START_COLOR, DEFAULT_END_COLOR, DEFAULT_AHEAD_COLOR);
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
        logError(e, 'LogtimeWidget Prefs: Failed to load settings');
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

function hexToRGBA(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    return new Gdk.RGBA({ red: r, green: g, blue: b, alpha: 1.0 });
}

function rgbaToHex(rgba) {
    let r = Math.round(rgba.red * 255).toString(16).padStart(2, '0');
    let g = Math.round(rgba.green * 255).toString(16).padStart(2, '0');
    let b = Math.round(rgba.blue * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function init() {
}

function fillPreferencesWindow(window) {
    let saved = loadSettings();
    
    const page = new Adw.PreferencesPage({
        title: 'General',
        icon_name: 'dialog-information-symbolic',
    });
    window.add(page);

    // ===== Display Settings Group =====
    const displayGroup = new Adw.PreferencesGroup({
        title: 'Display',
        description: 'Configure display format',
    });
    page.add(displayGroup);

    // Show Minutes Toggle
    const showMinutesRow = new Adw.ActionRow({
        title: 'Show Minutes',
        subtitle: 'Display minutes in the panel label',
    });
    
    const showMinutesSwitch = new Gtk.Switch({
        active: saved.showMinutes,
        valign: Gtk.Align.CENTER,
    });
    
    showMinutesRow.add_suffix(showMinutesSwitch);
    showMinutesRow.activatable_widget = showMinutesSwitch;
    displayGroup.add(showMinutesRow);

    // Display Format Selector
    const displayFormatRow = new Adw.ActionRow({
        title: 'Display Format',
        subtitle: 'Choose how to display logtime information',
    });

    const displayFormatCombo = new Gtk.DropDown({
        model: Gtk.StringList.new(['Current / Needed', 'Remaining Hours']),
        selected: saved.displayFormat === 'ratio' ? 0 : 1,
        valign: Gtk.Align.CENTER,
    });

    displayFormatRow.add_suffix(displayFormatCombo);
    displayFormatRow.activatable_widget = displayFormatCombo;
    displayGroup.add(displayFormatRow);

    // ===== Color Settings Group =====
    const colorGroup = new Adw.PreferencesGroup({
        title: 'Color Gradient',
        description: 'Customize the color gradient based on progress',
    });
    page.add(colorGroup);

    // Start Color (0% progress - Behind schedule)
    const startColorRow = new Adw.ActionRow({
        title: 'Start Color (0%)',
        subtitle: 'Color when no hours are logged',
    });
    
    const startColorButton = new Gtk.ColorButton({
        rgba: hexToRGBA(saved.startColor),
        valign: Gtk.Align.CENTER,
    });
    
    startColorRow.add_suffix(startColorButton);
    startColorRow.activatable_widget = startColorButton;
    colorGroup.add(startColorRow);

    // End Color (100% progress - On track)
    const endColorRow = new Adw.ActionRow({
        title: 'End Color (100%)',
        subtitle: 'Color when meeting required hours',
    });
    
    const endColorButton = new Gtk.ColorButton({
        rgba: hexToRGBA(saved.endColor),
        valign: Gtk.Align.CENTER,
    });
    
    endColorRow.add_suffix(endColorButton);
    endColorRow.activatable_widget = endColorButton;
    colorGroup.add(endColorRow);

    // Ahead Color (>100% progress)
    const aheadColorRow = new Adw.ActionRow({
        title: 'Ahead Color (>100%)',
        subtitle: 'Color when exceeding required hours',
    });
    
    const aheadColorButton = new Gtk.ColorButton({
        rgba: hexToRGBA(saved.aheadColor),
        valign: Gtk.Align.CENTER,
    });
    
    aheadColorRow.add_suffix(aheadColorButton);
    aheadColorRow.activatable_widget = aheadColorButton;
    colorGroup.add(aheadColorRow);

    // Reset Colors Button
    const resetColorsRow = new Adw.ActionRow({
        title: 'Reset Colors',
        subtitle: 'Restore default color gradient',
    });
    
    const resetColorsButton = new Gtk.Button({
        label: 'Reset',
        valign: Gtk.Align.CENTER,
    });
    
    resetColorsButton.connect('clicked', () => {
        startColorButton.set_rgba(hexToRGBA(DEFAULT_START_COLOR));
        endColorButton.set_rgba(hexToRGBA(DEFAULT_END_COLOR));
        aheadColorButton.set_rgba(hexToRGBA(DEFAULT_AHEAD_COLOR));
        saveAllSettings();
    });
    
    resetColorsRow.add_suffix(resetColorsButton);
    resetColorsRow.activatable_widget = resetColorsButton;
    colorGroup.add(resetColorsRow);

    // ===== Days Management Group =====
    const daysGroup = new Adw.PreferencesGroup({
        title: 'Days Management',
        description: 'Configure bonus and gift days for logtime calculation',
    });
    page.add(daysGroup);

    // Bonus Days
    const bonusDaysRow = new Adw.ActionRow({
        title: 'Bonus Days',
        subtitle: 'Each bonus day adds 7 hours to your total logtime',
    });
    
    const bonusSpinButton = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            lower: 0,
            upper: 30,
            step_increment: 1,
            value: saved.bonusDays,
        }),
        valign: Gtk.Align.CENTER,
    });
    
    bonusDaysRow.add_suffix(bonusSpinButton);
    bonusDaysRow.activatable_widget = bonusSpinButton;
    daysGroup.add(bonusDaysRow);

    // Gift Days
    const giftDaysRow = new Adw.ActionRow({
        title: 'Gift Days',
        subtitle: 'Each gift day reduces required working hours by 7h',
    });
    
    const giftSpinButton = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            lower: 0,
            upper: 30,
            step_increment: 1,
            value: saved.giftDays,
        }),
        valign: Gtk.Align.CENTER,
    });
    
    giftDaysRow.add_suffix(giftSpinButton);
    giftDaysRow.activatable_widget = giftSpinButton;
    daysGroup.add(giftDaysRow);

    // Helper function to save all settings
    function saveAllSettings() {
        saveSettings(
            bonusSpinButton.get_value(),
            giftSpinButton.get_value(),
            showMinutesSwitch.get_active(),
            displayFormatCombo.get_selected() === 0 ? 'ratio' : 'remaining',
            rgbaToHex(startColorButton.get_rgba()),
            rgbaToHex(endColorButton.get_rgba()),
            rgbaToHex(aheadColorButton.get_rgba())
        );
    }

    // Connect all change signals
    showMinutesSwitch.connect('state-set', saveAllSettings);
    displayFormatCombo.connect('notify::selected', saveAllSettings);
    startColorButton.connect('color-set', saveAllSettings);
    endColorButton.connect('color-set', saveAllSettings);
    aheadColorButton.connect('color-set', saveAllSettings);
    bonusSpinButton.connect('value-changed', saveAllSettings);
    giftSpinButton.connect('value-changed', saveAllSettings);

    // Reset Days Button
    const resetRow = new Adw.ActionRow({
        title: 'Reset Days',
        subtitle: 'Reset bonus and gift days to 0',
    });
    
    const resetButton = new Gtk.Button({
        label: 'Reset',
        valign: Gtk.Align.CENTER,
        css_classes: ['destructive-action'],
    });
    
    resetButton.connect('clicked', () => {
        bonusSpinButton.set_value(0);
        giftSpinButton.set_value(0);
        saveAllSettings();
    });
    
    resetRow.add_suffix(resetButton);
    resetRow.activatable_widget = resetButton;
    daysGroup.add(resetRow);

    // ===== Info Group =====
    const infoGroup = new Adw.PreferencesGroup({
        title: 'Storage Information',
        description: 'Days are automatically saved and reset each month',
    });
    page.add(infoGroup);

    const storageRow = new Adw.ActionRow({
        title: 'Storage Location',
        subtitle: STORAGE_FILE,
    });
    infoGroup.add(storageRow);

    const monthRow = new Adw.ActionRow({
        title: 'Current Month',
        subtitle: getCurrentMonth(),
    });
    infoGroup.add(monthRow);
}
