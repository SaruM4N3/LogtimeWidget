/* debug.js
 * Logging utility for your GNOME extension
 */

const Me = imports.misc.extensionUtils.getCurrentExtension();

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

    let color = COLORS[type] || RESET;
    let label = LABEL[type] || '[LOG]';
    log(`${color}[${Me.metadata.name}] ${label} ${message}${RESET}`);
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
    logDebug
};
