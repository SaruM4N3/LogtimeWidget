const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.utils.debug;

var UpdateManager = class UpdateManager {
    constructor() {
        this._repoPath = Me.path;
        this._source = null;
        this._updateAvailable = false;
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

    _reloadSelf() {
        let bus = Gio.DBus.session;

        // Disable
        bus.call(
            'org.gnome.Shell.Extensions',
            '/org/gnome/Shell/Extensions',
            'org.gnome.Shell.Extensions',
            'DisableExtension',
            new GLib.Variant('(s)', [Me.metadata.uuid]),
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            null
        );

        // Re‑enable
        bus.call(
            'org.gnome.Shell.Extensions',
            '/org/gnome/Shell/Extensions',
            'org.gnome.Shell.Extensions',
            'EnableExtension',
            new GLib.Variant('(s)', [Me.metadata.uuid]),
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            null
        );
    }

    _checkForUpdates(onUpdateAvailable) {
        this._runGitCommand(['fetch'], (success) => {
            if (!success) return;

            this._runGitCommand(['rev-list', '--count', 'HEAD..@{u}'], (success, output) => {
                if (!success) return;

                let count = parseInt(output.trim());
                Debug.logInfo(`Git Check: ${count} commits behind`);
                if (!isNaN(count) && count > 0) {
                    if (onUpdateAvailable) {
                        onUpdateAvailable(count);
                    }
                    this._notifyUser(count);
                }
            });
        });
    }

    _performUpdate() {
        // 1. Reset
        this._runGitCommand(['reset', '--hard', 'HEAD'], (success) => {
            if (!success) {
                global.log("[LogtimeWidget] Reset failed, trying pull anyway...");
            }

            // 2. Pull
            this._runGitCommand(['pull'], (success, output) => {
                if (success) {
                    Main.notify(Me.metadata.name, "Update successful! Reloading extension…");
                    // 3. Restart
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                        _reloadSelf();
                        return GLib.SOURCE_REMOVE;
                    });
                }
                else {
                    Main.notify(Me.metadata.name, "Update failed. Check logs.");
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

};
