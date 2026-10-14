const { Adw, Gio, Gtk, Gdk, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { MyStorage } = Me.imports.data.storage;
const { Debug } = Me.imports.utils.debug;

const DEFAULT_START_COLOR = '#fff000';
const DEFAULT_END_COLOR = '#47ff00';
const DEFAULT_AHEAD_COLOR = '#00c8ff';
const DEFAULT_BAR_COLOR = '#47ff00';
const DEFAULT_BADGE_COLOR = '#facc15';
const DEFAULT_BADGE_ALERT_COLOR = '#ef4444';

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
    let saved = MyStorage.loadSettings();

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

    const displayModeRow = new Adw.ActionRow({
        title: 'Display Mode',
        subtitle: 'What the panel shows: text, progress bars, or both',
    });

    const displayModeType = ['text', 'bar', 'combined'];

    const displayModeCombo = new Gtk.DropDown({
        model: Gtk.StringList.new(['Text', 'Progress Bar', 'Combined']),
        selected: Math.max(0, displayModeType.indexOf(saved.displayMode)),
        valign: Gtk.Align.CENTER,
    });

    displayModeRow.add_suffix(displayModeCombo);
    displayModeRow.activatable_widget = displayModeCombo;
    displayGroup.add(displayModeRow);

    const panelPositionRow = new Adw.ActionRow({
        title: 'Panel Position',
        subtitle: 'Where the widget sits in the top bar',
    });

    const panelPositionType = ['left', 'center', 'right'];

    const panelPositionCombo = new Gtk.DropDown({
        model: Gtk.StringList.new(['Left', 'Center', 'Right']),
        selected: Math.max(0, panelPositionType.indexOf(saved.panelPosition)),
        valign: Gtk.Align.CENTER,
    });

    panelPositionRow.add_suffix(panelPositionCombo);
    panelPositionRow.activatable_widget = panelPositionCombo;
    displayGroup.add(panelPositionRow);

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
        subtitle: 'Birth date &amp; money display',
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

    // Show only the settings that matter for the chosen display mode
    const displayFormatLabels = {
        text: ['Current / Needed', 'Remaining Hours', 'Combined'],
        bar: ['Month Progress', 'Next Badge', 'Both'],
    };
    const displayFormatSubtitles = {
        text: 'Choose how to display logtime information',
        bar: 'Choose which bars to show',
        combined: 'Text format; bars follow it: month progress / next badge / both',
    };

    function updateVisibility() {
        let mode = displayModeType[displayModeCombo.get_selected()];
        let showText = mode !== 'bar';

        showMinutesRow.visible = showText;
        showCurrentDayRow.visible = showText;
        gratifGroup.visible = showText;

        let labels = displayFormatLabels[showText ? 'text' : 'bar'];
        let model = displayFormatCombo.get_model();
        if (model.get_string(0) !== labels[0]) {
            let selected = displayFormatCombo.get_selected();
            model.splice(0, model.get_n_items(), labels);
            displayFormatCombo.set_selected(selected);
        }
        displayFormatRow.title = showText ? 'Display Format' : 'Bars';
        displayFormatRow.subtitle = displayFormatSubtitles[mode];

        colorGroup.visible = showText;
        barColorGroup.visible = mode !== 'text';
    }

    // ===== Color Settings Group =====
    const colorGroup = new Adw.PreferencesGroup({
        title: 'Text Colors',
        description: 'Color gradient of the panel text, based on progress',
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

    // ===== Progress Bar Colors Group =====
    const barColorGroup = new Adw.PreferencesGroup({
        title: 'Progress Bar Colors',
        description: 'Colors of the month and badge bars',
    });
    page.add(barColorGroup);

    function addColorRow(title, subtitle, color) {
        const row = new Adw.ActionRow({ title, subtitle });
        const button = new Gtk.ColorButton({
            rgba: hexToRGBA(color),
            valign: Gtk.Align.CENTER,
        });
        row.add_suffix(button);
        row.activatable_widget = button;
        barColorGroup.add(row);
        return button;
    }

    const barColorButton = addColorRow('Main Bar', 'Month progress bar and its percentage',
        saved.barColor || DEFAULT_BAR_COLOR);
    const badgeColorButton = addColorRow('Badge Bar', 'Time left before your next badge',
        saved.badgeColor || DEFAULT_BADGE_COLOR);
    const badgeAlertColorButton = addColorRow('Badge Alert', 'Blinking color when the session is about to expire',
        saved.badgeAlertColor || DEFAULT_BADGE_ALERT_COLOR);

    const badgeWarningRow = new Adw.ActionRow({
        title: 'Blink Before Expiry',
        subtitle: 'Minutes before the session expires when the badge bar starts blinking',
    });
    const badgeWarningSpin = Gtk.SpinButton.new_with_range(1, 120, 1);
    badgeWarningSpin.set_value(saved.badgeWarningMinutes);
    badgeWarningSpin.valign = Gtk.Align.CENTER;
    badgeWarningRow.add_suffix(badgeWarningSpin);
    badgeWarningRow.activatable_widget = badgeWarningSpin;
    barColorGroup.add(badgeWarningRow);

    const blinkTestRow = new Adw.ActionRow({
        title: 'Test Blink',
        subtitle: 'Blink the badge bar in the panel for 5 seconds',
    });
    const blinkTestButton = new Gtk.Button({
        label: 'Test',
        valign: Gtk.Align.CENTER,
    });
    blinkTestButton.connect('clicked', () => MyStorage.requestBlinkTest());
    blinkTestRow.add_suffix(blinkTestButton);
    blinkTestRow.activatable_widget = blinkTestButton;
    barColorGroup.add(blinkTestRow);

    const resetBarColorsRow = new Adw.ActionRow({
        title: 'Reset Colors',
        subtitle: 'Restore default bar colors',
    });

    const resetBarColorsButton = new Gtk.Button({
        label: 'Reset',
        valign: Gtk.Align.CENTER,
    });

    resetBarColorsButton.connect('clicked', () => {
        barColorButton.set_rgba(hexToRGBA(DEFAULT_BAR_COLOR));
        badgeColorButton.set_rgba(hexToRGBA(DEFAULT_BADGE_COLOR));
        badgeAlertColorButton.set_rgba(hexToRGBA(DEFAULT_BADGE_ALERT_COLOR));
        saveAllSettings();
    });

    resetBarColorsRow.add_suffix(resetBarColorsButton);
    resetBarColorsRow.activatable_widget = resetBarColorsButton;
    barColorGroup.add(resetBarColorsRow);

    updateVisibility();

    function saveAllSettings() {
        MyStorage.saveSettings({
            showMinutes: showMinutesSwitch.get_active(),
            displayFormat: displayFormatType[displayFormatCombo.get_selected()],
            startColor: rgbaToHex(startColorButton.get_rgba()),
            endColor: rgbaToHex(endColorButton.get_rgba()),
            aheadColor: rgbaToHex(aheadColorButton.get_rgba()),
            showCurrentDay: showCurrentDaySwitch.get_active(),
            birthDate: currentBirthDate,
            showMoney: showMoneySwitch.get_active(),
            colorGradient: gradientCurveType[gradientCurveCombo.get_selected()],
            displayMode: displayModeType[displayModeCombo.get_selected()],
            panelPosition: panelPositionType[panelPositionCombo.get_selected()],
            barColor: rgbaToHex(barColorButton.get_rgba()),
            badgeColor: rgbaToHex(badgeColorButton.get_rgba()),
            badgeAlertColor: rgbaToHex(badgeAlertColorButton.get_rgba()),
            badgeWarningMinutes: badgeWarningSpin.get_value_as_int(),
        });
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
    displayModeCombo.connect('notify::selected', () => { saveAllSettings(); updateVisibility(); });
    panelPositionCombo.connect('notify::selected', saveAllSettings);
    gradientCurveCombo.connect('notify::selected', () => { saveAllSettings(); previewArea.queue_draw(); curveGraph.queue_draw(); });
    startColorButton.connect('color-set', () => { saveAllSettings(); previewArea.queue_draw(); });
    endColorButton.connect('color-set', () => { saveAllSettings(); previewArea.queue_draw(); });
    aheadColorButton.connect('color-set', saveAllSettings);
    [barColorButton, badgeColorButton, badgeAlertColorButton].forEach((b) => b.connect('color-set', saveAllSettings));
    badgeWarningSpin.connect('value-changed', saveAllSettings);

    // ===== Account Group =====
    const accountGroup = new Adw.PreferencesGroup({
        title: 'Account (attendance.42lyon.fr)',
        description: 'The widget opens a login window with your 42 Intra account when needed',
    });
    page.add(accountGroup);

    const accountRow = new Adw.ActionRow({
        title: 'Session',
    });
    const updateAccountRow = () => {
        let session = MyStorage.loadSession();
        accountRow.subtitle = session.cookie
            ? `Logged in since ${new Date(session.savedAt).toLocaleString()}`
            : 'Not logged in';
    };
    updateAccountRow();

    const logoutButton = new Gtk.Button({
        label: 'Log out / Switch account',
        valign: Gtk.Align.CENTER,
        css_classes: ['destructive-action'],
    });
    logoutButton.connect('clicked', () => {
        MyStorage.clearSession();
        updateAccountRow();
    });
    accountRow.add_suffix(logoutButton);
    accountGroup.add(accountRow);

    // ===== Info Group =====
    const infoGroup = new Adw.PreferencesGroup({
        title: 'Storage Information',
        description: 'Settings are saved automatically. Logtime, absences and capsules come from attendance.42lyon.fr',
    });
    page.add(infoGroup);

    const storageRow = new Adw.ActionRow({
        title: 'Storage Location',
        subtitle: MyStorage.STORAGE_FILE || 'Unknown path',
    });
    infoGroup.add(storageRow);

    const logsRow = new Adw.ActionRow({
        title: 'Logs',
        subtitle: Debug.LOG_FILE,
    });

    const openLogsButton = new Gtk.Button({
        label: 'Open Logs',
        valign: Gtk.Align.CENTER,
    });
    openLogsButton.connect('clicked', () => {
        // Also creates the file if nothing was logged yet
        Debug.logInfo('Opening logs from Settings');
        try {
            Gio.AppInfo.launch_default_for_uri(Gio.File.new_for_path(Debug.LOG_FILE).get_uri(), null);
        } catch (e) {
            Debug.logError(`Failed to open logs: ${e.message}`);
        }
    });

    logsRow.add_suffix(openLogsButton);
    logsRow.activatable_widget = openLogsButton;
    infoGroup.add(logsRow);

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
