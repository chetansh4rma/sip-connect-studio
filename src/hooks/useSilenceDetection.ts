import { useRef, useCallback, useEffect } from 'react';
import { RemoteAudioTrack, LocalAudioTrack } from 'livekit-client';

interface SilenceDetectionOptions {
  silenceThreshold: number; // milliseconds
  audioLevelThreshold: number; // 0.0 - 1.0
  debounceDelay: number; // milliseconds to ignore brief gaps
  onSilenceDetected: () => void;
}

export function useSilenceDetection(options: SilenceDetectionOptions) {
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioActivityRef = useRef<number>(Date.now());
  const audioTracksRef = useRef<Set<RemoteAudioTrack | LocalAudioTrack>>(new Set());
  const audioLevelCheckRef = useRef<NodeJS.Timeout | null>(null);

  const resetSilenceTimer = useCallback(() => {
    const now = Date.now();
    lastAudioActivityRef.current = now;
    
    console.log('🔊 Audio activity detected - resetting silence timer', {
      timestamp: new Date(now).toISOString(),
      timeSinceLastActivity: 0
    });

    // Clear existing timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    // Set new silence detection timeout
    silenceTimeoutRef.current = setTimeout(() => {
      const silenceDuration = Date.now() - lastAudioActivityRef.current;
      console.log('🔇 Silence detected - ending call', {
        silenceDuration,
        threshold: options.silenceThreshold,
        timestamp: new Date().toISOString()
      });
      options.onSilenceDetected();
    }, options.silenceThreshold);

    console.log('⏱️ Silence timer started', {
      threshold: options.silenceThreshold,
      timestamp: new Date().toISOString()
    });
  }, [options]);

  const handleAudioLevel = useCallback((level: number, trackSid?: string) => {
    if (level > options.audioLevelThreshold) {
      // Use debouncing to avoid rapid timer resets
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        console.log('🎤 Audio level above threshold', {
          level: level.toFixed(3),
          threshold: options.audioLevelThreshold,
          trackSid,
          timestamp: new Date().toISOString()
        });
        resetSilenceTimer();
      }, options.debounceDelay);
    }
  }, [options.audioLevelThreshold, options.debounceDelay, resetSilenceTimer]);

  // Periodically check audio levels from all tracks
  const startAudioLevelChecking = useCallback(() => {
    if (audioLevelCheckRef.current) {
      clearInterval(audioLevelCheckRef.current);
    }

    audioLevelCheckRef.current = setInterval(() => {
      audioTracksRef.current.forEach(track => {
        // For LiveKit tracks, we can access the audio context for level detection
        // This is a fallback method that checks for audio data presence
        try {
          if ('getStats' in track) {
            // Use track stats to detect audio activity
            (track as any).getStats?.().then((stats: any) => {
              if (stats && stats.audioLevel !== undefined) {
                handleAudioLevel(stats.audioLevel, track.sid);
              }
            }).catch(() => {
              // Fallback: assume activity if track is not muted
              if (!track.isMuted) {
                handleAudioLevel(0.1, track.sid); // Assume moderate activity
              }
            });
          } else {
            // Simple fallback: if track is not muted, assume activity
            if (!track.isMuted) {
              // Check if there's actual media data flowing (basic check)
              const mediaStreamTrack = track.mediaStreamTrack;
              if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
                handleAudioLevel(0.08, track.sid); // Assume light activity
              }
            }
          }
        } catch (error) {
          console.log('Audio level check failed for track', track.sid, error);
        }
      });
    }, 1000); // Check every second
  }, [handleAudioLevel]);

  const addAudioTrack = useCallback((track: RemoteAudioTrack | LocalAudioTrack) => {
    if (audioTracksRef.current.has(track)) return;

    audioTracksRef.current.add(track);
    
    console.log('🎵 Adding audio track for monitoring', {
      trackSid: track.sid,
      kind: track.kind,
      source: track.source,
      timestamp: new Date().toISOString()
    });

    // Start monitoring immediately
    resetSilenceTimer();
  }, [resetSilenceTimer]);

  const removeAudioTrack = useCallback((track: RemoteAudioTrack | LocalAudioTrack) => {
    audioTracksRef.current.delete(track);
    
    console.log('🎵 Removed audio track from monitoring', {
      trackSid: track.sid,
      remainingTracks: audioTracksRef.current.size,
      timestamp: new Date().toISOString()
    });
  }, []);

  const startMonitoring = useCallback(() => {
    console.log('🚀 Starting silence detection monitoring', {
      silenceThreshold: options.silenceThreshold,
      audioLevelThreshold: options.audioLevelThreshold,
      debounceDelay: options.debounceDelay,
      timestamp: new Date().toISOString()
    });
    resetSilenceTimer();
    startAudioLevelChecking();
  }, [options, resetSilenceTimer, startAudioLevelChecking]);

  const stopMonitoring = useCallback(() => {
    console.log('🛑 Stopping silence detection monitoring', {
      timestamp: new Date().toISOString()
    });

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    if (audioLevelCheckRef.current) {
      clearInterval(audioLevelCheckRef.current);
      audioLevelCheckRef.current = null;
    }

    audioTracksRef.current.clear();
  }, []);

  // Manual activity detection method for external triggers
  const recordActivity = useCallback(() => {
    console.log('🎯 Manual activity recorded', {
      timestamp: new Date().toISOString()
    });
    resetSilenceTimer();
  }, [resetSilenceTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    addAudioTrack,
    removeAudioTrack,
    startMonitoring,
    stopMonitoring,
    resetSilenceTimer,
    recordActivity,
    getLastActivityTime: () => lastAudioActivityRef.current,
    getTrackedTracksCount: () => audioTracksRef.current.size
  };
}