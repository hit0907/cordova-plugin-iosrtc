# AudioMeter Plugin for Cordova iOS

A real-time audio volume meter plugin for Cordova iOS applications using the native GoogleWebRTC library. This plugin provides optimal performance by calculating volume levels on the native side and only sending integer values (1-100) to JavaScript.

## Features

-   **Real-time volume metering** for remote RTCAudioTracks
-   **High-performance native calculation** using Swift and WebRTC
-   **Throttled updates** to prevent overwhelming the JavaScript bridge
-   **Easy-to-use JavaScript API** with promise-like callbacks
-   **Automatic cleanup** when tracks are removed or app terminates
-   **Visual UI components** for displaying volume levels

## Installation

1. Add the plugin files to your Cordova project's `plugins/cordova-plugin-iosrtc` directory
2. The plugin is automatically registered when you build the project
3. Make sure you have the iosrtc plugin properly installed

## Usage

### Basic Usage

```javascript
// Start metering for a remote audio track
AudioMeter.startMetering(
	'remote-audio-track-id',
	function (result) {
		// Volume level update received
		console.log('Volume level:', result.volumeLevel); // 1-100
		console.log('Track ID:', result.trackId);
		console.log('Timestamp:', result.timestamp);

		// Update your UI
		updateVolumeBar(result.volumeLevel);
	},
	function (error) {
		console.error('Error starting audio meter:', error);
	}
);

// Stop metering for a specific track
AudioMeter.stopMetering(
	'remote-audio-track-id',
	function (result) {
		console.log('Metering stopped:', result);
	},
	function (error) {
		console.error('Error stopping audio meter:', error);
	}
);

// Stop all active metering
AudioMeter.stopAllMetering(
	function (result) {
		console.log('All metering stopped:', result);
	},
	function (error) {
		console.error('Error stopping all meters:', error);
	}
);
```

### Complete WebRTC Example

```javascript
// WebRTC setup with volume metering
var peerConnection = new RTCPeerConnection({
	iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Handle remote tracks
peerConnection.ontrack = function (event) {
	if (event.track.kind === 'audio') {
		console.log('Remote audio track received:', event.track.id);

		// Start volume metering for the remote audio track
		AudioMeter.startMetering(
			event.track.id,
			function (volumeData) {
				updateVolumeUI(volumeData.volumeLevel);
			},
			function (error) {
				console.error('Volume meter error:', error);
			}
		);
	}
};

function updateVolumeUI(level) {
	// Update a visual volume bar (1-100 scale)
	var volumeBar = document.getElementById('volume-bar');
	volumeBar.style.width = level + '%';

	// Change color based on volume level
	if (level > 80) {
		volumeBar.style.backgroundColor = '#dc3545'; // Red
	} else if (level > 50) {
		volumeBar.style.backgroundColor = '#ffc107'; // Yellow
	} else {
		volumeBar.style.backgroundColor = '#28a745'; // Green
	}
}
```

### HTML Volume Meter Component

```html
<div class="audio-meter-container">
	<div class="meter-header">
		<span class="track-info">Remote Audio</span>
		<span class="volume-value" id="volume-value">0</span>
	</div>
	<div class="volume-bar-container">
		<div id="volume-bar" class="volume-bar"></div>
	</div>
</div>

<style>
	.audio-meter-container {
		padding: 15px;
		background: #f8f9fa;
		border-radius: 8px;
		border: 2px solid #e9ecef;
	}

	.meter-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	.volume-bar-container {
		height: 20px;
		background: #e9ecef;
		border-radius: 10px;
		overflow: hidden;
	}

	.volume-bar {
		height: 100%;
		background: linear-gradient(90deg, #28a745 0%, #ffc107 70%, #dc3545 90%);
		transition: width 0.1s ease-out;
		width: 1%;
	}
</style>
```

## API Reference

### AudioMeter.startMetering(trackId, successCallback, errorCallback)

Starts volume metering for a remote audio track.

**Parameters:**

-   `trackId` (string): The ID of the remote RTCAudioTrack
-   `successCallback` (function): Called with volume level updates
-   `errorCallback` (function): Called if an error occurs

**Success Callback Data:**

```javascript
{
    trackId: "remote-audio-track-id",
    volumeLevel: 75,  // Integer from 1-100
    timestamp: 1234567890.123
}
```

### AudioMeter.stopMetering(trackId, successCallback, errorCallback)

Stops volume metering for a specific track.

**Parameters:**

-   `trackId` (string): The ID of the audio track to stop metering
-   `successCallback` (function): Called when metering is stopped
-   `errorCallback` (function): Called if an error occurs

### AudioMeter.stopAllMetering(successCallback, errorCallback)

Stops all active volume metering.

**Parameters:**

-   `successCallback` (function): Called when all metering is stopped
-   `errorCallback` (function): Called if an error occurs

## Technical Details

### Volume Calculation

The plugin calculates volume using the following algorithm:

1. **Audio Data Extraction**: Raw audio samples are extracted from the RTCAudioBuffer
2. **RMS Calculation**: Root Mean Square (RMS) is calculated across all channels and frames
3. **Decibel Conversion**: RMS values are converted to decibels (dBFS) using `20 * log10(rms)`
4. **Linear Mapping**: dBFS values are mapped from a typical range (-50dB to 0dB) to a linear scale (1-100)

### Performance Optimizations

-   **Native Processing**: All audio processing is done in Swift for optimal performance
-   **Throttled Updates**: Volume updates are limited to every 100ms to reduce JavaScript bridge overhead
-   **Change Detection**: Only significant volume changes (±2 levels) trigger updates
-   **Memory Management**: Automatic cleanup of audio sinks when tracks are removed

### Thread Safety

-   Audio processing occurs on WebRTC's audio thread
-   UI updates are dispatched to the main queue
-   All plugin state is managed thread-safely

## Files Structure

```
src/
├── AudioMeterPlugin.swift          # Main plugin implementation
js/
├── AudioMeter.js                   # JavaScript API wrapper
examples/
├── example-audiometer.html         # Complete HTML example
├── example-app.js                  # Advanced JavaScript example
```

## Requirements

-   iOS 11.0+
-   Cordova iOS 4.5.1+
-   cordova-plugin-iosrtc 8.0.0+
-   WebRTC GoogleWebRTC pod

## Error Handling

Common errors and solutions:

-   **"Track ID is required"**: Ensure you provide a valid track ID
-   **"Audio track not found"**: The track ID doesn't exist in the current session
-   **"iosrtcPlugin not found"**: The iosrtc plugin is not properly installed
-   **"AudioMeter plugin not available"**: The plugin is not properly registered

## License

MIT License - see the main cordova-plugin-iosrtc license for details.

## Contributing

1. Follow the existing code style (tabs for indentation in JavaScript)
2. Test on physical iOS devices
3. Update documentation for any API changes
4. Ensure proper memory management in Swift code

## Support

For issues related to this AudioMeter plugin, please check:

1. Ensure the iosrtc plugin is working correctly
2. Verify you have remote audio tracks available
3. Test on a physical device (simulators may not support audio properly)
4. Check the browser console for error messages
