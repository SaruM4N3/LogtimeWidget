/* data.js
utils for data
*/

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Soup = imports.gi.Soup;
const { Debug } = Me.imports.utils.debug;
const { Calculation } = Me.imports.utils.calculation;

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

function startPeriodicRefresh(label, apiUrl, token, intervalSeconds, getShowMinutes, getDisplayFormat, getBonusDays, getGiftDays, onDataReceived, onTokenExpired) {
	function refresh() {
		try {
			get_api_data(apiUrl, token, (data) => {
				try {
					if (data === 401) {
						label.set_text('Token expired, reconnecting...');
						Debug.logError('Unauthorized token');
						if (onTokenExpired) onTokenExpired();
						return;
					}

					if (onDataReceived) {
						onDataReceived(data);
					}

					let showMinutes = getShowMinutes ? getShowMinutes() : true;
					let displayFormat = getDisplayFormat ? getDisplayFormat() : 'ratio';
					let bonusDays = getBonusDays ? getBonusDays() : 0;
					let giftDays = getGiftDays ? getGiftDays() : 0;
					let result = Calculation.formatTimeDisplay(data, bonusDays, giftDays, showMinutes, displayFormat);
					label.set_text(result.text);

					let current_time = GLib.DateTime.new_now_local();
					Debug.logInfo(`[current: ${current_time.format("%T")}] Refreshed: ${result.text}`);
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
	get_api_data,
	startPeriodicRefresh,
};
