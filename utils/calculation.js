/* calculation.js
* utils for calculation and time parsing
*/

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.utils.debug;

/**
 * French public holidays (jours fériés) - returns dates for a given year
 */
function getFrenchPublicHolidays(year) {
    // Fixed holidays
    let holidays = [
        `${year}-01-01`, // Jour de l'an (New Year's Day)
        `${year}-05-01`, // Fête du Travail (Labor Day)
        `${year}-05-08`, // Victoire 1945 (Victory in Europe Day)
        `${year}-07-14`, // Fête nationale (Bastille Day)
        `${year}-08-15`, // Assomption (Assumption of Mary)
        `${year}-11-01`, // Toussaint (All Saints' Day)
        `${year}-11-11`, // Armistice 1918 (Armistice Day)
        `${year}-12-25`, // Noël (Christmas Day)
    ];

    // Calculate Easter (Pâques) and related holidays
    let easter = calculateEaster(year);
    holidays.push(easter); // Lundi de Pâques (Easter Monday)

    let ascension = addDaysToDate(easter, 39); // Ascension (39 days after Easter)
    holidays.push(ascension);

    let pentecost = addDaysToDate(easter, 50); // Lundi de Pentecôte (50 days after Easter)
    holidays.push(pentecost);

    return holidays;
}

/**
 * Calculate Easter Monday date using Meeus/Jones/Butcher algorithm
 */
function calculateEaster(year) {
    let a = year % 19;
    let b = Math.floor(year / 100);
    let c = year % 100;
    let d = Math.floor(b / 4);
    let e = b % 4;
    let f = Math.floor((b + 8) / 25);
    let g = Math.floor((b - f + 1) / 3);
    let h = (19 * a + b - d - g + 15) % 30;
    let i = Math.floor(c / 4);
    let k = c % 4;
    let l = (32 + 2 * e + 2 * i - h - k) % 7;
    let m = Math.floor((a + 11 * h + 22 * l) / 451);
    let month = Math.floor((h + l - 7 * m + 114) / 31);
    let day = ((h + l - 7 * m + 114) % 31) + 1;

    // Add 1 day for Easter Monday
    let easterSunday = GLib.DateTime.new_local(year, month, day, 0, 0, 0);
    let easterMonday = easterSunday.add_days(1);

    return `${year}-${String(easterMonday.get_month()).padStart(2, '0')}-${String(easterMonday.get_day_of_month()).padStart(2, '0')}`;
}

/**
 * Add days to a date string (YYYY-MM-DD format)
 */
function addDaysToDate(dateStr, days) {
    let parts = dateStr.split('-');
    let date = GLib.DateTime.new_local(
        parseInt(parts[0]),
        parseInt(parts[1]),
        parseInt(parts[2]),
        0, 0, 0
    );
    let newDate = date.add_days(days);
    return `${newDate.get_year()}-${String(newDate.get_month()).padStart(2, '0')}-${String(newDate.get_day_of_month()).padStart(2, '0')}`;
}

/**
 * Calculate number of working days (Monday-Friday, excluding French holidays)
 * in the current month
 */
function calculateWorkingDaysInMonth() {
    let now = GLib.DateTime.new_now_local();

    if (!now) {
        Debug.logError('GLib.DateTime.new_now_local() returned null in calculateWorkingDaysInMonth');
        return 20;
    }

    let year = now.get_year();
    let month = now.get_month();

    // Get holidays
    let holidays = getFrenchPublicHolidays(year);
    let holidaySet = new Set(holidays);

    let jsDate = new Date(year, month, 0);
    let daysInMonth = jsDate.getDate();

    let workingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        let date = GLib.DateTime.new_local(year, month, day, 0, 0, 0);
        if (!date) continue;

        let dayOfWeek = date.get_day_of_week();
        let dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidaySet.has(dateStr)) {
            workingDays++;
        }
    }

    return workingDays;
}


/**
 * Calculate total logged time (hours and minutes) from the beginning of the current month.
 * 
 * @param {Object} data - The API data object mapping date strings to duration strings.
 * @param {number} bonusDays - Number of bonus days to add (7 hours each)
 * @param {number} giftDays - Number of gift days (reduces required working hours)
 * @returns {Object} An object with text, isOnTrack, totalHours, totalMinutes, workingHours
 */
