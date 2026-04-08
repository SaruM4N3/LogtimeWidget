/* calculation.js
* utils for calculation and time parsing
*/

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.utils.debug;

function getFrenchPublicHolidays(year) {
    let holidays = [
        `${year}-01-01`, // Jour de l'an
        `${year}-05-01`, // Fête du Travail
        `${year}-05-08`, // Victoire 1945
        `${year}-07-14`, // Fête nationale
        `${year}-08-15`, // Assomption
        `${year}-11-01`, // Toussaint
        `${year}-11-11`, // Armistice 1918
        `${year}-12-25`, // Noël
    ];

    let easter = calculateEaster(year);
    holidays.push(easter);
    holidays.push(addDaysToDate(easter, 38)); // Ascension (39 days after Easter Sunday = 38 after Easter Monday)
    holidays.push(addDaysToDate(easter, 49)); // Lundi de Pentecôte (50 days after Easter Sunday = 49 after Easter Monday)

    return holidays;
}

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

    let easterMonday = GLib.DateTime.new_local(year, month, day, 0, 0, 0).add_days(1);
    return `${year}-${String(easterMonday.get_month()).padStart(2, '0')}-${String(easterMonday.get_day_of_month()).padStart(2, '0')}`;
}

function addDaysToDate(dateStr, days) {
    let parts = dateStr.split('-');
    let newDate = GLib.DateTime.new_local(
        parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]), 0, 0, 0
    ).add_days(days);
    return `${newDate.get_year()}-${String(newDate.get_month()).padStart(2, '0')}-${String(newDate.get_day_of_month()).padStart(2, '0')}`;
}

function calculateWorkingDaysInMonth() {
    let now = GLib.DateTime.new_now_local();

    if (!now) {
        Debug.logError('GLib.DateTime.new_now_local() returned null');
        return 20;
    }

    let year = now.get_year();
    let month = now.get_month();
    let holidaySet = new Set(getFrenchPublicHolidays(year));
    let daysInMonth = new Date(year, month, 0).getDate();
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

// Barème Auvergne-Rhône-Alpes actualisé au 01/04/2025
function getMonthlyRate(birthDate) {
    if (!birthDate) return null;
    let parts = birthDate.split('-');
    if (parts.length !== 3) return null;

    let now = new Date();
    let birth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(birth.getTime())) return null;

    let age = now.getFullYear() - birth.getFullYear();
    let m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;

    if (age >= 26) return 769.49;
    if (age >= 18) return 561.68;
    if (age >= 16) return 224.68;
    return null;
}

function calculateMoney(birthDate, totalHours, workingHours) {
    let rate = getMonthlyRate(birthDate);
    if (rate === null) return null;
    if (workingHours <= 0) return rate;
    let ratio = Math.min(totalHours / workingHours, 1.0);
    return ratio * rate;
}

function calculateTodayTotal(data) {
    let now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1;
    let currentDay = now.getDate();
    let totalSeconds = 0;

    // Day boundaries in local time — clamp so midnight-crossing sessions are counted correctly
    let dayStart = new Date(currentYear, currentMonth - 1, currentDay, 0, 0, 0, 0);
    let dayEnd   = new Date(currentYear, currentMonth - 1, currentDay, 23, 59, 59, 999);

    if (Array.isArray(data)) {
        for (let session of data) {
            let beginAt = new Date(session.begin_at);
            let endAt   = session.end_at ? new Date(session.end_at) : now;
            if (endAt <= dayStart || beginAt >= dayEnd) continue;
            let effectiveBegin = beginAt < dayStart ? dayStart : beginAt;
            let effectiveEnd   = endAt   > dayEnd   ? dayEnd   : endAt;
            totalSeconds += (effectiveEnd - effectiveBegin) / 1000;
        }
    } else {
        let pad = (n) => String(n).padStart(2, '0');
        let todayStr = `${currentYear}-${pad(currentMonth)}-${pad(currentDay)}`;
        if (data[todayStr]) {
            let timeParts = data[todayStr].split(':');
            if (timeParts.length >= 3)
                totalSeconds += parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseFloat(timeParts[2]);
        }
    }

    return {
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: Math.floor(totalSeconds % 60),
    };
}

