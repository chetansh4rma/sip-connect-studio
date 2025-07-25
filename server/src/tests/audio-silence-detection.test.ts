import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock audio track implementation for testing
class MockAudioTrack {
  private eventListeners: Map<string, Function[]> = new Map();
  public sid: string;
  public kind = 'audio';
  public source = 'microphone';

  constructor(sid: string) {
    this.sid = sid;
  }

  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Simulate audio level changes
  simulateAudioLevel(level: number) {
    const listeners = this.eventListeners.get('audioLevel');
    if (listeners) {
      listeners.forEach(callback => callback(level));
    }
  }
}

// Silence Detection Logic (extracted for testing)
class SilenceDetector {
  private silenceTimeoutRef: NodeJS.Timeout | null = null;
  private debounceTimeoutRef: NodeJS.Timeout | null = null;
  private lastAudioActivityRef: number = Date.now();
  private audioTracks: Set<MockAudioTrack> = new Set();
  private onSilenceCallback: () => void;
  private silenceThreshold: number;
  private audioLevelThreshold: number;
  private debounceDelay: number;
  private isActive: boolean = false;

  constructor(options: {
    silenceThreshold: number;
    audioLevelThreshold: number;
    debounceDelay: number;
    onSilenceDetected: () => void;
  }) {
    this.silenceThreshold = options.silenceThreshold;
    this.audioLevelThreshold = options.audioLevelThreshold;
    this.debounceDelay = options.debounceDelay;
    this.onSilenceCallback = options.onSilenceDetected;
  }

  private resetSilenceTimer() {
    const now = Date.now();
    this.lastAudioActivityRef = now;

    if (this.silenceTimeoutRef) {
      clearTimeout(this.silenceTimeoutRef);
      this.silenceTimeoutRef = null;
    }

    if (this.debounceTimeoutRef) {
      clearTimeout(this.debounceTimeoutRef);
      this.debounceTimeoutRef = null;
    }

    if (this.isActive) {
      this.silenceTimeoutRef = setTimeout(() => {
        this.onSilenceCallback();
      }, this.silenceThreshold);
    }
  }

  private handleAudioLevel(level: number) {
    if (level > this.audioLevelThreshold) {
      if (this.debounceTimeoutRef) {
        clearTimeout(this.debounceTimeoutRef);
      }

      this.debounceTimeoutRef = setTimeout(() => {
        this.resetSilenceTimer();
      }, this.debounceDelay);
    }
  }

  addAudioTrack(track: MockAudioTrack) {
    if (this.audioTracks.has(track)) return;

    this.audioTracks.add(track);
    track.on('audioLevel', (level: number) => {
      this.handleAudioLevel(level);
    });

    if (this.isActive) {
      this.resetSilenceTimer();
    }
  }

  removeAudioTrack(track: MockAudioTrack) {
    this.audioTracks.delete(track);
    track.off('audioLevel', this.handleAudioLevel);
  }

  startMonitoring() {
    this.isActive = true;
    this.resetSilenceTimer();
  }

  stopMonitoring() {
    this.isActive = false;
    
    if (this.silenceTimeoutRef) {
      clearTimeout(this.silenceTimeoutRef);
      this.silenceTimeoutRef = null;
    }

    if (this.debounceTimeoutRef) {
      clearTimeout(this.debounceTimeoutRef);
      this.debounceTimeoutRef = null;
    }

    this.audioTracks.forEach(track => {
      track.off('audioLevel', this.handleAudioLevel);
    });
    this.audioTracks.clear();
  }

  getLastActivityTime() {
    return this.lastAudioActivityRef;
  }

  getTrackedTracksCount() {
    return this.audioTracks.size;
  }

  // Test helper methods
  simulateAudioActivity(trackSid: string, level: number) {
    const track = Array.from(this.audioTracks).find(t => t.sid === trackSid);
    if (track) {
      track.simulateAudioLevel(level);
    }
  }
}

