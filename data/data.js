/* data.js
utils for data
*/

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Soup = imports.gi.Soup;
const { Debug } = Me.imports.utils.debug;

function get_api_data(url, token, callback) {
	let session = new Soup.Session();
	let message = Soup.Message.new('GET', url);

	message.request_headers.append('Authorization', `Bearer ${token}`);

	session.queue_message(message, (_sess, msg) => {
		if (msg.status_code === 200) {
			try {
				let data = JSON.parse(msg.response_body.data);
				Debug.logSuccess(`Received JSON data:\n${JSON.stringify(data, null, 2)}`);
				callback(data);
			} catch (e) {
				Debug.logError(`Failed to parse JSON: ${e.message}`);
			}
		} else if (msg.status_code === 401) {
			Debug.logError(`Unauthorized: Invalid or expired token.`);
			callback(401);
		} else {
			Debug.logError(`HTTP error ${msg.status_code}: ${msg.reason_phrase}`);
		}
	});
}

function startPeriodicRefresh(apiUrl, token, intervalSeconds, onDataReceived, onTokenExpired) {
	function refresh() {
		try {
			get_api_data(apiUrl, token, (data) => {
				try {
					if (data === 401) {
						if (onTokenExpired) onTokenExpired();
						return;
					}
					if (onDataReceived) onDataReceived(data);

					let current_time = GLib.DateTime.new_now_local();
					Debug.logInfo(`[current: ${current_time.format("%T")}] Data refreshed`);
				} catch (e) {
					Debug.logError(`Error in refresh callback: ${e.message}`);
				}
			});
		} catch (e) {
			Debug.logError(`Error in refresh function: ${e.message}`);
		}
	}

	refresh();

	return GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, intervalSeconds, () => {
		refresh();
		return GLib.SOURCE_CONTINUE;
	});
}

var Data = {
	startPeriodicRefresh,
};