function calculateMonthlyTotal(data, bonusDays = 0, giftDays = 0) {
    let now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1;

    let totalSeconds = 0;

    if (Array.isArray(data)) {
        for (let session of data) {
            let beginAt = new Date(session.begin_at);
            if (beginAt.getFullYear() !== currentYear || (beginAt.getMonth() + 1) !== currentMonth) continue;
            let endAt = session.end_at ? new Date(session.end_at) : now;
            totalSeconds += (endAt - beginAt) / 1000;
        }
    } else {
        for (let dateStr in data) {
            let y = parseInt(dateStr.slice(0, 4));
            let m = parseInt(dateStr.slice(5, 7));

            if (y === currentYear && m === currentMonth) {
                let timeParts = data[dateStr].split(':');
                if (timeParts.length >= 3) {
                    totalSeconds += parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseFloat(timeParts[2]);
                }
            }
        }
    }

    totalSeconds += bonusDays * 7 * 3600;

    let totalHours = Math.floor(totalSeconds / 3600);
    let totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    let totalSecs = Math.floor(totalSeconds % 60);

    let workingDays = calculateWorkingDaysInMonth();
    let clampedGiftDays = Math.min(giftDays, workingDays);
    let effectiveWorkingDays = Math.max(0, workingDays - clampedGiftDays);
    let workingHours = effectiveWorkingDays * 7;

    Debug.logInfo(`Working days: ${workingDays}, gift: ${giftDays}, required: ${workingHours}h`);

    return {
        isOnTrack: totalHours >= workingHours,
        totalHours,
        totalMinutes,
        totalSecs,
        totalSeconds,
        workingHours,
        workingDays: effectiveWorkingDays,
    };
}

function formatTimeDisplay(data, bonusDays, giftDays, showMinutes = true, displayFormat = 'ratio', showCurrentDay = false, birthDate = '', showMoney = false, showSeconds = false) {
    let result = calculateMonthlyTotal(data, bonusDays, giftDays);
    let pad = (num) => num.toString().padStart(2, '0');

    let fmtDuration = (hours, minutes, seconds) => {
        if (showSeconds && showMinutes) return `${hours}h${pad(minutes)}m${pad(seconds)}s`;
        if (showMinutes)                return `${hours}h${pad(minutes)}`;
        return `${hours}h`;
    };

    let todaySuffix = '';
    if (showCurrentDay) {
        let today = calculateTodayTotal(data);
        todaySuffix = ` | Today: ${fmtDuration(today.hours, today.minutes, today.seconds)}`;
    }

    let moneySuffix = '';
    if (showMoney) {
        let earned = calculateMoney(birthDate, result.totalSeconds / 3600.0, result.workingHours);
        if (earned !== null)
            moneySuffix = ` | ${earned.toFixed(3)}€`;
    }

    if (displayFormat === 'remaining') {
        let remainingSeconds = (result.workingHours * 3600) - result.totalSeconds;
        let isAhead = remainingSeconds < 0;
        let abs = Math.abs(remainingSeconds);
        let absH = Math.floor(abs / 3600);
        let absM = Math.floor((abs % 3600) / 60);
        let absS = Math.floor(abs % 60);

        let text = isAhead
            ? `+${fmtDuration(absH, absM, absS)} above!`
            : `Remaining: ${fmtDuration(absH, absM, absS)}`;

        return { text: text + todaySuffix + moneySuffix, isOnTrack: isAhead, totalHours: result.totalHours, totalMinutes: result.totalMinutes, workingHours: result.workingHours };
    }

    let ratioText = `${fmtDuration(result.totalHours, result.totalMinutes, result.totalSecs)}/${result.workingHours}h`;

    if (displayFormat === 'all') {
        let remainingSeconds = (result.workingHours * 3600) - result.totalSeconds;
        let isAhead = remainingSeconds < 0;
        let abs = Math.abs(remainingSeconds);
        let absH = Math.floor(abs / 3600);
        let absM = Math.floor((abs % 3600) / 60);
        let absS = Math.floor(abs % 60);
        let remainingText = isAhead
            ? `+${fmtDuration(absH, absM, absS)} above!`
            : `Remaining: ${fmtDuration(absH, absM, absS)}`;

        return { text: `${ratioText} | ${remainingText}` + todaySuffix + moneySuffix, isOnTrack: result.isOnTrack, totalHours: result.totalHours, totalMinutes: result.totalMinutes, workingHours: result.workingHours };
    }

    // ratio (default)
    return { text: ratioText + todaySuffix + moneySuffix, isOnTrack: result.isOnTrack, totalHours: result.totalHours, totalMinutes: result.totalMinutes, workingHours: result.workingHours };
}

var Calculation = {
    calculateMonthlyTotal,
    calculateTodayTotal,
    calculateWorkingDaysInMonth,
    getFrenchPublicHolidays,
    calculateMoney,
    getMonthlyRate,
    formatTimeDisplay,
};
