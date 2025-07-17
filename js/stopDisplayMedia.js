/**
 * Expose the stopDisplayMedia function.
 */
module.exports = stopDisplayMedia;

/**
 * Dependencies.
 */
var debug = require('debug')('iosrtc:stopDisplayMedia'),
	debugerror = require('debug')('iosrtc:ERROR:stopDisplayMedia'),
	exec = require('cordova/exec'),
	Errors = require('./Errors');

function stopDisplayMedia() {
	debug('stopDisplayMedia()');

	return new Promise(function (resolve, reject) {
		function onResultOK(data) {
			debug('stopDisplayMedia() | success');
			resolve();
		}

		function onResultError(error) {
			debugerror('stopDisplayMedia() | error:', error);
			reject(new Errors.MediaStreamError('stopDisplayMedia() failed: ' + error));
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'stopDisplayMedia', []);
	});
}
