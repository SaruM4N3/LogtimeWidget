/* connect.js
    connection functions to get access
 */

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;

const { MyStorage } = Me.imports.data.storage;
const { Debug } = Me.imports.utils.debug;

let _loginProc = null;

// Opens the login window (connect/login.js) in a separate gjs process.
// The window writes MyStorage.SESSION_FILE on success; callback(success) runs when it closes.
function login(callback) {
    if (_loginProc) {
        Debug.logInfo('Login window already open');
        return;
    }

    try {
        _loginProc = Gio.Subprocess.new(
            ['gjs', `${Me.path}/connect/login.js`, MyStorage.SESSION_FILE, MyStorage.WEBKIT_DIR],
            Gio.SubprocessFlags.NONE
        );
    } catch (e) {
        Debug.logError(`Failed to open login window: ${e.message}`);
        if (callback) callback(false);
        return;
    }

    _loginProc.wait_async(null, (proc, res) => {
        if (proc !== _loginProc) return; // cancelled
        let success = false;
        try {
            proc.wait_finish(res);
            success = proc.get_successful();
        } catch (e) {
            Debug.logError(`Login window failed: ${e.message}`);
        }
        _loginProc = null;
        Debug.logInfo(`Login window closed (success: ${success})`);
        if (callback) callback(success);
    });
}

function cancelLogin() {
    if (_loginProc) {
        _loginProc.force_exit();
        _loginProc = null;
    }
}

var Connect = {
    login,
    cancelLogin,
};
