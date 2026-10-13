/* login.js
    standalone login window (run with gjs, outside of gnome-shell)
    usage: gjs login.js <session_file> <webkit_data_dir>
    opens the 42 Intra OAuth flow of attendance.42lyon.fr and saves the session cookie
 */

imports.gi.versions.Gtk = '3.0';
imports.gi.versions.WebKit2 = '4.0';
imports.gi.versions.Soup = '2.4';
const { Gtk, WebKit2, GLib, Gio } = imports.gi;

const BASE_URL = 'https://attendance.42lyon.fr';
const OAUTH_STATE_COOKIE = 'attendance-oauth';

const [sessionFile, dataDir] = ARGV;
if (!sessionFile || !dataDir) {
    printerr('usage: gjs login.js <session_file> <webkit_data_dir>');
    imports.system.exit(2);
}

// Software rendering: avoids blank pages / GBM errors on machines with broken GPU drivers
GLib.setenv('WEBKIT_DISABLE_COMPOSITING_MODE', '1', false);
GLib.setenv('WEBKIT_DISABLE_DMABUF_RENDERER', '1', false);

let exitCode = 1;
let saving = false;

Gtk.init(null);

GLib.mkdir_with_parents(dataDir, 0o700);
let dataManager = new WebKit2.WebsiteDataManager({
    base_data_directory: dataDir,
    base_cache_directory: GLib.build_filenamev([dataDir, 'cache']),
});
let context = WebKit2.WebContext.new_with_website_data_manager(dataManager);
let cookieManager = context.get_cookie_manager();
// Keep the intra session between logins so expired sessions renew without typing the password again
cookieManager.set_persistent_storage(
    GLib.build_filenamev([dataDir, 'cookies.sqlite']),
    WebKit2.CookiePersistentStorage.SQLITE
);

let webView = new WebKit2.WebView({ web_context: context });
webView.get_settings().hardware_acceleration_policy = WebKit2.HardwareAccelerationPolicy.NEVER;

let window = new Gtk.Window({
    title: 'Logtime Widget - Login to Attendance 42 Lyon',
    default_width: 900,
    default_height: 750,
});
window.add(webView);
window.connect('destroy', () => Gtk.main_quit());

function isLoggedInUri(uri) {
    if (!uri || !uri.startsWith(BASE_URL + '/')) return false;
    let path = uri.slice(BASE_URL.length).split(/[?#]/)[0];
    return !/^\/(fr\/)?login\b/.test(path) && !path.startsWith('/api/auth');
}

function saveSession() {
    saving = true;
    cookieManager.get_cookies(BASE_URL + '/', null, (manager, res) => {
        try {
            let cookies = manager.get_cookies_finish(res)
                .filter((c) => c.get_name() !== OAUTH_STATE_COOKIE);
            if (cookies.length === 0) {
                saving = false;
                return;
            }
            let cookie = cookies.map((c) => `${c.get_name()}=${c.get_value()}`).join('; ');
            let data = JSON.stringify({ cookie: cookie, savedAt: new Date().toISOString() }, null, 2);
            GLib.mkdir_with_parents(GLib.path_get_dirname(sessionFile), 0o700);
            Gio.File.new_for_path(sessionFile).replace_contents(
                data, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            exitCode = 0;
            window.destroy();
        } catch (e) {
            printerr(`Failed to save session: ${e.message}`);
            saving = false;
        }
    });
}

webView.connect('load-changed', (view, event) => {
    if (event === WebKit2.LoadEvent.FINISHED && !saving && isLoggedInUri(view.get_uri()))
        saveSession();
});

webView.load_uri(BASE_URL + '/api/auth');
window.show_all();
Gtk.main();

imports.system.exit(exitCode);
