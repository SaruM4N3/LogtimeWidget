/* data.js
utils for data
*/

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Soup = imports.gi.Soup;
const { Debug } = Me.imports.utils.debug;
const { Calculation } = Me.imports.utils.calculation;

const user = GLib.get_user_name();
const LIVE_JSON_ADRESS = `https://translate.intra.42.fr/users/${user}/locations_stats.json`;

function deleteCookiesFile() {
	try {
		const cookiesPath = GLib.build_filenamev([
			GLib.get_home_dir(),
			'.local/share/gnome-shell/extensions/LogtimeWidget@zsonie',
			'.intra42_cookies.json'
		]);

		const file = Gio.File.new_for_path(cookiesPath);

		if (file.query_exists(null)) {
			file.delete(null);
			log('LogtimeWidget: Cookies file deleted successfully');
			return true;
		} else {
			log('LogtimeWidget: Cookies file does not exist');
			return false;
		}
	} catch (e) {
		logError(e, 'LogtimeWidget: Failed to delete cookies file');
		return false;
	}
}

function get_scraped_data(session_cookie, callback) {
	let session = new Soup.Session();
	let message = Soup.Message.new('GET', LIVE_JSON_ADRESS);
	message.request_headers.append('Cookie', `_intra_42_session_production=${session_cookie}`);

	session.queue_message(message, function (sess, msg) {
		if (msg.status_code === 200) {
			try {
				let data = JSON.parse(msg.response_body.data);
				Debug.logInfo("[Scrape] Got live data, calling callback...");

				// Wrap callback execution in try/catch
				try {
					callback(data);
					Debug.logInfo("[Scrape] Callback completed successfully");
				} catch (callbackError) {
					Debug.logError(`[Scrape] Error in callback: ${callbackError.message}`);
					Debug.logError(`[Scrape] Stack: ${callbackError.stack}`);
				}
			} catch (e) {
				deleteCookiesFile();
				Debug.logError("[Scrape] Parse error: " + e.message);
			}
		} else {
			Debug.logError(`[Scrape] HTTP error ${msg.status_code}: ${msg.reason_phrase}`);
			try {
				callback(null);
			} catch (callbackError) {
				Debug.logError(`[Scrape] Error in error callback: ${callbackError.message}`);
			}
		}
	});
}


function get_api_data(url, token, callback) {
	let session = new Soup.Session();
	let message = Soup.Message.new('GET', url);

	message.request_headers.append('Authorization', `Bearer ${token}`);

	session.queue_message(message, (sess, msg) => {
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

function startPeriodicRefresh(label, apiUrl, token, intervalSeconds, getBonusDays, getGiftDays, onDataReceived) {
	function refresh() {
		try {
			get_api_data(apiUrl, token, (data) => {
				try {
					if (data === 401) {
						label.set_text('Access token invalid or expired.');
						Debug.logError('Unauthorized token');
						return;
					}

					if (onDataReceived) {
						onDataReceived(data);
					}

					let bonusDays = getBonusDays ? getBonusDays() : 0;
					let giftDays = getGiftDays ? getGiftDays() : 0;
					let totalTimeStr = Calculation.calculateMonthlyTotal(data, bonusDays, giftDays);
					label.set_text(totalTimeStr);
					let current_time = GLib.DateTime.new_now_local();
					Debug.logInfo(`[current: ${current_time.format("%T")}] Refreshed: ${totalTimeStr}`);
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

function scrapedPeriodicRefresh(label, session_cookie, intervalSeconds, getShowMinutes, getDisplayFormat, getBonusDays, getGiftDays, onDataReceived) {
	function refresh() {
		try {
			get_scraped_data(session_cookie, (data) => {
				try {
					if (data === 401) {
						label.set_text('Access token invalid or expired.');
						Debug.logError('Unauthorized token');
						return;
					}

					if (onDataReceived)
						onDataReceived(data);

					let showMinutes = getShowMinutes ? getShowMinutes() : 0;
					let displayFormat = getDisplayFormat ? getDisplayFormat() : 0;
					Debug.logDebug(displayFormat);
					let bonusDays = getBonusDays ? getBonusDays() : 0;
					let giftDays = getGiftDays ? getGiftDays() : 0;
					let result = Calculation.formatTimeDisplay(data, bonusDays, giftDays, showMinutes, displayFormat);
					Debug.logDebug(result.text);
					label.set_text(result.text);

					let current_time = GLib.DateTime.new_now_local();
					let timeLabel = '??:??:??';

					if (current_time) {
						timeLabel = current_time.format('%T');
					} else {
						Debug.logError('GLib.DateTime.new_now_local() returned null');
					}

					Debug.logSuccess(
						`[${timeLabel}] Refreshed: ${result.text} (${result.isOnTrack ? 'ON TRACK' : 'BEHIND'})`
					);
				} catch (e) {
					Debug.logError(`Error in refresh callback: ${e}`);
					Debug.logError(`Message: ${e.message}`);
					Debug.logError(`Stack: ${e.stack}`);
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
	deleteCookiesFile,
	get_scraped_data,
	get_api_data,
	startPeriodicRefresh,
	scrapedPeriodicRefresh,
};
