/* data.js
utils for data
*/

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Soup = imports.gi.Soup;
const { Debug } = Me.imports.utils.debug;

function get_api_data(url, token, callback) {
	let allData = [];

	function fetchPage(page) {
		let session = new Soup.Session();
		let pageUrl = `${url}&page=${page}`;
		let message = Soup.Message.new('GET', pageUrl);

		message.request_headers.append('Authorization', `Bearer ${token}`);

		session.queue_message(message, (_sess, msg) => {
			if (msg.status_code === 200) {
				try {
					let data = JSON.parse(msg.response_body.data);
					allData = allData.concat(data);

					let total = parseInt(msg.response_headers.get('X-Total') || '0');
					let fetched = allData.length;
					Debug.logInfo(`Fetched page ${page}: ${data.length} items (${fetched}/${total} total)`);

					if (fetched < total) {
						fetchPage(page + 1);
					} else {
						Debug.logSuccess(`All pages fetched: ${fetched} sessions`);
						callback(allData);
					}
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

	fetchPage(1);
}

function buildApiUrl(username) {
	let now = new Date();
	// Use local midnight as boundaries so sessions between 00:00–02:00 local aren't missed
	let firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
	let lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
	return `https://api.intra.42.fr/v2/users/${username}/locations?per_page=100&sort=begin_at&range[begin_at]=${firstDay},${lastDay}`;
}

function startPeriodicRefresh(username, token, intervalSeconds, onDataReceived, onTokenExpired) {
	function refresh() {
		let apiUrl = buildApiUrl(username);
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
	buildApiUrl,
};
