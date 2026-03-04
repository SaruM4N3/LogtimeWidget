const { Adw, Gio, Gtk, GLib, Gdk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { MyStorage } = Me.imports.data.storage;

const DEFAULT_START_COLOR = '#ef4444';
const DEFAULT_END_COLOR = '#4ade80';
const DEFAULT_AHEAD_COLOR = '#00c8ff';

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

function saveCredentials(clientIdEntry, clientSecretEntry) {
    MyStorage.saveCredentials(
        clientIdEntry.get_text().trim(),
        clientSecretEntry.get_text().trim()
    );
}

function fillPreferencesWindow(window) {
    let saved = MyStorage.loadDays();

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

    const displayFormatRow = new Adw.ActionRow({
        title: 'Display Format',
        subtitle: 'Choose how to display logtime information',
    });

    const displayFormatType = ['ratio', 'remaining', 'all']

    const displayFormatCombo = new Gtk.DropDown({
        model: Gtk.StringList.new(['Current / Needed', 'Remaining Hours', 'Combined']),
        selected: displayFormatType.indexOf(saved.displayFormat),
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

    const startColorRow = new Adw.ActionRow({
        title: 'Start Color (0%)',
        subtitle: 'Color when no hours are logged',
    });

    const startColorButton = new Gtk.ColorButton({
        rgba: hexToRGBA(saved.startColor || DEFAULT_START_COLOR),
        valign: Gtk.Align.CENTER,
    });

    startColorRow.add_suffix(startColorButton);
    startColorRow.activatable_widget = startColorButton;
    colorGroup.add(startColorRow);

    const endColorRow = new Adw.ActionRow({
        title: 'End Color (100%)',
        subtitle: 'Color when meeting required hours',
    });

    const endColorButton = new Gtk.ColorButton({
        rgba: hexToRGBA(saved.endColor || DEFAULT_END_COLOR),
        valign: Gtk.Align.CENTER,
    });

    endColorRow.add_suffix(endColorButton);
    endColorRow.activatable_widget = endColorButton;
    colorGroup.add(endColorRow);

    const aheadColorRow = new Adw.ActionRow({
        title: 'Ahead Color (>100%)',
        subtitle: 'Color when exceeding required hours',
    });

    const aheadColorButton = new Gtk.ColorButton({
        rgba: hexToRGBA(saved.aheadColor || DEFAULT_AHEAD_COLOR),
        valign: Gtk.Align.CENTER,
    });

    aheadColorRow.add_suffix(aheadColorButton);
    aheadColorRow.activatable_widget = aheadColorButton;
    colorGroup.add(aheadColorRow);

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

    function saveAllSettings() {
        MyStorage.saveDays(
            bonusSpinButton.get_value(),
            giftSpinButton.get_value(),
            showMinutesSwitch.get_active(),
            displayFormatType[displayFormatCombo.get_selected()],
            rgbaToHex(startColorButton.get_rgba()),
            rgbaToHex(endColorButton.get_rgba()),
            rgbaToHex(aheadColorButton.get_rgba())
        );
    }

    showMinutesSwitch.connect('state-set', () => {
        saveAllSettings();
        return false;
    });

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

    // ===== API Credentials Group =====
    let savedCreds = MyStorage.loadCredentials();

    const credsGroup = new Adw.PreferencesGroup({
        title: 'API Credentials (42 Intra)',
        description: 'Create an app at profile.intra.42.fr/oauth/applications',
    });
    page.add(credsGroup);

    const clientIdRow = new Adw.ActionRow({
        title: 'Client ID',
        subtitle: 'Your 42 API application UID',
    });
    const clientIdEntry = new Gtk.Entry({
        text: savedCreds.clientId || '',
        placeholder_text: 'u-s4t2ud-...',
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    clientIdRow.add_suffix(clientIdEntry);
    credsGroup.add(clientIdRow);

    const clientSecretRow = new Adw.ActionRow({
        title: 'Client Secret',
        subtitle: 'Your 42 API application secret',
    });
    const clientSecretEntry = new Gtk.PasswordEntry({
        text: savedCreds.clientSecret || '',
        show_peek_icon: true,
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    clientSecretRow.add_suffix(clientSecretEntry);
    credsGroup.add(clientSecretRow);

    const saveCredsRow = new Adw.ActionRow({
        title: 'Save Credentials',
        subtitle: 'Restart the widget after saving',
    });
    const saveCredsButton = new Gtk.Button({
        label: 'Save',
        valign: Gtk.Align.CENTER,
        css_classes: ['suggested-action'],
    });
    saveCredsButton.connect('clicked', () => {
        saveCredentials(clientIdEntry, clientSecretEntry);
    });
    saveCredsRow.add_suffix(saveCredsButton);
    credsGroup.add(saveCredsRow);

    // ===== Info Group =====
    const infoGroup = new Adw.PreferencesGroup({
        title: 'Storage Information',
        description: 'Days are automatically saved and reset each month',
    });
    page.add(infoGroup);

    const storageRow = new Adw.ActionRow({
        title: 'Storage Location',
        subtitle: MyStorage.STORAGE_FILE || 'Unknown path',
    });
    infoGroup.add(storageRow);

    // ===== Credits Group =====
    const creditsGroup = new Adw.PreferencesGroup({
        title: 'Credits',
    });
    page.add(creditsGroup);

    const githubRow = new Adw.ActionRow({
        title: 'zsonie',
        subtitle: 'github.com/SaruM4N3',
    });

    const githubButton = new Gtk.Button({
        label: 'GitHub',
        valign: Gtk.Align.CENTER,
    });

    githubButton.connect('clicked', () => {
        Gio.AppInfo.launch_default_for_uri('https://github.com/SaruM4N3', null);
    });

    githubRow.add_suffix(githubButton);
    creditsGroup.add(githubRow);

    const issueRow = new Adw.ActionRow({
        title: 'Report an Issue',
        subtitle: 'github.com/SaruM4N3/LogtimeWidget/issues',
    });

    const issueButton = new Gtk.Button({
        label: 'Open',
        valign: Gtk.Align.CENTER,
    });

    issueButton.connect('clicked', () => {
        Gio.AppInfo.launch_default_for_uri('https://github.com/SaruM4N3/LogtimeWidget/issues', null);
    });

    issueRow.add_suffix(issueButton);
    creditsGroup.add(issueRow);
}
