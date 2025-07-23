/**
 * Complete Audio Meter Example Application
 * Demonstrates how to use the AudioMeter plugin with iosrtc
 */

var app = {
	// Application state
	localStream: null,
	remoteStream: null,
	peerConnection: null,
	audioMeters: {},

	// Initialize the application
	initialize: function () {
		document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
	},

	// Device is ready
	onDeviceReady: function () {
		console.log('Device ready');

		// Initialize iosrtc
		if (window.cordova && window.cordova.plugins && window.cordova.plugins.iosrtc) {
			// Register globals for WebRTC
			window.cordova.plugins.iosrtc.registerGlobals();

			// Initialize UI
			this.initializeUI();

			console.log('iosrtc initialized');
		} else {
			console.error('iosrtc plugin not found');
		}
	},

	// Initialize UI event handlers
	initializeUI: function () {
		// WebRTC demo buttons
		var startCallBtn = document.getElementById('startCall');
		var endCallBtn = document.getElementById('endCall');

		// Audio meter buttons
		var startMeterBtn = document.getElementById('startMeter');
		var stopMeterBtn = document.getElementById('stopMeter');

		if (startCallBtn) {
			startCallBtn.onclick = this.startCall.bind(this);
		}

		if (endCallBtn) {
			endCallBtn.onclick = this.endCall.bind(this);
		}

		if (startMeterBtn) {
			startMeterBtn.onclick = this.startAudioMetering.bind(this);
		}

		if (stopMeterBtn) {
			stopMeterBtn.onclick = this.stopAudioMetering.bind(this);
		}
	},

	// Start a WebRTC call (simplified example)
	startCall: function () {
		console.log('Starting call...');

		// Create peer connection
		this.peerConnection = new RTCPeerConnection({
			iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
		});

		// Handle remote stream
		this.peerConnection.ontrack = function (event) {
			console.log('Remote track received:', event.track);

			if (event.track.kind === 'audio') {
				console.log('Remote audio track ID:', event.track.id);
				this.handleRemoteAudioTrack(event.track);
			}
		}.bind(this);

		// Get user media
		navigator.mediaDevices
			.getUserMedia({
				audio: true,
				video: false
			})
			.then(
				function (stream) {
					console.log('Local stream obtained');
					this.localStream = stream;

					// Add local stream to peer connection
					stream.getTracks().forEach(
						function (track) {
							this.peerConnection.addTrack(track, stream);
						}.bind(this)
					);

					this.updateStatus(
						'Local stream ready. In a real app, you would now exchange offers/answers.'
					);

					// Enable audio meter button
					document.getElementById('startMeter').disabled = false;
				}.bind(this)
			)
			.catch(
				function (error) {
					console.error('Error getting user media:', error);
					this.updateStatus('Error getting user media: ' + error.message);
				}.bind(this)
			);
	},

	// Handle remote audio track
	handleRemoteAudioTrack: function (track) {
		console.log('Handling remote audio track:', track.id);

		// Store track ID for audio metering
		var trackIdInput = document.getElementById('trackIdInput');
		if (trackIdInput) {
			trackIdInput.value = track.id;
		}

		this.updateStatus('Remote audio track received: ' + track.id);

		// Automatically start audio metering if enabled
		var autoStartCheckbox = document.getElementById('autoStartMeter');
		if (autoStartCheckbox && autoStartCheckbox.checked) {
			setTimeout(
				function () {
					this.startAudioMetering();
				}.bind(this),
				1000
			);
		}
	},

	// Start audio metering
	startAudioMetering: function () {
		var trackIdInput = document.getElementById('trackIdInput');
		if (!trackIdInput || !trackIdInput.value) {
			this.updateStatus('Please enter a track ID first');
			return;
		}

		var trackId = trackIdInput.value.trim();

		if (!window.AudioMeter) {
			this.updateStatus('AudioMeter plugin not available');
			return;
		}

		console.log('Starting audio metering for track:', trackId);

		AudioMeter.startMetering(
			trackId,
			this.onVolumeUpdate.bind(this),
			this.onAudioMeterError.bind(this)
		);

		// Store active meter
		this.audioMeters[trackId] = true;

		// Update UI
		document.getElementById('startMeter').disabled = true;
		document.getElementById('stopMeter').disabled = false;
		document.getElementById('meterContainer').style.display = 'block';

		this.updateStatus('Audio metering started for: ' + trackId);
	},

	// Stop audio metering
	stopAudioMetering: function () {
		var trackIdInput = document.getElementById('trackIdInput');
		if (!trackIdInput || !trackIdInput.value) {
			return;
		}

		var trackId = trackIdInput.value.trim();

		AudioMeter.stopMetering(
			trackId,
			function (result) {
				console.log('Audio metering stopped:', result);
				this.updateStatus('Audio metering stopped');

				// Remove from active meters
				delete this.audioMeters[trackId];

				// Update UI
				document.getElementById('startMeter').disabled = false;
				document.getElementById('stopMeter').disabled = true;
				document.getElementById('meterContainer').style.display = 'none';
			}.bind(this),
			this.onAudioMeterError.bind(this)
		);
	},

	// Handle volume updates
	onVolumeUpdate: function (data) {
		console.log('Volume update:', data);

		// Update volume bar
		var volumeBar = document.getElementById('volumeBar');
		var volumeValue = document.getElementById('volumeValue');
		var trackIdSpan = document.getElementById('currentTrackId');

		if (volumeBar && volumeValue && trackIdSpan) {
			trackIdSpan.textContent = data.trackId;
			volumeValue.textContent = data.volumeLevel;
			volumeBar.style.width = Math.max(1, data.volumeLevel) + '%';
		}

		// Optional: trigger events based on volume level
		this.handleVolumeLevel(data.volumeLevel);
	},

	// Handle volume level thresholds
	handleVolumeLevel: function (level) {
		// Example: Change background color based on volume
		var container = document.getElementById('meterContainer');
		if (!container) return;

		if (level > 80) {
			container.style.borderColor = '#dc3545'; // Red for loud
		} else if (level > 50) {
			container.style.borderColor = '#ffc107'; // Yellow for medium
		} else if (level > 20) {
			container.style.borderColor = '#28a745'; // Green for normal
		} else {
			container.style.borderColor = '#e9ecef'; // Gray for quiet
		}
	},

	// Handle audio meter errors
	onAudioMeterError: function (error) {
		console.error('Audio meter error:', error);
		this.updateStatus('Audio meter error: ' + error);

		// Reset UI state
		document.getElementById('startMeter').disabled = false;
		document.getElementById('stopMeter').disabled = true;
	},

	// End the call
	endCall: function () {
		console.log('Ending call...');

		// Stop all audio metering
		if (window.AudioMeter) {
			AudioMeter.stopAllMetering();
		}
		this.audioMeters = {};

		// Close peer connection
		if (this.peerConnection) {
			this.peerConnection.close();
			this.peerConnection = null;
		}

		// Stop local stream
		if (this.localStream) {
			this.localStream.getTracks().forEach(function (track) {
				track.stop();
			});
			this.localStream = null;
		}

		// Reset UI
		document.getElementById('startMeter').disabled = true;
		document.getElementById('stopMeter').disabled = true;
		document.getElementById('meterContainer').style.display = 'none';
		document.getElementById('trackIdInput').value = '';

		this.updateStatus('Call ended');
	},

	// Update status display
	updateStatus: function (message) {
		console.log('Status:', message);

		var statusDiv = document.getElementById('statusDiv');
		if (statusDiv) {
			var timestamp = new Date().toLocaleTimeString();
			statusDiv.innerHTML = `<div class="status info">[${timestamp}] ${message}</div>`;
		}
	}
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
	app.initialize();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = app;
}
