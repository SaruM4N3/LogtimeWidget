const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var UpdateManager = class UpdateManager {
    constructor() {
        this._extensionPath = Me.path;
        this._source = null;
    }

    // Entry point: Call this from enable()
    checkForUpdates() {
        // 1. Fetch latest changes from remote
        this._runGitCommand(['fetch'], (success) => {
            if (!success) return;

            // 2. Check if we are behind (count commits between HEAD and upstream)
            // @{u} means "current branch's upstream"
            this._runGitCommand(['rev-list', '--count', 'HEAD..@{u}'], (success, output) => {
                if (!success) return;

                let count = parseInt(output.trim());
                if (!isNaN(count) && count > 0) {
                    this._notifyUser(count);
                }
            });
        });
    }

    _notifyUser(count) {
        if (!this._source) {
            // Create a notification source for your extension
            this._source = new MessageTray.Source(Me.metadata.name, 'system-software-update-symbolic');
            Main.messageTray.add(this._source);
        }

        let title = 'Update Available';
        let body = `${Me.metadata.name} is ${count} commits behind. Update now?`;
        let notification = new MessageTray.Notification(this._source, title, body);

        // Add the "Update" button
        notification.addAction('Update', () => {
            this._performUpdate();
        });

        this._source.notify(notification);
    }

    _performUpdate() {
        // 3. Pull the changes
        this._runGitCommand(['pull'], (success, output) => {
            if (success) {
                Main.notify(Me.metadata.name, "Update successful! Please restart GNOME Shell (Alt+F2, r).");
            } else {
                Main.notify(Me.metadata.name, "Update failed. Check logs.");
                logError(output); // Log the error
            }
        });
    }

    // Helper to run git commands asynchronously
    _runGitCommand(args, callback) {
        try {
            // Construct command: git -C /path/to/extension [args]
            let cmd = ['git', '-C', this._extensionPath, ...args];
            
            let proc = Gio.Subprocess.new(
                cmd,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                    
                    // Check exit status
                    if (proc.get_successful()) {
                        callback(true, stdout);
                    } else {
                        // Git often prints warnings to stderr (like your libpcre2 warning), 
                        // so we only fail if the process exit code is bad.
                        log(`[${Me.metadata.name}] Git Error: ${stderr}`);
                        callback(false, stderr);
                    }
                } catch (e) {
                    logError(e);
                    callback(false, e.message);
                }
            });
        } catch (e) {
            logError(e);
            callback(false, e.message);
        }
    }
};
