const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Debug } = Me.imports.utils.debug;

var UpdateManager = class UpdateManager {
    constructor() {
        // Repo root = installed extension dir (install.sh copies .git there)
        this._repoPath = Me.path;
        this._source = null;
        this._notifiedHead = null;
    }

    checkForUpdates(onUpdateAvailable) {
        this._runGitCommand(['fetch'], (success) => {
            if (!success) return;

            this._runGitCommand(['rev-list', '--count', 'HEAD..@{u}'], (success, output) => {
                if (!success) return;

                let count = parseInt(output.trim());
                Debug.logInfo(`Git Check: ${count} commits behind`);
                if (isNaN(count) || count <= 0) return;

                if (onUpdateAvailable)
                    onUpdateAvailable(count);

                // Notify once per new upstream commit, not on every check
                this._runGitCommand(['rev-parse', '@{u}'], (success, head) => {
                    if (!success || head.trim() === this._notifiedHead) return;
                    this._notifiedHead = head.trim();
                    this._notifyUser(count);
                });
            });
        });
    }

    _notifyUser(count) {
        if (!this._source) {
            this._source = new MessageTray.Source(Me.metadata.name, 'system-software-update-symbolic');
            this._source.connect('destroy', () => { this._source = null; });
            Main.messageTray.add(this._source);
        }

        let title = 'Update Available';
        let body = `${Me.metadata.name} is ${count} commits behind. Update now?`;
        let notification = new MessageTray.Notification(this._source, title, body);

        notification.addAction('Update', () => this._performUpdate());
        this._source.showNotification(notification);
    }

    // Moves the installed copy to the upstream commit. reset --hard @{u} also replaces
    // untracked files that the update adds (a pull refuses to), while ignored files
    // (utils/*.json: settings and session) are kept.
    _performUpdate() {
        this._runGitCommand(['fetch'], (success) => {
            if (!success) {
                Main.notify(Me.metadata.name, 'Update failed: could not reach GitHub. Check the logs.');
                return;
            }
            this._runGitCommand(['reset', '--hard', '@{u}'], (success) => {
                if (success) {
                    Debug.logSuccess('Update installed');
                    Main.notify(Me.metadata.name, 'Update successful! Please restart GNOME Shell.\nAlt+F2 then type r and Enter (or log out on Wayland).');
                } else {
                    Main.notify(Me.metadata.name, 'Update failed. Check the logs.');
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
            // Never wait for credentials: there is no terminal to type them in
            launcher.setenv('GIT_TERMINAL_PROMPT', '0', true);
            launcher.setenv('GIT_SSH_COMMAND', 'ssh -o BatchMode=yes', true);

            let proc = launcher.spawnv(['git', ...args]);

            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);

                    if (proc.get_successful()) {
                        callback(true, stdout);
                    } else {
                        Debug.logError(`git ${args.join(' ')} failed: ${stderr.trim()}`);
                        callback(false, stderr);
                    }
                } catch (e) {
                    Debug.logError(`git ${args.join(' ')} failed: ${e.message}`);
                    callback(false, e.message);
                }
            });
        } catch (e) {
            Debug.logError(`git ${args.join(' ')} failed: ${e.message}`);
            callback(false, e.message);
        }
    }
};
