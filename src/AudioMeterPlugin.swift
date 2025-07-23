import Foundation
import WebRTC
import AVFoundation

@objc(AudioMeterPlugin)
class AudioMeterPlugin: CDVPlugin {
    
    // Dictionary to hold active audio data sinks by track ID
    private var audioSinks: [String: AudioDataSink] = [:]
    
    /**
     * Start volume metering for a remote audio track
     * Expected parameters: [trackId]
     */
    @objc(startMetering:)
    func startMetering(_ command: CDVInvokedUrlCommand) {
        NSLog("AudioMeterPlugin#startMetering()")
        
        guard let trackId = command.argument(at: 0) as? String else {
            let result = CDVPluginResult(status: CDVCommandStatus_ERROR, 
                                       messageAs: "Missing trackId parameter")
            self.commandDelegate.send(result, callbackId: command.callbackId)
            return
        }
        
        // Get the main iosrtc plugin instance to access media tracks
        guard let iosrtcPlugin = self.commandDelegate.getCommandInstance("iosrtcPlugin") as? iosrtcPlugin else {
            let result = CDVPluginResult(status: CDVCommandStatus_ERROR, 
                                       messageAs: "iosrtcPlugin not found")
            self.commandDelegate.send(result, callbackId: command.callbackId)
            return
        }
        
        // Find the audio track
        guard let pluginMediaStreamTrack = iosrtcPlugin.pluginMediaStreamTracks[trackId],
              let rtcAudioTrack = pluginMediaStreamTrack.rtcMediaStreamTrack as? RTCAudioTrack else {
            let result = CDVPluginResult(status: CDVCommandStatus_ERROR, 
                                       messageAs: "Audio track with ID '\(trackId)' not found")
            self.commandDelegate.send(result, callbackId: command.callbackId)
            return
        }
        
        // Stop any existing metering for this track
        stopMetering(for: trackId)
        
        // Create and configure the audio data sink
        let audioSink = AudioDataSink(commandDelegate: self.commandDelegate, 
                                    callbackId: command.callbackId, 
                                    trackId: trackId)
        
        // Add the sink to the audio track
        rtcAudioTrack.add(audioSink)
        
        // Store the sink for cleanup
        audioSinks[trackId] = audioSink
        
        NSLog("AudioMeterPlugin#startMetering() | Started metering for track: %@", trackId)
        
        // Send initial success response
        let result = CDVPluginResult(status: CDVCommandStatus_OK, 
                                   messageAs: "Metering started for track: \(trackId)")
        result?.setKeepCallbackAs(true)
        self.commandDelegate.send(result, callbackId: command.callbackId)
    }
    
    /**
     * Stop volume metering for a specific track
     * Expected parameters: [trackId]
     */
    @objc(stopMetering:)
    func stopMetering(_ command: CDVInvokedUrlCommand) {
        NSLog("AudioMeterPlugin#stopMetering()")
        
        guard let trackId = command.argument(at: 0) as? String else {
            let result = CDVPluginResult(status: CDVCommandStatus_ERROR, 
                                       messageAs: "Missing trackId parameter")
            self.commandDelegate.send(result, callbackId: command.callbackId)
            return
        }
        
        stopMetering(for: trackId)
        
        let result = CDVPluginResult(status: CDVCommandStatus_OK, 
                                   messageAs: "Metering stopped for track: \(trackId)")
        self.commandDelegate.send(result, callbackId: command.callbackId)
    }
    
    /**
     * Stop all active volume metering
     */
    @objc(stopAllMetering:)
    func stopAllMetering(_ command: CDVInvokedUrlCommand) {
        NSLog("AudioMeterPlugin#stopAllMetering()")
        
        for trackId in audioSinks.keys {
            stopMetering(for: trackId)
        }
        
        let result = CDVPluginResult(status: CDVCommandStatus_OK, 
                                   messageAs: "All metering stopped")
        self.commandDelegate.send(result, callbackId: command.callbackId)
    }
    
    // MARK: - Private Methods
    
