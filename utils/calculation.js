/* calculation.js
* logtime stats, ported from attendance.42lyon.fr (AttendanceCompiler.compileStats)
* so the widget shows exactly the same done/todo as the site
*/

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.utils.debug;

const HOUR_MS = 3600 * 1000;
const WORKDAY_MS = 7 * HOUR_MS;
// A workday counts as a closure day when closures cover at least 7h of 08:00-20:00
const CLOSURE_WINDOW_START = 8;
const CLOSURE_WINDOW_END = 20;

const TZ = GLib.TimeZone.new_identifier
    ? (GLib.TimeZone.new_identifier('Europe/Paris') || GLib.TimeZone.new_local())
    : GLib.TimeZone.new('Europe/Paris');

// Calendar date in Paris, as a comparable number (20261014)
function parisKey(date) {
    let dt = GLib.DateTime.new_from_unix_utc(Math.floor(new Date(date).getTime() / 1000)).to_timezone(TZ);
    return dt.get_year() * 10000 + dt.get_month() * 100 + dt.get_day_of_month();
}

// Calendar date in UTC (attendance stores remuneration/absence dates as UTC midnights)
function utcKey(date) {
    let d = new Date(date);
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function parisTime(year, month, day, hour = 0) {
    return GLib.DateTime.new(TZ, year, month, day, hour, 0, 0).to_unix() * 1000;
}

function toMs(date) {
    return date ? new Date(date).getTime() : null;
}

function clip(start, end, from, to) {
    let s = Math.max(start, from);
    let e = Math.min(end, to);
    return e > s ? { start: s, end: e } : null;
}

// Parts of `range` not already covered by `taken`
function subtract(range, taken) {
    let pieces = [];
    let cursor = range.start;
    for (let t of [...taken].sort((a, b) => a.start - b.start)) {
        let s = Math.max(t.start, range.start);
        let e = Math.min(t.end, range.end);
        if (e <= s) continue;
        if (s > cursor) pieces.push({ start: cursor, end: s });
        cursor = Math.max(cursor, e);
        if (cursor >= range.end) break;
    }
    if (cursor < range.end) pieces.push({ start: cursor, end: range.end });
    return pieces;
}

// Time counted for one day: presences, plus locations on "with locations" days.
// Closures take priority and are never counted, overlaps are counted once.
function dayAttendanceMs(dayStart, dayEnd, history, maxPingInterval, withLocations, now) {
    let groups = [
        { counted: false, ranges: [] }, // closures
        { counted: true, ranges: [] },  // presences
        { counted: withLocations, ranges: [] }, // locations
    ];

    for (let c of history.closures || []) {
        let r = clip(toMs(c.beginAt), toMs(c.endAt), dayStart, dayEnd);
        if (r) groups[0].ranges.push(r);
    }

    for (let p of history.presences || []) {
        let started = toMs(p.startedAt);
        let saved = toMs(p.savedAt);
        let ended = toMs(p.endedAt);
        let end = ended !== null ? ended : saved;
        let r = clip(started, end, dayStart, dayEnd);
        if (r) groups[1].ranges.push(r);
        // An open presence only counts up to its last ping; the next maxPingInterval is "unsaved"
        if (ended === null) {
            let unsavedEnd = saved + maxPingInterval;
            if (end < dayEnd && unsavedEnd > dayStart)
                groups[1].ranges.push({ start: end, end: unsavedEnd, counted: false });
        }
    }

    for (let l of history.locations || []) {
        let started = toMs(l.startedAt);
        let ended = l.endedAt ? toMs(l.endedAt) : now;
        let r = clip(started, ended, dayStart, dayEnd);
        if (r) groups[2].ranges.push(r);
    }

    let taken = [];
    let total = 0;
    for (let group of groups) {
        for (let range of group.ranges) {
            for (let piece of subtract(range, taken)) {
                taken.push(piece);
                if (group.counted && range.counted !== false)
                    total += piece.end - piece.start;
            }
        }
    }
    return total;
}

function buildDays(page, now) {
    let { calendar, history, user } = page;
    let year = calendar.year;
    let month = calendar.monthIndex + 1;
    let daysInMonth = new Date(year, month, 0).getDate();

    let workdays = new Set((calendar.workdays || []).map(parisKey));
    let locationDays = new Set((calendar.withLocationsDays || []).map(parisKey));
    let internships = (page.internships || []).map((i) => ({ from: parisKey(i.start_at), to: parisKey(i.end_at) }));
    let absences = (history.absences || []).map((a) => ({ from: utcKey(a.beginDate), to: utcKey(a.endDate) }));
    let inRanges = (key, ranges) => ranges.some((r) => key >= r.from && key <= r.to);

    let days = [];
    for (let day = 1; day <= daysInMonth; day++) {
        let key = year * 10000 + month * 100 + day;
        let dayStart = parisTime(year, month, day);
        let dayEnd = GLib.DateTime.new(TZ, year, month, day, 0, 0, 0).add_days(1).to_unix() * 1000 - 1;
        let isWorkday = workdays.has(key);

        let closureMs = 0;
        let windowStart = parisTime(year, month, day, CLOSURE_WINDOW_START);
        let windowEnd = parisTime(year, month, day, CLOSURE_WINDOW_END);
        for (let c of history.closures || []) {
            let r = clip(toMs(c.beginAt), toMs(c.endAt), windowStart, windowEnd);
            if (r) closureMs += r.end - r.start;
        }

        days.push({
            key,
            isWorkday,
            excused: inRanges(key, internships) ? 'INTERNSHIP' : (inRanges(key, absences) ? 'ABSENCE' : null),
            isClosureDay: isWorkday && closureMs >= WORKDAY_MS,
            attendanceMs: dayAttendanceMs(dayStart, dayEnd, history, user.maxPingInterval || 0, locationDays.has(key), now),
        });
    }
    return days;
}

function compileStats(page, days, remunerationUser) {
    let isRemunerated = (key) => !remunerationUser ||
        (key >= utcKey(remunerationUser.beginDate) && key <= utcKey(remunerationUser.endDate));

    let baseWorkdays = 0, remuneratedWorkdays = 0, closureWorkdays = 0, userWorkdays = 0, excusedDays = 0, rawDoneMs = 0;
    for (let d of days) {
        rawDoneMs += d.attendanceMs;
        if (!d.isWorkday) continue;
        let remunerated = isRemunerated(d.key);
        baseWorkdays++;
        if (remunerated) remuneratedWorkdays++;
        if (d.isClosureDay) closureWorkdays++;
        else if (!d.excused && remunerated) userWorkdays++;
        if (remunerated && (d.excused || d.isClosureDay)) excusedDays++;
    }

    let afterExcusedMs = Math.max(0, remuneratedWorkdays * WORKDAY_MS - excusedDays * WORKDAY_MS);
    let reductionDays = Math.max(0, Math.min(page.calendar.workdayReduction || 0, baseWorkdays));
    let openWorkdays = baseWorkdays - closureWorkdays;
    let reductionRaw = reductionDays * WORKDAY_MS * (openWorkdays === 0 ? 0 : userWorkdays / openWorkdays);
    let reductionMs = reductionRaw - reductionRaw % HOUR_MS;
    let afterReductionMs = Math.max(0, afterExcusedMs - reductionMs);
    let capsulesMs = ((page.calendarUser && page.calendarUser.capsules) || [])
        .reduce((sum, c) => sum + c.batch.valueMs, 0);
    let todoMs = Math.max(0, afterReductionMs - capsulesMs);
    let doneMs = Math.max(0, Math.min(rawDoneMs, todoMs));

    return {
        doneMs,
        rawDoneMs,
        todoMs,
        capsulesMs,
        percent: todoMs === 0 ? 100 : Math.floor(doneMs / todoMs * 100),
    };
}

// Like the site: one result per remuneration active this month, keeping the one with the most to do
function calculateStats(page, now = Date.now()) {
    let days = buildDays(page, now);
    let { year, monthIndex } = page.calendar;
    let monthStart = parisTime(year, monthIndex + 1, 1);
    let monthEnd = GLib.DateTime.new(TZ, year, monthIndex + 1, 1, 0, 0, 0).add_months(1).to_unix() * 1000;

    let active = (page.user.remunerationUsers || []).filter((r) =>
        toMs(r.beginDate) < monthEnd && toMs(r.endDate) >= monthStart);

    let stats = active.length === 0
        ? compileStats(page, days, null)
        : active.map((r) => compileStats(page, days, r)).reduce((a, b) => (b.todoMs > a.todoMs ? b : a));

    let todayKey = parisKey(now);
    let today = days.find((d) => d.key === todayKey);
    stats.todayMs = today ? today.attendanceMs : 0;

    Debug.logInfo(`Attendance: done=${stats.doneMs}ms todo=${stats.todoMs}ms (${stats.percent}%)`);
    return stats;
}

// Time left before the ongoing presence expires: like the site, the last ping's ttl
// (maxPingInterval) runs from savedAt, and unsaved time is lost if nobody badges before
function getBadgeStatus(page, now = Date.now()) {
    let open = (page.history.presences || [])
        .filter((p) => !p.endedAt && !p.closedAt)
        .sort((a, b) => toMs(b.startedAt) - toMs(a.startedAt))[0];
    if (!open) return { active: false, remainingMs: 0, ttlMs: page.user.maxPingInterval || 0 };

    let saved = toMs(open.savedAt);
    let lastPing = (open.pings || []).find((p) => toMs(p.timestamp) === saved);
    let ttlMs = (lastPing && lastPing.ttlMs) || page.user.maxPingInterval || 0;
    let remainingMs = Math.max(0, saved + ttlMs - now);
    return { active: remainingMs > 0, remainingMs, ttlMs };
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

function calculateMoney(birthDate, doneMs, todoMs) {
    let rate = getMonthlyRate(birthDate);
    if (rate === null) return null;
    if (todoMs <= 0) return rate;
    return Math.min(doneMs / todoMs, 1.0) * rate;
}

function formatDuration(ms, showMinutes) {
    let totalMinutes = Math.floor(ms / 60000);
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;
    return showMinutes ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`;
}

function formatTimeDisplay(stats, showMinutes = true, displayFormat = 'ratio', showCurrentDay = false, birthDate = '', showMoney = false) {
    let todoText = stats.todoMs % HOUR_MS === 0 ? `${stats.todoMs / HOUR_MS}h` : formatDuration(stats.todoMs, true);
    let ratioText = `${formatDuration(stats.doneMs, showMinutes)}/${todoText}`;

    let remainingMs = stats.todoMs - stats.rawDoneMs;
    let remainingText = remainingMs < 0
        ? `+${formatDuration(-remainingMs, showMinutes)} above!`
        : `Remaining: ${formatDuration(remainingMs, showMinutes)}`;

    let text;
    if (displayFormat === 'remaining') text = remainingText;
    else if (displayFormat === 'all') text = `${ratioText} | ${remainingText}`;
    else text = ratioText;

    if (showCurrentDay)
        text += ` | Today: ${formatDuration(stats.todayMs, showMinutes)}`;

    if (showMoney) {
        let earned = calculateMoney(birthDate, stats.doneMs, stats.todoMs);
        if (earned !== null)
            text += ` | ${earned.toFixed(2)}€`;
    }

    return { text, percent: stats.percent };
}

var Calculation = {
    calculateStats,
    getBadgeStatus,
    formatDuration,
    calculateMoney,
    getMonthlyRate,
    formatTimeDisplay,
};
