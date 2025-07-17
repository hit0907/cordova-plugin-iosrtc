/**
 * Expose the getDisplayMedia function.
 */
module.exports = getDisplayMedia;

/**
 * Dependencies.
 */
var debug = require('debug')('iosrtc:getDisplayMedia'),
	debugerror = require('debug')('iosrtc:ERROR:getDisplayMedia'),
	exec = require('cordova/exec'),
	MediaStream = require('./MediaStream'),
	Errors = require('./Errors');

function getDisplayMedia(constraints) {
	// Detect callback usage to assist migration
	Errors.detectDeprecatedCallbaksUsage('cordova.plugins.iosrtc.getDisplayMedia', arguments);

	debug('[original constraints:%o]', constraints);

	var newConstraints = {};

	if (typeof constraints !== 'object') {
		constraints = {};
	}

	// Set default video constraints for screen capture
	if (!constraints.video) {
		constraints.video = true;
	}

	// Audio is typically not supported for screen capture
	if (constraints.audio) {
		debug('Audio constraints will be ignored for screen capture');
	}

	// Set video constraints
	if (constraints.video === true) {
		newConstraints.video = {
			mandatory: {},
			optional: []
		};
	} else if (typeof constraints.video === 'object') {
		newConstraints.video = {
			mandatory: {},
			optional: []
		};

		// Process video constraints
		if (constraints.video.width) {
			if (typeof constraints.video.width === 'number') {
				newConstraints.video.mandatory.minWidth = constraints.video.width;
				newConstraints.video.mandatory.maxWidth = constraints.video.width;
			} else if (typeof constraints.video.width === 'object') {
				if (
					constraints.video.width.min &&
					typeof constraints.video.width.min === 'number'
				) {
					newConstraints.video.mandatory.minWidth = constraints.video.width.min;
				}
				if (
					constraints.video.width.max &&
					typeof constraints.video.width.max === 'number'
				) {
					newConstraints.video.mandatory.maxWidth = constraints.video.width.max;
				}
			}
		}

		if (constraints.video.height) {
			if (typeof constraints.video.height === 'number') {
				newConstraints.video.mandatory.minHeight = constraints.video.height;
				newConstraints.video.mandatory.maxHeight = constraints.video.height;
			} else if (typeof constraints.video.height === 'object') {
				if (
					constraints.video.height.min &&
					typeof constraints.video.height.min === 'number'
				) {
					newConstraints.video.mandatory.minHeight = constraints.video.height.min;
				}
				if (
					constraints.video.height.max &&
					typeof constraints.video.height.max === 'number'
				) {
					newConstraints.video.mandatory.maxHeight = constraints.video.height.max;
				}
			}
		}

		if (constraints.video.frameRate) {
			if (typeof constraints.video.frameRate === 'number') {
				newConstraints.video.mandatory.minFrameRate = constraints.video.frameRate;
				newConstraints.video.mandatory.maxFrameRate = constraints.video.frameRate;
			} else if (typeof constraints.video.frameRate === 'object') {
				if (
					constraints.video.frameRate.min &&
					typeof constraints.video.frameRate.min === 'number'
				) {
					newConstraints.video.mandatory.minFrameRate = constraints.video.frameRate.min;
				}
				if (
					constraints.video.frameRate.max &&
					typeof constraints.video.frameRate.max === 'number'
				) {
					newConstraints.video.mandatory.maxFrameRate = constraints.video.frameRate.max;
				}
			}
		}
	}

	debug('[new constraints:%o]', newConstraints);

	return new Promise(function (resolve, reject) {
		function onResultOK(data) {
			debug('getDisplayMedia() | success');
			var stream = MediaStream.create(data.stream);
			resolve(stream);
		}

		function onResultError(error) {
			debugerror('getDisplayMedia() | error:', error);
			reject(new Errors.MediaStreamError('getDisplayMedia() failed: ' + error));
		}

		exec(onResultOK, onResultError, 'iosrtcPlugin', 'getDisplayMedia', [newConstraints]);
	});
}