function calculateMonthlyTotal(data, bonusDays = 0, giftDays = 0) {
    Debug.logInfo('=== calculateMonthlyTotal START ===');

    // Use JavaScript Date instead of GLib to avoid null issues
    let now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1; // JS months are 0-indexed

    Debug.logInfo(`Current date: ${currentYear}-${String(currentMonth).padStart(2, '0')}`);

    let totalSeconds = 0;

    for (let dateStr in data) {
        let y = parseInt(dateStr.slice(0, 4));
        let m = parseInt(dateStr.slice(5, 7));

        // Only count entries from current month/year
        if (y === currentYear && m === currentMonth) {
            let timeParts = data[dateStr].split(':');
            if (timeParts.length >= 3) {
                let hours = parseInt(timeParts[0]);
                let minutes = parseInt(timeParts[1]);
                let seconds = parseFloat(timeParts[2]);
                totalSeconds += hours * 3600 + minutes * 60 + seconds;
            }
        }
    }

    // Add bonus days
    totalSeconds += bonusDays * 7 * 3600;

    let totalHours = Math.floor(totalSeconds / 3600);
    let remainingSeconds = totalSeconds % 3600;
    let totalMinutes = Math.floor(remainingSeconds / 60);

    let workingDays = calculateWorkingDaysInMonth();
    let effectiveWorkingDays = Math.max(0, workingDays - giftDays);
    let workingHours = effectiveWorkingDays * 7;

    Debug.logInfo(`Working days: ${workingDays}, Gift days: ${giftDays}`);
    Debug.logInfo(`Effective working days: ${effectiveWorkingDays}`);
    Debug.logInfo(`Required working hours: ${workingHours}h`);

    let pad = (num) => num.toString().padStart(2, '0');

    Debug.logInfo('=== calculateMonthlyTotal END ===');

    return {
        text: `${totalHours}h${pad(totalMinutes)}/${workingHours}h`,
        isOnTrack: totalHours >= workingHours,
        totalHours: totalHours,
        totalMinutes: totalMinutes,
        totalSeconds: totalSeconds,
        workingHours: workingHours,
        workingDays: effectiveWorkingDays
    };
}

/**
 * Format time display based on user preferences
 * 
 * @param {Object} data - The API data object
 * @param {number} bonusDays - Number of bonus days
 * @param {number} giftDays - Number of gift days
 * @param {boolean} showMinutes - Whether to show minutes
 * @param {string} displayFormat - 'ratio' or 'remaining'
 * @returns {Object} Formatted display object with text and isOnTrack
 */
function formatTimeDisplay(data, bonusDays, giftDays, showMinutes = true, displayFormat = 'ratio') {
    let result = calculateMonthlyTotal(data, bonusDays, giftDays);
    let pad = (num) => num.toString().padStart(2, '0');

    if (displayFormat === 'remaining') {
        // Calculate remaining hours needed
        let remainingSeconds = (result.workingHours * 3600) - result.totalSeconds;
        let remainingHours = Math.floor(remainingSeconds / 3600);
        let remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);

        // If ahead of schedule, show positive hours
        let isAhead = remainingSeconds < 0;
        let absHours = Math.abs(remainingHours);
        let absMinutes = Math.abs(remainingMinutes);

        let text;
        if (showMinutes) {
            text = isAhead
                ? `+${absHours}h${pad(absMinutes)} above!`
                : `Remaining: ${absHours}h${pad(absMinutes)}`;
        } else {
            text = isAhead
                ? `+${absHours}h above!`
                : `Remaining: ${absHours}h`;
        }
        Debug.logDebug(text);
        return {
            text: text,
            isOnTrack: isAhead,
            totalHours: result.totalHours,
            totalMinutes: result.totalMinutes,
            workingHours: result.workingHours
        };
    } else {
        // Ratio format: current/needed
        let text;
        if (showMinutes) {
            text = `${result.totalHours}h${pad(result.totalMinutes)}/${result.workingHours}h`;
        } else {
            text = `${result.totalHours}h/${result.workingHours}h`;
        }
        Debug.logDebug(text);
        return {
            text: text,
            isOnTrack: result.isOnTrack,
            totalHours: result.totalHours,
            totalMinutes: result.totalMinutes,
            workingHours: result.workingHours
        };
    }
}

/**
 * Format time as "Xh" or "XhYY" depending on showMinutes
 * 
 * @param {number} hours - Hours
 * @param {number} minutes - Minutes
 * @param {boolean} showMinutes - Whether to include minutes
 * @returns {string} Formatted time string
 */
function formatTime(hours, minutes, showMinutes = true) {
    let pad = (num) => num.toString().padStart(2, '0');
    return showMinutes ? `${hours}h${pad(minutes)}` : `${hours}h`;
}

/**
 * Calculate remaining time (difference between required and current)
 * 
 * @param {Object} data - The API data object
 * @param {number} bonusDays - Number of bonus days
 * @param {number} giftDays - Number of gift days
 * @returns {Object} Object with remainingHours, remainingMinutes, isAhead
 */
function calculateRemainingTime(data, bonusDays, giftDays) {
    let result = calculateMonthlyTotal(data, bonusDays, giftDays);

    let remainingSeconds = (result.workingHours * 3600) - result.totalSeconds;
    let isAhead = remainingSeconds < 0;

    let absRemainingSeconds = Math.abs(remainingSeconds);
    let remainingHours = Math.floor(absRemainingSeconds / 3600);
    let remainingMinutes = Math.floor((absRemainingSeconds % 3600) / 60);

    return {
        remainingHours: remainingHours,
        remainingMinutes: remainingMinutes,
        isAhead: isAhead,
        totalHours: result.totalHours,
        totalMinutes: result.totalMinutes,
        workingHours: result.workingHours
    };
}

var Calculation = {
    calculateMonthlyTotal,
    calculateWorkingDaysInMonth,
    getFrenchPublicHolidays,
    formatTimeDisplay,
    formatTime,
    calculateRemainingTime,
};
