/* connect.js
    connection functions to get access
 */

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const { Debug } = Me.imports.utils.debug;

function get_access_token(client_id, client_secret, callback) {
    let session = new Soup.Session();
    let message = Soup.Message.new(
        'POST',
        'https://api.intra.42.fr/oauth/token'
    );

    let body = `grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`;

    message.set_request_body_from_bytes('application/x-www-form-urlencoded',
        new GLib.Bytes(body));
    message.request_headers.append('Content-Type', 'application/x-www-form-urlencoded');

    session.queue_message(message, (sess, msg) => {
        if (msg.status_code === 200) {
            try {
                let response = JSON.parse(msg.response_body.data);
                let accessToken = response.access_token;
                Debug.logInfo(`New access token: ${accessToken}`);
                callback(accessToken);
            } catch (e) {
                Debug.logError(`Token parse failed: ${e.message}`);
                callback(null);
            }
        } else {
            Debug.logError(`HTTP ${msg.status_code}: ${msg.reason_phrase}`);
            callback(null);
        }
    });
}

var Connect = {
    get_access_token
};