    private func stopMetering(for trackId: String) {
        guard let audioSink = audioSinks[trackId] else {
            return
        }
        
        // Get the audio track and remove the sink
        if let iosrtcPlugin = self.commandDelegate.getCommandInstance("iosrtcPlugin") as? iosrtcPlugin,
           let pluginMediaStreamTrack = iosrtcPlugin.pluginMediaStreamTracks[trackId],
           let rtcAudioTrack = pluginMediaStreamTrack.rtcMediaStreamTrack as? RTCAudioTrack {
            rtcAudioTrack.remove(audioSink)
        }
        
        // Remove from our dictionary
        audioSinks.removeValue(forKey: trackId)
        
        NSLog("AudioMeterPlugin#stopMetering() | Stopped metering for track: %@", trackId)
    }
}

// MARK: - AudioDataSink Class

private class AudioDataSink: NSObject, RTCAudioRenderer {
    
    private let commandDelegate: CDVCommandDelegate
    private let callbackId: String
    private let trackId: String
    
    // Audio processing properties
    private var lastVolumeLevel: Int = 0
    private var volumeUpdateThrottle: DispatchTime = DispatchTime.now()
    private let throttleInterval: TimeInterval = 0.1 // Update every 100ms
    
    init(commandDelegate: CDVCommandDelegate, callbackId: String, trackId: String) {
        self.commandDelegate = commandDelegate
        self.callbackId = callbackId
        self.trackId = trackId
        super.init()
    }
    
    // MARK: - RTCAudioRenderer Protocol
    
    func renderFrame(_ frame: RTCAudioBuffer) {
        // Throttle updates to avoid overwhelming the JavaScript side
        let now = DispatchTime.now()
        guard now >= volumeUpdateThrottle else {
            return
        }
        volumeUpdateThrottle = now + DispatchTimeInterval.milliseconds(Int(throttleInterval * 1000))
        
        // Calculate volume level from audio frame
        let volumeLevel = calculateVolume(from: frame)
        
        // Only send updates if the volume level changed significantly
        if abs(volumeLevel - lastVolumeLevel) >= 2 {
            lastVolumeLevel = volumeLevel
            sendVolumeUpdate(volumeLevel)
        }
    }
    
    // MARK: - Private Methods
    
    private func calculateVolume(from audioBuffer: RTCAudioBuffer) -> Int {
        let frames = audioBuffer.frames
        let channels = audioBuffer.channels
        
        guard frames > 0, channels > 0 else { return 1 }
        
        var sum: Float = 0.0
        let frameCount = Int(frames)
        
        // For simplicity, we'll work with channel 0 data
        // In a real implementation, you might want to average across all channels
        let channelData = audioBuffer.rawData(for: 0)
        
        // Assuming 16-bit PCM data (most common)
        let samples = channelData.bindMemory(to: Int16.self, capacity: frameCount)
        
        for i in 0..<frameCount {
            let sample = Float(samples[i]) / 32768.0 // Normalize to -1.0 to 1.0
            sum += sample * sample
        }
        
        // Calculate RMS
        let rmsValue = sqrt(sum / Float(frameCount))
        
        // Convert RMS to decibels (dBFS)
        let dBFS: Float
        if rmsValue > 0.0 {
            dBFS = 20.0 * log10(rmsValue)
        } else {
            dBFS = -100.0 // Very quiet
        }
        
        // Map dBFS to 1-100 scale
        // Typical range: -50dB (quiet) to 0dB (maximum)
        let clampedDB = max(-50.0, min(0.0, dBFS))
        let normalizedLevel = (clampedDB + 50.0) / 50.0 // 0.0 to 1.0
        let volumeLevel = Int(normalizedLevel * 99.0) + 1 // 1 to 100
        
        return max(1, min(100, volumeLevel))
    }
    
    private func sendVolumeUpdate(_ volumeLevel: Int) {
        DispatchQueue.main.async {
            let result = CDVPluginResult(status: CDVCommandStatus_OK, 
                                       messageAs: [
                                        "trackId": self.trackId,
                                        "volumeLevel": volumeLevel,
                                        "timestamp": Date().timeIntervalSince1970
                                       ])
            result?.setKeepCallbackAs(true)
            self.commandDelegate.send(result, callbackId: self.callbackId)
        }
    }
}
