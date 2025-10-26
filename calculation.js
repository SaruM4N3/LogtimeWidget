/* calculation.js

utils for calculation and time parsing

*/

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.debug;

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
    let year = now.get_year();
    let month = now.get_month();
    
    // Get public holidays for this year
    let holidays = getFrenchPublicHolidays(year);
    let holidaySet = new Set(holidays);
    
    // Get number of days in current month
    let daysInMonth = GLib.DateTime.new_local(year, month + 1, 1, 0, 0, 0).add_days(-1).get_day_of_month();
    
    let workingDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
        let date = GLib.DateTime.new_local(year, month, day, 0, 0, 0);
        let dayOfWeek = date.get_day_of_week(); // 1 = Monday, 7 = Sunday
        let dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Count if it's Monday-Friday (1-5) and not a holiday
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
 * @returns {Object} An object with text, isOnTrack, totalHours, workingHours
 */
function calculateMonthlyTotal(data, bonusDays = 0, giftDays = 0) {
    let now = GLib.DateTime.new_now_local();
    let firstOfMonth = GLib.DateTime.new_local(
        now.get_year(),
        now.get_month(),
        1,
        0, 0, 0
    );

    let totalSeconds = 0;

    for (let dateStr in data) {
        let y = parseInt(dateStr.slice(0, 4));
        let m = parseInt(dateStr.slice(5, 7));
        let d = parseInt(dateStr.slice(8, 10));

        let entryDate = GLib.DateTime.new_local(y, m, d, 0, 0, 0);

        if (entryDate.compare(firstOfMonth) >= 0) {
            let timeParts = data[dateStr].split(':');
            if (timeParts.length >= 3) {
                let hours = parseInt(timeParts[0]);
                let minutes = parseInt(timeParts[1]);
                let seconds = parseFloat(timeParts[2]);
                totalSeconds += hours * 3600 + minutes * 60 + seconds;
            }
        }
    }

    // Add bonus days (7 hours = 25200 seconds each)
    totalSeconds += bonusDays * 7 * 3600;

    let totalHours = Math.floor(totalSeconds / 3600);
    let remainingSeconds = totalSeconds % 3600;
    let totalMinutes = Math.floor(remainingSeconds / 60);

    // Calculate required working hours: (workingDays - giftDays) * 7
    let workingDays = calculateWorkingDaysInMonth();
    let effectiveWorkingDays = Math.max(0, workingDays - giftDays);
    let workingHours = effectiveWorkingDays * 7;

    Debug.logInfo(`Working days: ${workingDays}, Gift days: ${giftDays}`);
    Debug.logInfo(`Effective working days: ${effectiveWorkingDays}`);
    Debug.logInfo(`Required working hours: ${workingHours}h`);

    let pad = (num) => num.toString().padStart(2, '0');
    
    // Return object with text and color
    return {
        text: `${totalHours}h${pad(totalMinutes)}/${workingHours}h`,
        isOnTrack: totalHours >= workingHours,
        totalHours: totalHours,
        workingHours: workingHours
    };
}

var Calculation = {
    calculateMonthlyTotal,
    calculateWorkingDaysInMonth,
    getFrenchPublicHolidays,
};