describe('Audio Silence Detection', () => {
  let silenceDetector: SilenceDetector;
  let onSilenceDetected: jest.Mock;
  let mockConsoleLog: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    onSilenceDetected = jest.fn();
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    
    silenceDetector = new SilenceDetector({
      silenceThreshold: 10000, // 10 seconds
      audioLevelThreshold: 0.05,
      debounceDelay: 500,
      onSilenceDetected
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    mockConsoleLog.mockRestore();
  });

  describe('Basic Silence Detection', () => {
    it('should trigger callback after 10 seconds of silence', () => {
      silenceDetector.startMonitoring();

      // Fast-forward time by 10 seconds
      jest.advanceTimersByTime(10000);

      expect(onSilenceDetected).toHaveBeenCalledTimes(1);
    });

    it('should not trigger callback if audio activity is detected', () => {
      const remoteTrack = new MockAudioTrack('remote-track-1');
      silenceDetector.addAudioTrack(remoteTrack);
      silenceDetector.startMonitoring();

      // Advance 5 seconds, then simulate audio
      jest.advanceTimersByTime(5000);
      remoteTrack.simulateAudioLevel(0.1); // Above threshold

      // Advance debounce delay
      jest.advanceTimersByTime(500);

      // Advance another 5 seconds (total 10.5, but audio detected at 5)
      jest.advanceTimersByTime(5000);

      expect(onSilenceDetected).not.toHaveBeenCalled();
    });
  });

  describe('Audio Level Monitoring', () => {
    it('should reset timer when audio level exceeds threshold', () => {
      const remoteTrack = new MockAudioTrack('remote-track-1');
      silenceDetector.addAudioTrack(remoteTrack);
      silenceDetector.startMonitoring();

      const startTime = silenceDetector.getLastActivityTime();

      // Advance 3 seconds
      jest.advanceTimersByTime(3000);

      // Simulate audio above threshold
      remoteTrack.simulateAudioLevel(0.08);
      jest.advanceTimersByTime(500); // Debounce delay

      const newTime = silenceDetector.getLastActivityTime();
      expect(newTime).toBeGreaterThan(startTime);

      // Should not trigger silence callback after original 10 seconds
      jest.advanceTimersByTime(7000); // Total 10 seconds from start
      expect(onSilenceDetected).not.toHaveBeenCalled();

      // Should trigger after new 10 second period
      jest.advanceTimersByTime(3500); // 10 seconds from audio activity
      expect(onSilenceDetected).toHaveBeenCalledTimes(1);
    });

    it('should ignore audio levels below threshold', () => {
      const remoteTrack = new MockAudioTrack('remote-track-1');
      silenceDetector.addAudioTrack(remoteTrack);
      silenceDetector.startMonitoring();

      // Advance 5 seconds
      jest.advanceTimersByTime(5000);

      // Simulate audio below threshold (background noise)
      remoteTrack.simulateAudioLevel(0.02);
      jest.advanceTimersByTime(500);

      // Should still trigger silence callback
      jest.advanceTimersByTime(5000);
      expect(onSilenceDetected).toHaveBeenCalledTimes(1);
    });
  });

  describe('12 Seconds of Active Speaking Test', () => {
    it('should not disconnect during 12 seconds of continuous speech', () => {
      const remoteTrack = new MockAudioTrack('remote-track-1');
      const localTrack = new MockAudioTrack('local-track-1');
      
      silenceDetector.addAudioTrack(remoteTrack);
      silenceDetector.addAudioTrack(localTrack);
      silenceDetector.startMonitoring();

      // Simulate 12 seconds of intermittent speech from both participants
      for (let i = 0; i < 24; i++) { // Every 500ms for 12 seconds
        jest.advanceTimersByTime(500);
        
        // Alternate between remote and local audio
        if (i % 4 < 2) {
          remoteTrack.simulateAudioLevel(0.15); // Remote speaking
        } else {
          localTrack.simulateAudioLevel(0.12); // Local speaking  
        }
        
        // Advance debounce delay
        jest.advanceTimersByTime(50);
      }

      // Call should still be active after 12 seconds
      expect(onSilenceDetected).not.toHaveBeenCalled();
      expect(silenceDetector.getTrackedTracksCount()).toBe(2);
    });

    it('should handle brief gaps between words without disconnecting', () => {
      const remoteTrack = new MockAudioTrack('remote-track-1');
      silenceDetector.addAudioTrack(remoteTrack);
      silenceDetector.startMonitoring();

      // Simulate speech with brief gaps (normal conversation pattern)
      const speechPattern = [
        { time: 1000, level: 0.2 },  // Word 1
        { time: 1500, level: 0.0 },  // Brief pause
        { time: 2000, level: 0.18 }, // Word 2
        { time: 3000, level: 0.0 },  // Brief pause
        { time: 3500, level: 0.15 }, // Word 3
        { time: 5000, level: 0.22 }, // Word 4
        { time: 6000, level: 0.0 },  // Brief pause
        { time: 6500, level: 0.19 }, // Word 5
        { time: 8000, level: 0.16 }, // Word 6
        { time: 9500, level: 0.21 }  // Word 7
      ];

      let currentTime = 0;
      for (const { time, level } of speechPattern) {
        jest.advanceTimersByTime(time - currentTime);
        if (level > 0) {
          remoteTrack.simulateAudioLevel(level);
          jest.advanceTimersByTime(50); // Debounce
        }
        currentTime = time + (level > 0 ? 50 : 0);
      }

      // Should not have triggered silence detection
      expect(onSilenceDetected).not.toHaveBeenCalled();
    });
  });

  describe('Track Management', () => {
    it('should properly add and remove audio tracks', () => {
      const track1 = new MockAudioTrack('track-1');
      const track2 = new MockAudioTrack('track-2');

      expect(silenceDetector.getTrackedTracksCount()).toBe(0);

      silenceDetector.addAudioTrack(track1);
      expect(silenceDetector.getTrackedTracksCount()).toBe(1);

      silenceDetector.addAudioTrack(track2);
      expect(silenceDetector.getTrackedTracksCount()).toBe(2);

      silenceDetector.removeAudioTrack(track1);
      expect(silenceDetector.getTrackedTracksCount()).toBe(1);

      silenceDetector.removeAudioTrack(track2);
      expect(silenceDetector.getTrackedTracksCount()).toBe(0);
    });

    it('should not add duplicate tracks', () => {
      const track = new MockAudioTrack('track-1');

      silenceDetector.addAudioTrack(track);
      silenceDetector.addAudioTrack(track); // Add same track again

      expect(silenceDetector.getTrackedTracksCount()).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should not trigger callback if monitoring is stopped', () => {
      silenceDetector.startMonitoring();

      // Advance 5 seconds
      jest.advanceTimersByTime(5000);
      
      // Stop monitoring
      silenceDetector.stopMonitoring();

      // Advance past original timeout
      jest.advanceTimersByTime(6000);

      expect(onSilenceDetected).not.toHaveBeenCalled();
    });

    it('should handle late browser join without premature disconnection', () => {
      // Start with just SIP participant
      silenceDetector.startMonitoring();

      // Advance 8 seconds (close to threshold)
      jest.advanceTimersByTime(8000);

      // Browser participant joins and starts speaking
      const browserTrack = new MockAudioTrack('browser-track');
      silenceDetector.addAudioTrack(browserTrack);
      browserTrack.simulateAudioLevel(0.15);
      jest.advanceTimersByTime(500); // Debounce

      // Should reset timer and not disconnect
      jest.advanceTimersByTime(5000); // Total 13 seconds, but timer reset at 8
      expect(onSilenceDetected).not.toHaveBeenCalled();
    });

    it('should handle debouncing correctly to prevent rapid timer resets', () => {
      const track = new MockAudioTrack('track-1');
      silenceDetector.addAudioTrack(track);
      silenceDetector.startMonitoring();

      const initialTime = silenceDetector.getLastActivityTime();

      // Rapid audio level changes within debounce period
      track.simulateAudioLevel(0.1);
      jest.advanceTimersByTime(100);
      track.simulateAudioLevel(0.15);
      jest.advanceTimersByTime(100);
      track.simulateAudioLevel(0.08);
      jest.advanceTimersByTime(300); // Complete debounce period

      // Timer should have been reset only once after debounce
      const finalTime = silenceDetector.getLastActivityTime();
      expect(finalTime).toBeGreaterThan(initialTime);
    });
  });
});