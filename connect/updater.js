const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.utils.debug;

var UpdateManager = class UpdateManager {
    constructor() {
        // Repo root = installed extension dir
        this._repoPath = Me.path;
        this._source = null;
        this._updateAvailable = false;
    }

    checkForUpdates(onUpdateAvailable) {
        this._runGitCommand(['fetch'], (success) => {
            if (!success) return;

            this._runGitCommand(['rev-list', '--count', 'HEAD..@{u}'], (success, output) => {
                if (!success) return;

                let count = parseInt(output.trim());
                Debug.logInfo(`Git Check: ${count} commits behind`);
                if (!isNaN(count) && count > 0) {
                    // 1. Run the callback to update the Menu UI
                    if (onUpdateAvailable) {
                        onUpdateAvailable(count);
                    }
                    // 2. Show the system notification (existing logic)
                    this._notifyUser(count);
                }
            });
        });
    }

    _notifyUser(count) {
        if (!this._source) {
            this._source = new MessageTray.Source(Me.metadata.name, 'system-software-update-symbolic');
            Main.messageTray.add(this._source);
        }

        let title = 'Update Available';
        let body = `${Me.metadata.name} is ${count} commits behind. Update now?`;
        let notification = new MessageTray.Notification(this._source, title, body);

        notification.addAction('Update', () => this._performUpdate());
        this._source.notify(notification);
    }

    _performUpdate() {
        // 1. Reset EVERYTHING to match the current commit (wipes local changes)
        this._runGitCommand(['reset', '--hard', 'HEAD'], (success) => {
            if (!success) {
                global.log("[LogtimeWidget] Reset failed, trying pull anyway...");
            }

            // 2. Now Pull (should succeed because repo is clean)
            this._runGitCommand(['pull'], (success, output) => {
                if (success) {
                    Main.notify(Me.metadata.name, "Update successful! Please restart GNOME Shell.\nAlt+f2 then type r and enter.");
                } else {
                    Main.notify(Me.metadata.name, "Update failed. Check logs.");
                }
            });
        });
    }

    _runGitCommand(args, callback) {
        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });

            // Run git inside the repo root
            launcher.set_cwd(this._repoPath);

            // Avoid leaking git env from shell
            launcher.unsetenv('GIT_DIR');
            launcher.unsetenv('GIT_WORK_TREE');

            let cmd = ['git', ...args];

            let proc = launcher.spawnv(cmd);

            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);

                    if (proc.get_successful()) {
                        callback(true, stdout);
                    } else {
                        // Log stderr for debugging
                        global.log(`[LogtimeWidget] Git Error: ${stderr}`);
                        callback(false, stderr);
                    }
                } catch (e) {
                    global.logError(e);
                    callback(false, e.message);
                }
            });
        } catch (e) {
            global.logError(e);
            callback(false, e.message);
        }
    }
};
