import Foundation
import WebRTC
import ReplayKit
import BroadcastScreenCapture

// Constants
let kRTCScreenSharingExtension = "RTCScreenSharingExtension"

/**
 * PluginGetDisplayMedia class handles screen capture functionality for WebRTC.
 * This class follows the same structure and pattern as PluginGetUserMedia but 
 * specifically designed for screen sharing using iOS broadcast extensions.
 * 
 * Key features:
 * - Screen capture using BroadcastScreenCapturer
 * - Optional audio capture for screen sharing
 * - Proper integration with WebRTC MediaStream APIs
 * - System broadcast picker UI integration
 * - Notification handling for broadcast events
 */

class PluginGetDisplayMedia {
	private static var shared = PluginGetDisplayMedia?
	var rtcPeerConnectionFactory: RTCPeerConnectionFactory
	private var screenCapturer: BroadcastScreenCapturer?
	private var screenTrack: RTCVideoTrack?
	private var notificationCenter: CFNotificationCenter?
	
	// Store callback functions and stream for broadcast started event
	private var pendingCallback: ((_ data: NSDictionary) -> Void)?
	private var pendingErrback: ((_ error: String) -> Void)?
	private var pendingEventListenerForNewStream: ((_ pluginMediaStream: PluginMediaStream) -> Void)?
	private var pendingRtcMediaStream: RTCMediaStream?

	init(rtcPeerConnectionFactory: RTCPeerConnectionFactory) {
		NSLog("PluginGetDisplayMedia#init()")
		self.rtcPeerConnectionFactory = rtcPeerConnectionFactory
		
		// Initialize screen capture notification center
		self.notificationCenter = CFNotificationCenterGetDarwinNotifyCenter()
		
		// Listen for screen capture start and stop events from broadcast extension
		self.listenNotification("iOS_BroadcastStarted" as CFString, callback: { center, observer, name, object, info in
			DispatchQueue.main.async {
                PluginGetDisplayMedia.shared?.onBroadcastStarted()
            }
		})
		self.listenNotification("iOS_BroadcastStopped" as CFString, callback: { center, observer, name, object, info in
			// Handle broadcast stopped
			DispatchQueue.main.async {
                PluginGetDisplayMedia.shared?.onBroadcastStopped()
            }
		})

		PluginGetDisplayMedia.shared = self
	}

	deinit {
		NSLog("PluginGetDisplayMedia#deinit()")
		self.cleanupScreenCapture()
	}

	func call(
		_ constraints: NSDictionary,
		callback: (_ data: NSDictionary) -> Void,
		errback: (_ error: String) -> Void,
		eventListenerForNewStream: (_ pluginMediaStream: PluginMediaStream) -> Void
	) {

		NSLog("PluginGetDisplayMedia#call()")

		var rtcMediaStream: RTCMediaStream
		var pluginMediaStream: PluginMediaStream?
		var rtcVideoTrack: RTCVideoTrack?
		var rtcVideoSource: RTCVideoSource?

		// Create media stream
		rtcMediaStream = self.rtcPeerConnectionFactory.mediaStream(withStreamId: UUID().uuidString)

        NSLog("PluginGetDisplayMedia#call() | video requested (screen capture)")

        // Create video source for screen capture
        rtcVideoSource = self.rtcPeerConnectionFactory.videoSource()
        rtcVideoTrack = self.rtcPeerConnectionFactory.videoTrack(with: rtcVideoSource!, trackId: UUID().uuidString)

        // Initialize broadcast screen capturer
        let screenCapturer = BroadcastScreenCapturer.init(delegate: rtcVideoSource!)
        self.screenCapturer = screenCapturer
        self.screenTrack = rtcVideoTrack

        // Start screen capture
        screenCapturer.startCapture()

        // Set capabilities for screen capture
        rtcVideoTrack!.capabilities["deviceId"] = "screen"

        rtcMediaStream.addVideoTrack(rtcVideoTrack!)

		// Store pending data for when broadcast actually starts
		self.pendingCallback = callback
		self.pendingErrback = errback
		self.pendingEventListenerForNewStream = eventListenerForNewStream
		self.pendingRtcMediaStream = rtcMediaStream

		// Show system broadcast picker for actual screen capture
		self.showBroadcastPicker()
		
		// Note: The callback will be called from iOS_BroadcastStarted notification
	}

	func stopCapture() {
		NSLog("PluginGetDisplayMedia#stopCapture()")
		self.cleanupScreenCapture()
	}

	private func showBroadcastPicker() {
		DispatchQueue.main.async {
			guard let appExtension = Bundle.main.infoDictionary?[kRTCScreenSharingExtension] as? String else {
				NSLog("PluginGetDisplayMedia | No broadcast extension configured")
				return
			}
			
			let picker = RPSystemBroadcastPickerView()
			picker.preferredExtension = appExtension
			picker.showsMicrophoneButton = false
			
			let selector = NSSelectorFromString("buttonPressed:")
			if picker.responds(to: selector) {
				picker.perform(selector, with: nil)
			}
		}
	}

	private func cleanupScreenCapture() {
		if let screenCapturer = self.screenCapturer {
			screenCapturer.stopCapture()
			self.screenCapturer = nil
		}
		self.screenTrack = nil
		
		// Clear any pending callback data
		self.pendingCallback = nil
		self.pendingErrback = nil
		self.pendingEventListenerForNewStream = nil
		self.pendingRtcMediaStream = nil
	}

	private func listenNotification(_ name: CFString, callback: CFNotificationCallback!) {
		guard let notificationCenter = self.notificationCenter else { return }
		
		CFNotificationCenterAddObserver(
			notificationCenter,
			Unmanaged.passUnretained(self).toOpaque(),
			callback,
			name,
			nil,
			CFNotificationSuspensionBehavior.deliverImmediately
		)
	}
	
	private func onBroadcastStarted() {
		NSLog("PluginGetDisplayMedia | onBroadcastStarted()")
		
		// Create PluginMediaStream and complete the call
		guard let rtcMediaStream = self.pendingRtcMediaStream,
			  let callback = self.pendingCallback,
			  let eventListenerForNewStream = self.pendingEventListenerForNewStream else {
			NSLog("PluginGetDisplayMedia | Missing pending data for broadcast started")
			return
		}
		
		let pluginMediaStream = PluginMediaStream(rtcMediaStream: rtcMediaStream)
		pluginMediaStream.run()
		
		// Let the plugin store it in its dictionary
		eventListenerForNewStream(pluginMediaStream)
		
		// Send success callback with stream data
		callback([
			"stream": pluginMediaStream.getJSON()
		])
		
		// Clear pending data
		self.pendingCallback = nil
		self.pendingErrback = nil
		self.pendingEventListenerForNewStream = nil
		self.pendingRtcMediaStream = nil
	}
	
	private func onBroadcastStopped() {
		NSLog("PluginGetDisplayMedia | onBroadcastStopped()")
		
		// If we have pending callbacks, this means broadcast was stopped before it started
		if let errback = self.pendingErrback {
			errback("Screen capture was cancelled")
		}
		
		// Cleanup screen capture resources
		self.cleanupScreenCapture()
	}
}
