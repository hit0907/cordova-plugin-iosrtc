/**
 * Expose a function that must be called when the library is loaded.
 * And also a helper function.
 */
module.exports = videoElementsHandler;
module.exports.observeVideo = observeVideo;

// Export function to release stream assign into video
module.exports.releaseVideo = releaseMediaStreamRenderer;


/**
 * Dependencies.
 */
var
	debug = require('debug')('iosrtc:videoElementsHandler'),
	MediaStreamRenderer = require('./MediaStreamRenderer'),


/**
 * Local variables.
 */

	// RegExp for MediaStream blobId.
	MEDIASTREAM_ID_REGEXP = new RegExp(/^MediaStream_/),

	// RegExp for Blob URI.
	BLOB_URI_REGEX = new RegExp(/^blob:/),

	// Dictionary of MediaStreamRenderers (provided via module argument).
	// - key: MediaStreamRenderer id.
	// - value: MediaStreamRenderer.
	mediaStreamRenderers,

	// Dictionary of MediaStreams (provided via module argument).
	// - key: MediaStream blobId.
	// - value: MediaStream.
	mediaStreams;


function videoElementsHandler(_mediaStreams, _mediaStreamRenderers) {
	mediaStreams = _mediaStreams;
	mediaStreamRenderers = _mediaStreamRenderers;
}


function observeVideo(video) {
	debug('observeVideo()');

	// If the video already has a src/srcObject property but is not yet handled by the plugin
	// then handle it now.
	if ((video.src || video.srcObject) && !video._iosrtcMediaStreamRendererId) {
		handleVideo(video);
	}


	// Intercept video 'error' events if it's due to the attached MediaStream.
	video.addEventListener('error', function (event) {
		if (video.error.code === global.MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && BLOB_URI_REGEX.test(video.src)) {
			debug('stopping "error" event propagation for video element');

			event.stopImmediatePropagation();
		}
	});
}


/**
 * Private API.
 */

function handleVideo(video) {
	var
		xhr = new XMLHttpRequest(),
		stream;

	// The app has set video.src.
	if (video.src) {
		xhr.open('GET', video.src, true);
		xhr.responseType = 'blob';
		xhr.onload = function () {
			if (xhr.status !== 200) {
				// If this video element was previously handling a MediaStreamRenderer, release it.
				releaseMediaStreamRenderer(video);

				return;
			}

			var reader = new FileReader();

			// Some versions of Safari fail to set onloadend property, some others do not react
			// on 'loadend' event. Try everything here.
			try {
				reader.onloadend = onloadend;
			} catch (error) {
				reader.addEventListener('loadend', onloadend);
			}
			reader.readAsText(xhr.response);

			function onloadend() {
				var mediaStreamBlobId = reader.result;

				// The retrieved URL does not point to a MediaStream.
				if (!mediaStreamBlobId || typeof mediaStreamBlobId !== 'string' || !MEDIASTREAM_ID_REGEXP.test(mediaStreamBlobId)) {
					// If this video element was previously handling a MediaStreamRenderer, release it.
					releaseMediaStreamRenderer(video);

					return;
				}

				provideMediaStreamRenderer(video, mediaStreamBlobId);
			}
		};
		xhr.send();
	}

	// The app has set video.srcObject.
	else if (video.srcObject) {
		stream = video.srcObject;

		if (!stream.getBlobId()) {
			// If this video element was previously handling a MediaStreamRenderer, release it.
			releaseMediaStreamRenderer(video);

			return;
		}

		provideMediaStreamRenderer(video, stream.getBlobId());
	}
}


function provideMediaStreamRenderer(video, mediaStreamBlobId) {
	var
		mediaStream = mediaStreams[mediaStreamBlobId],
		mediaStreamRenderer = mediaStreamRenderers[video._iosrtcMediaStreamRendererId];

	if (!mediaStream) {
		releaseMediaStreamRenderer(video);

		return;
	}

	if (mediaStreamRenderer) {
		mediaStreamRenderer.render(mediaStream);
	} else {
		mediaStreamRenderer = new MediaStreamRenderer(video);
		mediaStreamRenderer.render(mediaStream);

		mediaStreamRenderers[mediaStreamRenderer.id] = mediaStreamRenderer;
		video._iosrtcMediaStreamRendererId = mediaStreamRenderer.id;
	}

	// Close the MediaStreamRenderer of this video if it emits "close" event.
	mediaStreamRenderer.addEventListener('close', function () {
		if (mediaStreamRenderers[video._iosrtcMediaStreamRendererId] !== mediaStreamRenderer) {
			return;
		}

		releaseMediaStreamRenderer(video);
	});

	// Override some <video> properties.
	// NOTE: This is a terrible hack but it works.
	Object.defineProperties(video, {
		videoWidth: {
			configurable: true,
			get: function () {
				return mediaStreamRenderer.videoWidth || 0;
			}
		},
		videoHeight: {
			configurable: true,
			get: function () {
				return mediaStreamRenderer.videoHeight || 0;
			}
		},
		readyState: {
			configurable: true,
			get: function () {
				if (mediaStreamRenderer && mediaStreamRenderer.stream && mediaStreamRenderer.stream.connected) {
					return video.HAVE_ENOUGH_DATA;
				} else {
					return video.HAVE_NOTHING;
				}
			}
		}
	});
}


function releaseMediaStreamRenderer(video) {
	if (!video._iosrtcMediaStreamRendererId) {
		return;
	}

	var mediaStreamRenderer = mediaStreamRenderers[video._iosrtcMediaStreamRendererId];
	if (mediaStreamRenderer) {
		delete mediaStreamRenderers[video._iosrtcMediaStreamRendererId];
		mediaStreamRenderer.close();
	}

	delete video._iosrtcMediaStreamRendererId;

	// Remove overrided <video> properties.
	delete video.videoWidth;
	delete video.videoHeight;
	delete video.readyState;
}
