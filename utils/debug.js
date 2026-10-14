/* debug.js
 * Logging utility for your GNOME extension
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Me = imports.misc.extensionUtils.getCurrentExtension();

// Log file opened from Settings; outside the extension dir so updates keep it
const LOG_DIR = GLib.build_filenamev([GLib.get_user_data_dir(), 'LogtimeWidget']);
const LOG_FILE = GLib.build_filenamev([LOG_DIR, 'logtime.log']);
const LOG_MAX_BYTES = 512 * 1024;

// Appends a line to LOG_FILE, moving it to logtime.log.old once it gets too big
function writeToFile(line) {
    try {
        GLib.mkdir_with_parents(LOG_DIR, 0o755);
        let file = Gio.File.new_for_path(LOG_FILE);
        try {
            let size = file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size();
            if (size > LOG_MAX_BYTES)
                file.move(Gio.File.new_for_path(`${LOG_FILE}.old`), Gio.FileCopyFlags.OVERWRITE, null, null);
        } catch (e) {
            // No log file yet
        }
        let stream = file.append_to(Gio.FileCreateFlags.NONE, null);
        let time = GLib.DateTime.new_now_local().format('%F %T');
        stream.write_all(new TextEncoder().encode(`${time} ${line}\n`), null);
        stream.close(null);
    } catch (e) {
        log(`[${Me.metadata.name}] Failed to write log file: ${e.message}`);
    }
}

function cLog(type, message) {
    const RESET = '\x1b[0m';
    const COLORS = {
        info: '\x1b[36m',     // Cyan
        success: '\x1b[32m',  // Green
        warn: '\x1b[33m',     // Yellow
        error: '\x1b[31m',    // Red
        debug: '\x1b[35m',    // Magenta
    };

    const LABEL = {
        info:  '[INFO]',
        success: '[OK]',
        warn:  '[WARN]',
        error: '[ERROR]',
        debug: '[DEBUG]',
    };

    let caller = 'unknown';
    try {
        const stack = new Error().stack;
        const stackLines = stack.split('\n');
        if (stackLines.length > 2) {
            const callerLine = stackLines[2];
            const match = callerLine.match(/(.+)@(.+):(\d+):(\d+)/);
            if (match) {
                const functionName = match[1].trim();
                const file = match[2].split('/').pop(); // Get just filename
                const lineNum = match[3];
                caller = `${functionName}@${file}:${lineNum}`;
            } else {
                caller = callerLine.trim();
            }
        }
    } catch (e) {
    }

    let color = COLORS[type] || RESET;
    let label = LABEL[type] || '[LOG]';
    log(`${color}[${Me.metadata.name}] ${label} [${caller}] ${message}${RESET}`);
    writeToFile(`${label} [${caller}] ${message}`);
}


function logInfo(msg) { cLog('info', msg); }
function logWarn(msg) { cLog('warn', msg); }
function logError(msg) { cLog('error', msg); }
function logSuccess(msg) { cLog('success', msg); }
function logDebug(msg) { cLog('debug', msg); }

var Debug = {
    logInfo,
    logWarn,
    logError,
    logSuccess,
    logDebug,
    LOG_FILE,
};
