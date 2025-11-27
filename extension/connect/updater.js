const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var UpdateManager = class UpdateManager {
    constructor() {
        let path = Me.path;
        
        if (GLib.file_test(path, GLib.FileTest.IS_SYMLINK)) {
            let target = GLib.file_read_link(path);
            
            if (target.startsWith('/')) {
                path = target;
            } else {
                let parent = GLib.path_get_dirname(path);
                path = GLib.build_filenamev([parent, target]);
            }
        }
        
        // Now 'path' is "/home/user/.config/gnome-extensions-source/LogtimeWidget/extension"
        this._repoPath = GLib.path_get_dirname(path);
        
        global.log(`[LogtimeWidget] Git Repo Path: ${this._repoPath}`);
        this._source = null;
    }


    checkForUpdates() {
        this._runGitCommand(['fetch'], (success) => {
            if (!success) return;

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
            this._source = new MessageTray.Source(Me.metadata.name, 'system-software-update-symbolic');
            Main.messageTray.add(this._source);
        }

        let title = 'Update Available';
        let body = `${Me.metadata.name} is ${count} commits behind. Update now?`;
        let notification = new MessageTray.Notification(this._source, title, body);

        notification.addAction('Update', () => {
            this._performUpdate();
        });

        this._source.notify(notification);
    }

    _performUpdate() {
        this._runGitCommand(['pull'], (success, output) => {
            if (success) {
                Main.notify(Me.metadata.name, "Update successful! Please restart GNOME Shell (Alt+F2, r).");
            } else {
                Main.notify(Me.metadata.name, "Update failed. Check logs.");
                global.log(`[LogtimeWidget] Update failed: ${output}`);
            }
        });
    }

    // Helper to run git commands asynchronously
    _runGitCommand(args, callback) {
        try {
            let cmd = ['git', '-C', this._repoPath, ...args];
            
            let proc = Gio.Subprocess.new(
                cmd,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                    
                    if (proc.get_successful()) {
                        callback(true, stdout);
                    } else {
                        global.log(`[LogtimeWidget] Git Output: ${stderr}`);
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
