/* data.js
utils for data
*/

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Soup = imports.gi.Soup;
const { Debug } = Me.imports.utils.debug;

const SESSION_EXPIRED = 401;

// Decodes the "devalue" format SvelteKit uses for __data.json nodes
function unflatten(values) {
	const specials = { '-1': undefined, '-3': NaN, '-4': Infinity, '-5': -Infinity, '-6': -0 };
	const hydrated = {};

	function hydrate(index) {
		if (index < 0) return specials[index];
		if (index in hydrated) return hydrated[index];

		const value = values[index];
		if (!value || typeof value !== 'object') {
			hydrated[index] = value;
		} else if (Array.isArray(value)) {
			if (typeof value[0] === 'string') {
				switch (value[0]) {
					case 'Date': hydrated[index] = new Date(value[1]); break;
					case 'BigInt': hydrated[index] = BigInt(value[1]); break;
					case 'RegExp': hydrated[index] = new RegExp(value[1], value[2]); break;
					case 'Set': {
						const set = new Set();
						hydrated[index] = set;
						for (let i = 1; i < value.length; i++) set.add(hydrate(value[i]));
						break;
					}
					case 'Map': {
						const map = new Map();
						hydrated[index] = map;
						for (let i = 1; i < value.length; i += 2) map.set(hydrate(value[i]), hydrate(value[i + 1]));
						break;
					}
					case 'null': {
						const obj = Object.create(null);
						hydrated[index] = obj;
						for (let i = 1; i < value.length; i += 2) obj[value[i]] = hydrate(value[i + 1]);
						break;
					}
					default: hydrated[index] = hydrate(value[1]);
				}
			} else {
				const array = new Array(value.length);
				hydrated[index] = array;
				value.forEach((n, i) => { if (n !== -2) array[i] = hydrate(n); });
			}
		} else {
			const obj = {};
			hydrated[index] = obj;
			for (const key in value) obj[key] = hydrate(value[key]);
		}
		return hydrated[index];
	}

	return hydrate(0);
}

// Returns the /me month node: {user, history, calendar, calendarUser, internships}.
// (me.presences only holds the ongoing presence, the month is in history.presences)
function extractAttendance(page) {
	for (const node of page.nodes || []) {
		if (!node || node.type !== 'data' || !Array.isArray(node.data)) continue;
		const data = unflatten(node.data);
		if (data && data.calendar && data.history && data.user)
			return data;
	}
	return null;
}

function get_page_data(url, cookie, callback) {
	let session = new Soup.Session();
	let message = Soup.Message.new('GET', url);

	message.request_headers.append('Cookie', cookie);

	session.queue_message(message, (_sess, msg) => {
		if (msg.status_code === 401 || msg.status_code === 403) {
			Debug.logError(`Unauthorized: session expired.`);
			callback(SESSION_EXPIRED);
			return;
		}
		if (msg.status_code !== 200) {
			Debug.logError(`HTTP error ${msg.status_code}: ${msg.reason_phrase}`);
			return;
		}
		try {
			// SvelteKit may stream extra chunks on following lines; the page data is on the first one
			let page = JSON.parse(msg.response_body.data.split('\n')[0]);
			if (page.type === 'redirect') {
				Debug.logError(`Redirected to ${page.location}: session expired.`);
				callback(SESSION_EXPIRED);
				return;
			}
			let attendance = extractAttendance(page);
			if (!attendance) {
				Debug.logError(`No attendance data found in page data`);
				return;
			}
			Debug.logSuccess(`Received ${attendance.history.presences.length} presences for ${attendance.calendar.id}`);
			callback(attendance);
		} catch (e) {
			Debug.logError(`Failed to parse page data: ${e.message}`);
		}
	});
}

function startPeriodicRefresh(url, cookie, intervalSeconds, onDataReceived, onSessionExpired) {
	function refresh() {
		try {
			get_page_data(url, cookie, (data) => {
				try {
					if (data === SESSION_EXPIRED) {
						if (onSessionExpired) onSessionExpired();
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
	unflatten,
	extractAttendance,
};
