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
