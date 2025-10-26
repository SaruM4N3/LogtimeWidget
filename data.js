/* data.js
utils for data
*/

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Soup = imports.gi.Soup;
const { Debug } = Me.imports.debug;
const { Calculation } = Me.imports.calculation;

const user = GLib.get_user_name();
const LIVE_JSON_ADRESS = `https://translate.intra.42.fr/users/${user}/locations_stats.json`;

function get_scraped_data(session_cookie, callback) {
    let session = new Soup.Session();
    let message = Soup.Message.new('GET', LIVE_JSON_ADRESS);
    message.request_headers.append('Cookie', `_intra_42_session_production=${session_cookie}`);

    session.queue_message(message, function (sess, msg) {
        if (msg.status_code === 200) {
            try {
                let data = JSON.parse(msg.response_body.data);
                Debug.logSuccess("[Scrape] Got live data:\n" + JSON.stringify(data, null, 2));
                callback(data);
            } catch (e) {
                Debug.logError("[Scrape] Parse error: " + e.message);
            }
        } else {
            Debug.logError(`[Scrape] HTTP error ${msg.status_code}: ${msg.reason_phrase}`);
            callback(null);
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

function scrapedPeriodicRefresh(label,session_cookie, intervalSeconds, getBonusDays, getGiftDays, onDataReceived) {
    function refresh() {
        try {
            get_scraped_data(session_cookie, (data) => {
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
                    let result = Calculation.calculateMonthlyTotal(data, bonusDays, giftDays);

                    // Update text
                    label.set_text(result.text);

                    let current_time = GLib.DateTime.new_now_local();
                    Debug.logInfo(`[${current_time.format("%T")}] Refreshed: ${result.text} (${result.isOnTrack ? 'ON TRACK' : 'BEHIND'})`);
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
    get_scraped_data,
    get_api_data,
    startPeriodicRefresh,
    scrapedPeriodicRefresh,
};
