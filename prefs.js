const { Adw, Gio, Gtk, Gdk, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { MyStorage } = Me.imports.data.storage;
const { Calculation } = Me.imports.utils.calculation;

const DEFAULT_START_COLOR = '#fff000';
const DEFAULT_END_COLOR = '#47ff00';
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
    let workingDaysInMonth = Calculation.calculateWorkingDaysInMonth();

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

    const showCurrentDayRow = new Adw.ActionRow({
        title: 'Show Current Day',
        subtitle: 'Append today\'s logged hours to the panel label',
    });

    const showCurrentDaySwitch = new Gtk.Switch({
        active: saved.showCurrentDay !== undefined ? saved.showCurrentDay : false,
        valign: Gtk.Align.CENTER,
    });

    showCurrentDayRow.add_suffix(showCurrentDaySwitch);
    showCurrentDayRow.activatable_widget = showCurrentDaySwitch;
    displayGroup.add(showCurrentDayRow);

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

    // ===== Gratification Group =====
    const gratifGroup = new Adw.PreferencesGroup({
        title: 'Gratification (Barème Auvergne-Rhône-Alpes)',
        description: 'Based on barème actualisé au 01/04/2025',
    });
    page.add(gratifGroup);

    const gratifExpanderRow = new Adw.ExpanderRow({
        title: 'Gratification Settings',
        subtitle: 'Birth date & money display',
    });
    gratifGroup.add(gratifExpanderRow);

    const birthDateRow = new Adw.ActionRow({
        title: 'Birth Date',
        subtitle: 'Used to determine your gratification rate',
    });

    let currentBirthDate = saved.birthDate || '';

    const birthDateButton = new Gtk.MenuButton({
        label: currentBirthDate || 'Select date',
        valign: Gtk.Align.CENTER,
    });

    const calendar = new Gtk.Calendar();

    if (currentBirthDate) {
        let parts = currentBirthDate.split('-');
        if (parts.length === 3) {
            let d = GLib.DateTime.new_local(
                parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]), 0, 0, 0
            );
            if (d) calendar.select_day(d);
        }
    }

    const calendarPopover = new Gtk.Popover({ child: calendar });
    birthDateButton.set_popover(calendarPopover);

    calendar.connect('day-selected', () => {
        let d = calendar.get_date();
        let month = String(d.get_month()).padStart(2, '0');
        let day = String(d.get_day_of_month()).padStart(2, '0');
        currentBirthDate = `${d.get_year()}-${month}-${day}`;
        birthDateButton.set_label(currentBirthDate);
        calendarPopover.popdown();
        saveAllSettings();
    });

    birthDateRow.add_suffix(birthDateButton);
    gratifExpanderRow.add_row(birthDateRow);

    const showMoneyRow = new Adw.ActionRow({
        title: 'Show Earned Money',
        subtitle: 'Append estimated monthly gratification to the panel label',
    });

    const showMoneySwitch = new Gtk.Switch({
        active: saved.showMoney !== undefined ? saved.showMoney : false,
        valign: Gtk.Align.CENTER,
    });

    showMoneyRow.add_suffix(showMoneySwitch);
    showMoneyRow.activatable_widget = showMoneySwitch;
    gratifExpanderRow.add_row(showMoneyRow);

    // ===== Color Settings Group =====
    const colorGroup = new Adw.PreferencesGroup({
        title: 'Color Gradient',
        description: 'Customize the color gradient based on progress',
    });
    page.add(colorGroup);

    const startColorRow = new Adw.ActionRow({
        title: 'Start Color (0%)',
        subtitle: 'Color when hours are egal to 0',
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

    const gradientCurveType = ['linear', 'ease-out', 'cosine', 'sine', 'smoothstep', 'ease-in-out', 'smootherstep', 'quadratic', 'cubic', 'exponential', 'circular', 'bounce'];

    const gradientCurveRow = new Adw.ActionRow({
        title: 'Gradient Curve',
        subtitle: 'How color transitions between start and end',
    });

    const gradientCurveCombo = new Gtk.DropDown({
        model: Gtk.StringList.new(['Linear', 'Ease Out', 'Cosine', 'Sine (S-curve)', 'Smoothstep', 'Ease In-Out', 'Smootherstep', 'Quadratic', 'Cubic', 'Exponential', 'Circular', 'Bounce']),
        selected: Math.max(0, gradientCurveType.indexOf(saved.colorGradient || 'ease-out')),
        valign: Gtk.Align.CENTER,
    });

    gradientCurveRow.add_suffix(gradientCurveCombo);
    gradientCurveRow.activatable_widget = gradientCurveCombo;
    colorGroup.add(gradientCurveRow);

    const curveVizExpanderRow = new Adw.ExpanderRow({
        title: 'Visualization',
        subtitle: 'Preview & curve shape graph',
    });
    colorGroup.add(curveVizExpanderRow);

    const curvePreviewRow = new Adw.ActionRow({
        title: 'Preview',
        subtitle: 'Color gradient with selected curve applied',
    });

    const curveFunctions = {
        // Baseline
        'linear':        (t) => t,
        // Decelerating (fast start, slow end)
        'ease-out':      (t) => 1 - (1 - t) ** 2,
        'cosine':        (t) => Math.sin(t * Math.PI / 2),
        // S-curves (slow at both ends)
        'sine':          (t) => (1 - Math.cos(t * Math.PI)) / 2,
        'smoothstep':    (t) => t * t * (3 - 2 * t),
        'ease-in-out':   (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
        'smootherstep':  (t) => t * t * t * (t * (t * 6 - 15) + 10),
        // Accelerating (slow start, fast end)
        'quadratic':     (t) => t ** 2,
        'cubic':         (t) => t ** 3,
        'exponential':   (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
        'circular':      (t) => 1 - Math.sqrt(1 - t * t),
        'bounce':        (t) => {
            if (t < 1 / 2.75) return 7.5625 * t * t;
            if (t < 2 / 2.75) { t -= 1.5 / 2.75;   return 7.5625 * t * t + 0.75; }
            if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
            t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
        },
    };

    const previewArea = new Gtk.DrawingArea({
        content_width: 240,
        content_height: 24,
        valign: Gtk.Align.CENTER,
    });

    previewArea.set_draw_func((_area, cr, width, height) => {
        let selectedType = gradientCurveType[gradientCurveCombo.get_selected()];
        let fn = curveFunctions[selectedType] || curveFunctions['linear'];

        let parseHex = (hex) => ({
            r: parseInt(hex.slice(1, 3), 16) / 255,
            g: parseInt(hex.slice(3, 5), 16) / 255,
            b: parseInt(hex.slice(5, 7), 16) / 255,
        });

        let start = parseHex(rgbaToHex(startColorButton.get_rgba()));
        let end = parseHex(rgbaToHex(endColorButton.get_rgba()));

        for (let x = 0; x < width; x++) {
            let t = x / (width - 1);
            let eased = Math.max(0, Math.min(1, fn(t)));
            cr.setSourceRGB(
                start.r + (end.r - start.r) * eased,
                start.g + (end.g - start.g) * eased,
                start.b + (end.b - start.b) * eased
            );
            cr.rectangle(x, 0, 1, height);
            cr.fill();
        }

        cr.$dispose();
    });

    curvePreviewRow.add_suffix(previewArea);
    curveVizExpanderRow.add_row(curvePreviewRow);

    const curveGraphRow = new Adw.ActionRow({
        title: 'Curve Shape',
        subtitle: 'Easing function graph (diagonal = linear reference)',
    });

    const curveGraph = new Gtk.DrawingArea({
        content_width: 100,
        content_height: 80,
        hexpand: true,
        valign: Gtk.Align.CENTER,
        margin_top: 6,
        margin_bottom: 6,
    });

    curveGraph.set_draw_func((_area, cr, width, height) => {
        let selectedType = gradientCurveType[gradientCurveCombo.get_selected()];
        let fn = curveFunctions[selectedType] || curveFunctions['linear'];

        const pad = 8;
        const w = width - pad * 2;
        const h = height - pad * 2;

        // Background
        cr.setSourceRGBA(0.08, 0.08, 0.08, 0.9);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        // Grid lines
        cr.setSourceRGBA(0.25, 0.25, 0.25, 1.0);
        cr.setLineWidth(0.5);
        for (let i = 1; i < 4; i++) {
            cr.moveTo(pad + w * i / 4, pad);
            cr.lineTo(pad + w * i / 4, pad + h);
            cr.stroke();
            cr.moveTo(pad, pad + h * i / 4);
            cr.lineTo(pad + w, pad + h * i / 4);
            cr.stroke();
        }

        // Border
        cr.setSourceRGBA(0.35, 0.35, 0.35, 1.0);
        cr.setLineWidth(1);
        cr.rectangle(pad, pad, w, h);
        cr.stroke();

        // Linear reference diagonal
        cr.setSourceRGBA(0.45, 0.45, 0.45, 1.0);
        cr.setLineWidth(1);
        cr.moveTo(pad, pad + h);
        cr.lineTo(pad + w, pad);
        cr.stroke();

        // Curve
        cr.setSourceRGBA(0.25, 0.75, 1.0, 1.0);
        cr.setLineWidth(2);
        const steps = w * 2;
        cr.moveTo(pad, pad + h);
        for (let i = 1; i <= steps; i++) {
            let t = i / steps;
            let eased = fn(t);
            let y = Math.max(pad, Math.min(pad + h, pad + (1 - eased) * h));
            cr.lineTo(pad + t * w, y);
        }
        cr.stroke();

        cr.$dispose();
    });

    curveGraphRow.add_suffix(curveGraph);
    curveVizExpanderRow.add_row(curveGraphRow);

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
        previewArea.queue_draw();
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
            upper: workingDaysInMonth,
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
            upper: workingDaysInMonth,
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
            rgbaToHex(aheadColorButton.get_rgba()),
            showCurrentDaySwitch.get_active(),
            currentBirthDate,
            showMoneySwitch.get_active(),
            gradientCurveType[gradientCurveCombo.get_selected()]
        );
    }

    showMinutesSwitch.connect('state-set', () => {
        saveAllSettings();
        return false;
    });

    showCurrentDaySwitch.connect('state-set', () => {
        saveAllSettings();
        return false;
    });

    showMoneySwitch.connect('state-set', () => {
        saveAllSettings();
        return false;
    });

    displayFormatCombo.connect('notify::selected', saveAllSettings);
    gradientCurveCombo.connect('notify::selected', () => { saveAllSettings(); previewArea.queue_draw(); curveGraph.queue_draw(); });
    startColorButton.connect('color-set', () => { saveAllSettings(); previewArea.queue_draw(); });
    endColorButton.connect('color-set', () => { saveAllSettings(); previewArea.queue_draw(); });
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

    // ===== API Setup Guide Group =====
    const setupGroup = new Adw.PreferencesGroup({
        title: 'How to get API credentials',
    });
    page.add(setupGroup);

    const setupRow = new Adw.ActionRow({
        title: 'Setup Guide',
        subtitle: 'github.com/SaruM4N3/LogtimeWidget#first-time-setup',
    });
    const setupButton = new Gtk.Button({
        label: 'Open',
        valign: Gtk.Align.CENTER,
    });
    setupButton.connect('clicked', () => {
        Gio.AppInfo.launch_default_for_uri('https://github.com/SaruM4N3/LogtimeWidget#first-time-setup', null);
    });
    setupRow.add_suffix(setupButton);
    setupGroup.add(setupRow);

    // ===== API Credentials Group =====
    let savedCreds = MyStorage.loadCredentials();

    const credsGroup = new Adw.PreferencesGroup({
        title: 'API Credentials (42 Intra)',
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
        subtitle: 'Saves and reconnects automatically',
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
