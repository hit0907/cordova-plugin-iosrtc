/**
 * Audio Meter Plugin for Cordova iOS
 * Provides real-time volume metering for remote RTCAudioTracks
 */

var AudioMeter = {
	/**
	 * Start volume metering for a remote audio track
	 * @param {string} trackId - The ID of the remote audio track
	 * @param {function} successCallback - Called with volume level updates (1-100)
	 * @param {function} errorCallback - Called if an error occurs
	 */
	startMetering: function (trackId, successCallback, errorCallback) {
		if (!trackId) {
			errorCallback && errorCallback('Track ID is required');
			return;
		}

		cordova.exec(
			function (result) {
				if (typeof result === 'object' && result.volumeLevel !== undefined) {
					// This is a volume level update
					successCallback && successCallback(result);
				} else {
					// This is the initial success response
					console.log('AudioMeter: ' + result);
				}
			},
			errorCallback ||
				function (error) {
					console.error('AudioMeter Error:', error);
				},
			'AudioMeterPlugin',
			'startMetering',
			[trackId]
		);
	},

	/**
	 * Stop volume metering for a specific track
	 * @param {string} trackId - The ID of the audio track
	 * @param {function} successCallback - Called when metering is stopped
	 * @param {function} errorCallback - Called if an error occurs
	 */
	stopMetering: function (trackId, successCallback, errorCallback) {
		if (!trackId) {
			errorCallback && errorCallback('Track ID is required');
			return;
		}

		cordova.exec(
			successCallback ||
				function (result) {
					console.log('AudioMeter: ' + result);
				},
			errorCallback ||
				function (error) {
					console.error('AudioMeter Error:', error);
				},
			'AudioMeterPlugin',
			'stopMetering',
			[trackId]
		);
	},

	/**
	 * Stop all active volume metering
	 * @param {function} successCallback - Called when all metering is stopped
	 * @param {function} errorCallback - Called if an error occurs
	 */
	stopAllMetering: function (successCallback, errorCallback) {
		cordova.exec(
			successCallback ||
				function (result) {
					console.log('AudioMeter: ' + result);
				},
			errorCallback ||
				function (error) {
					console.error('AudioMeter Error:', error);
				},
			'AudioMeterPlugin',
			'stopAllMetering',
			[]
		);
	}
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = AudioMeter;
}

// Make available globally
window.AudioMeter = AudioMeter;
