import React, { useState, useEffect, useRef } from 'react';
import { Room, ConnectionState, RemoteParticipant, RemoteTrack, Track, RoomEvent, LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSilenceDetection } from '@/hooks/useSilenceDetection';

interface CallInterfaceProps {
  roomName?: string;
  onCallEnd?: () => void;
}

type CallStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

// Extract clean room ID from phone number (same logic as server)
function extractRoomId(phone: string): string {
  let digits = phone.replace(/\D/g, ''); // Remove all non-digits
  if (digits.length > 10) {
    digits = digits.slice(-10); // Always return last 10 digits
  }
  return digits;
}

export function CallInterface({ roomName, onCallEnd }: CallInterfaceProps) {
  const [room] = useState(() => new Room());
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectedParticipants, setConnectedParticipants] = useState<string[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  
  const { toast } = useToast();
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const callStartTimeRef = useRef<number | null>(null);

  // Silence detection with audio level monitoring
  const silenceDetection = useSilenceDetection({
    silenceThreshold: 10000, // 10 seconds
    audioLevelThreshold: 0.05, // Adjust based on sensitivity needed
    debounceDelay: 500, // 500ms debounce to handle brief gaps
    onSilenceDetected: () => {
      toast({
        title: "Call ended due to silence",
        description: "No speech detected for 10 seconds",
        variant: "destructive"
      });
      handleEndCall();
    }
  });

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (callStatus === 'connected' && callStartTimeRef.current) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current!) / 1000));
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  // Silence detection management
  useEffect(() => {
    if (callStatus === 'connected') {
      silenceDetection.startMonitoring();
    } else {
      silenceDetection.stopMonitoring();
    }
    
    return () => {
      silenceDetection.stopMonitoring();
    };
  }, [callStatus, silenceDetection]);

  // Room event handlers
  useEffect(() => {
    const handleConnectionStateChanged = (state: ConnectionState) => {
      setConnectionState(state);
      
      switch (state) {
        case ConnectionState.Connecting:
          setCallStatus('connecting');
          break;
        case ConnectionState.Connected:
          setCallStatus('connected');
          callStartTimeRef.current = Date.now();
          toast({
            title: "Call connected",
            description: "You are now connected to the caller",
          });
          break;
        case ConnectionState.Disconnected:
          setCallStatus('disconnected');
          callStartTimeRef.current = null;
          setCallDuration(0);
          break;
        case ConnectionState.Reconnecting:
          toast({
            title: "Reconnecting...",
            description: "Attempting to restore connection",
            variant: "default"
          });
          break;
      }
    };

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      setConnectedParticipants(prev => [...prev, participant.identity]);
      
      console.log('📞 Participant connected to call', {
        identity: participant.identity,
        participantSid: participant.sid,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Caller joined",
        description: `${participant.identity} is now in the call`,
      });

      // Subscribe to audio tracks and monitor for silence detection
      participant.audioTrackPublications.forEach((publication) => {
        if (publication.track && audioElementRef.current) {
          publication.track.attach(audioElementRef.current);
          
          // Add to silence detection monitoring
          if (publication.track instanceof RemoteAudioTrack) {
            silenceDetection.addAudioTrack(publication.track);
          }
        }
      });
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      setConnectedParticipants(prev => prev.filter(id => id !== participant.identity));
      
      toast({
        title: "Caller left",
        description: `${participant.identity} left the call`,
        variant: "destructive"
      });
    };

    const handleTrackSubscribed = (track: RemoteTrack, publication: any, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio && audioElementRef.current) {
        track.attach(audioElementRef.current);
        
        console.log('🎵 Audio track subscribed', {
          trackSid: track.sid,
          participantIdentity: participant.identity,
          timestamp: new Date().toISOString()
        });
        
        // Add to silence detection monitoring
        if (track instanceof RemoteAudioTrack) {
          silenceDetection.addAudioTrack(track);
        }
      }
    };

    const handleTrackUnsubscribed = (track: RemoteTrack, publication: any, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        console.log('🎵 Audio track unsubscribed', {
          trackSid: track.sid,
          participantIdentity: participant.identity,
          timestamp: new Date().toISOString()
        });
        
        // Remove from silence detection monitoring
        if (track instanceof RemoteAudioTrack) {
          silenceDetection.removeAudioTrack(track);
        }
      }
    };

    // Attach event listeners
    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    };
  }, [room, toast]);

  const connectToRoom = async (targetRoomName: string) => {
    try {
      setCallStatus('connecting');
      
      // Apply same room ID extraction as server for consistency
      const cleanRoomId = extractRoomId(targetRoomName);
      console.log(`🌐 Browser joining room: "${targetRoomName}" -> Clean ID: "${cleanRoomId}"`);
      
      // Get token from server
      const response = await fetch('https://sip-connect-studio-3.onrender.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: cleanRoomId,
          identity: `browser-client-${Date.now()}`
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get access token');
      }

      const { token, wsUrl } = await response.json();
      
      // Connect to LiveKit room
      await room.connect(wsUrl, token);
      
      // Enable audio track and add to silence detection
      await room.localParticipant.setMicrophoneEnabled(true);
      
      // Add local audio track to monitoring after a short delay to ensure it's ready
      setTimeout(() => {
        const localAudioTrack = room.localParticipant.audioTrackPublications.values().next().value?.track;
        if (localAudioTrack instanceof LocalAudioTrack) {
          silenceDetection.addAudioTrack(localAudioTrack);
          console.log('🎤 Local audio track added to monitoring', {
            trackSid: localAudioTrack.sid,
            timestamp: new Date().toISOString()
          });
        }
      }, 1000);
      
    } catch (error) {
      console.error('Failed to connect to room:', error);
      setCallStatus('error');
      
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleEndCall = async () => {
    try {
      await room.disconnect();
      setCallStatus('idle');
      setConnectedParticipants([]);
      onCallEnd?.();
      
      toast({
        title: "Call ended",
        description: `Call duration: ${formatDuration(callDuration)}`,
      });
      
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const toggleMute = async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
      
      // Record activity when unmuting (user likely about to speak)
      if (isAudioMuted) {
        silenceDetection.recordActivity();
      }
      
      toast({
        title: isAudioMuted ? "Microphone unmuted" : "Microphone muted",
        description: isAudioMuted ? "You can now speak" : "Your microphone is muted",
      });
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    if (audioElementRef.current) {
      audioElementRef.current.muted = !isAudioEnabled;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'idle': return 'Ready to receive calls';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Call in progress';
      case 'disconnected': return 'Call ended';
      case 'error': return 'Connection error';
      default: return 'Unknown status';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card className="shadow-soft">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              callStatus === 'connected' && "bg-call-active animate-call-pulse",
              callStatus === 'connecting' && "bg-call-ringing animate-call-ring",
              callStatus === 'error' && "bg-call-ended animate-status-blink",
              callStatus === 'idle' && "bg-muted"
            )} />
            <CardTitle className="text-2xl font-semibold">
              PSTN Call Interface
            </CardTitle>
          </div>
          <Badge variant={getStatusColor() as any} className="text-sm">
            {getStatusText()}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Call Status Display */}
          <div className="text-center space-y-2">
            {callStatus === 'connected' && (
              <>
                <div className="text-3xl font-mono font-bold text-primary">
                  {formatDuration(callDuration)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {connectedParticipants.length} participant(s) connected
                </div>
              </>
            )}
            
            {roomName && (
              <div className="text-sm text-muted-foreground">
                Room: <code className="px-2 py-1 bg-muted rounded">{roomName}</code>
              </div>
            )}
          </div>

          {/* Room Connection */}
          {callStatus === 'idle' && (
            <div className="space-y-4">
              <div className="text-center text-muted-foreground">
                Enter a room name to join a call, or wait for an incoming call
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Room name (e.g., call-12345)"
                  className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      connectToRoom(e.currentTarget.value);
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const input = document.querySelector('input') as HTMLInputElement;
                    if (input?.value) connectToRoom(input.value);
                  }}
                  className="bg-gradient-call"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Join Call
                </Button>
              </div>
            </div>
          )}

          {/* Call Controls */}
          {callStatus === 'connected' && (
            <div className="flex justify-center gap-4">
              <Button
                variant={isAudioMuted ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleMute}
                className="shadow-soft"
              >
                {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>

              <Button
                variant={isAudioEnabled ? "secondary" : "destructive"}
                size="lg"
                onClick={toggleAudio}
                className="shadow-soft"
              >
                {isAudioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                onClick={handleEndCall}
                className="shadow-call"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Connecting State */}
          {callStatus === 'connecting' && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-warning">
                <div className="w-2 h-2 bg-call-ringing rounded-full animate-call-ring" />
                Establishing connection...
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden audio element for remote audio */}
      <audio
        ref={audioElementRef}
        autoPlay
        playsInline
        muted={!isAudioEnabled}
        className="hidden"
      />

      {/* Connection Info */}
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Connection State:</span>
              <div className="font-medium">{connectionState}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Audio Status:</span>
              <div className="font-medium">
                {isAudioMuted ? 'Muted' : 'Active'} / {isAudioEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
