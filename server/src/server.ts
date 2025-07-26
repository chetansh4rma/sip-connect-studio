import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { twiml as Twiml } from 'twilio';
import { validateEnv } from './config';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Validate environment variables on startup
const config = validateEnv();

// Create room service client for monitoring
const roomClient = new RoomServiceClient(
  config.LIVEKIT_WS_URL,
  config.LIVEKIT_API_KEY,
  config.LIVEKIT_API_SECRET
);

// Helper function to create clean room ID
function extractRoomId(phone: string): string {
  let digits = phone.replace(/\D/g, ''); // Remove all non-digits
  if (digits.length > 10) {
    digits = digits.slice(-10); // Always return last 10 digits
  }
  return digits;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0' 
  });
});

// LiveKit token generation endpoint
app.post('/api/token', async (req, res) => {
  try {
    const { roomName, identity } = req.body;

    if (!roomName || !identity) {
      return res.status(400).json({ 
        error: 'Missing required fields: roomName and identity' 
      });
    }

    const token = new AccessToken(
      config.LIVEKIT_API_KEY,
      config.LIVEKIT_API_SECRET,
      {
        identity,
        ttl: '1h',
      }
    );

    // Grant permissions for audio communication
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = token.toJwt();

    console.log(`Generated token for ${identity} in room ${roomName}`);
    
    res.json({
      token: jwt,
      wsUrl: config.LIVEKIT_WS_URL,
      roomName,
      identity
    });

  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enhanced Twilio webhook with comprehensive logging
app.post('/api/twilio/webhook', (req, res) => {
  try {
    const { From, To, CallSid, CallStatus, Direction } = req.body;

    // Log all incoming call details
    console.log('🔥 === INCOMING CALL DETAILS ===');
    console.log(`📞 Call SID: ${CallSid}`);
    console.log(`📱 From: ${From}`);
    console.log(`📱 To: ${To}`);
    console.log(`📊 Status: ${CallStatus}`);
    console.log(`🔄 Direction: ${Direction}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    // Your existing room ID extraction
    const cleanRoomId = extractRoomId(From);
    
    console.log('🏠 === ROOM ASSIGNMENT ===');
    console.log(`✅ Original Phone: ${From}`);
    console.log(`🎯 Clean Room ID: ${cleanRoomId}`);
    console.log(`🔗 Room Format: room_${cleanRoomId}`);
    
    const identity = From;
    const livekitTrunkNumber = config.LIVEKIT_SIP_TRUNK_NUMBER; 
    const sipDomain = config.LIVEKIT_SIP_DOMAIN;

    // Enhanced SIP URI construction with logging
    const roomName = cleanRoomId; // Using clean room ID without prefix
    const sipUri = `sip:${livekitTrunkNumber}@${sipDomain}?X-LK-RoomName=${encodeURIComponent(roomName)}&X-LK-Identity=${encodeURIComponent(identity)}`;

    console.log('🌐 === SIP ROUTING ===');
    console.log(`📡 LiveKit Trunk: ${livekitTrunkNumber}`);
    console.log(`🌍 SIP Domain: ${sipDomain}`);
    console.log(`🏷️ Room Name Header: ${roomName}`);
    console.log(`👤 Identity Header: ${identity}`);
    console.log(`🔗 Full SIP URI: ${sipUri}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial timeout="25">
        <Sip>${sipUri.replace(/&/g, '&amp;')}</Sip>
    </Dial>
</Response>`;

    console.log('📋 === TWIML RESPONSE ===');
    console.log(`📝 TwiML Generated: ${twiml.replace(/\n\s*/g, ' ')}`);
    console.log('🚀 === DISPATCHING TO LIVEKIT ===');

    res.status(200).type('text/xml').send(twiml);

    // Log successful response
    console.log(`✅ Call ${CallSid} successfully routed to LiveKit room: ${roomName}`);
    console.log('🔥 === END CALL PROCESSING ===\n');

  } catch (error) {
    console.error('❌ === WEBHOOK ERROR ===');
    console.error(`💥 Error Details:`, error);
    console.error(`🆔 Call SID: ${req.body?.CallSid || 'Unknown'}`);
    console.error(`📱 From: ${req.body?.From || 'Unknown'}`);
    console.error(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.error('❌ === END ERROR ===\n');

    const errorResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An application error occurred.</Say></Response>`;
    res.status(500).type('text/xml').send(errorResponse);
  }
});

// Room monitoring endpoint
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await roomClient.listRooms();
    
    console.log('🏠 === ACTIVE ROOMS ===');
    rooms.forEach((room, index) => {
      console.log(`${index + 1}. Room: ${room.name}`);
      console.log(`   - SID: ${room.sid}`);
      console.log(`   - Participants: ${room.numParticipants}`);
      console.log(`   - Created: ${new Date(room.creationTime * 1000).toISOString()}`);
      console.log(`   - Duration: ${Math.floor((Date.now() - room.creationTime * 1000) / 1000)}s`);
    });
    console.log('🏠 === END ROOMS ===\n');

    res.json({
      totalRooms: rooms.length,
      rooms: rooms.map(room => ({
        name: room.name,
        sid: room.sid,
        participants: room.numParticipants,
        createdAt: new Date(room.creationTime * 1000).toISOString()
      }))
    });

  } catch (error) {
    console.error('❌ Failed to fetch rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Room participants endpoint
app.get('/api/rooms/:roomName/participants', async (req, res) => {
  try {
    const { roomName } = req.params;
    const participants = await roomClient.listParticipants(roomName);
    
    console.log(`👥 === PARTICIPANTS IN ROOM: ${roomName} ===`);
    participants.forEach((participant, index) => {
      console.log(`${index + 1}. ${participant.name || participant.identity}`);
      console.log(`   - Identity: ${participant.identity}`);
      console.log(`   - State: ${participant.state}`);
      console.log(`   - Joined: ${new Date(participant.joinedAt * 1000).toISOString()}`);
      console.log(`   - Audio: ${participant.tracks.find(t => t.type === 'audio') ? '✅' : '❌'}`);
      console.log(`   - Video: ${participant.tracks.find(t => t.type === 'video') ? '✅' : '❌'}`);
    });
    console.log('👥 === END PARTICIPANTS ===\n');

    res.json({
      roomName,
      participantCount: participants.length,
      participants: participants.map(p => ({
        identity: p.identity,
        name: p.name,
        state: p.state,
        joinedAt: new Date(p.joinedAt * 1000).toISOString()
      }))
    });

  } catch (error) {
    console.error(`❌ Failed to fetch participants for room ${req.params.roomName}:`, error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// LiveKit webhook endpoint for real-time events
app.post('/api/livekit/webhook', express.raw({ type: 'application/webhook+json' }), (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());
    
    console.log('🔔 === LIVEKIT EVENT ===');
    console.log(`📅 Event: ${event.event}`);
    console.log(`🏠 Room: ${event.room?.name || 'N/A'}`);
    console.log(`👤 Participant: ${event.participant?.identity || 'N/A'}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    
    // Log specific events
    if (event.event === 'room_started') {
      console.log(`🎉 Room "${event.room.name}" was created!`);
    } else if (event.event === 'participant_joined') {
      console.log(`👋 Participant "${event.participant.identity}" joined room "${event.room.name}"`);
    }
    
    console.log('🔔 === END EVENT ===\n');

    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ LiveKit webhook error:', error);
    res.status(400).send('Bad Request');
  }
});

// Call status tracking
app.post('/api/call/status', (req, res) => {
  const { callSid, status, duration, reason } = req.body;
  
  console.log(`Call ${callSid} status: ${status}`, {
    duration: duration || 'N/A',
    reason: reason || 'N/A',
    timestamp: new Date().toISOString()
  });
  
  res.json({ success: true, message: 'Status logged' });
});

// Debug endpoint to test room creation
app.post('/api/debug/test-room', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const cleanRoomId = extractRoomId(phoneNumber);
    
    console.log('🧪 === ROOM CREATION TEST ===');
    console.log(`📱 Input Phone: ${phoneNumber}`);
    console.log(`🎯 Clean Room ID: ${cleanRoomId}`);
    console.log(`🏠 Expected Room: ${cleanRoomId}`);
    
    // Create a token for this room to test if it works
    const token = new AccessToken(
      config.LIVEKIT_API_KEY,
      config.LIVEKIT_API_SECRET,
      {
        identity: `test-${cleanRoomId}`,
        ttl: '10m',
      }
    );

    token.addGrant({
      room: cleanRoomId, // Using clean room ID without prefix
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = token.toJwt();
    
    console.log(`✅ Token generated for room: ${cleanRoomId}`);
    console.log('🧪 === END TEST ===\n');

    res.json({
      success: true,
      roomId: cleanRoomId,
      token: jwt,
      wsUrl: config.LIVEKIT_WS_URL
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({ error: 'Test failed' });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PSTN-LiveKit Server running on port ${PORT}`);
  console.log(`📞 Twilio webhook URL: http://YourRenderURL.onrender.com/api/twilio/webhook`);
  console.log(`🔗 LiveKit WebSocket: ${config.LIVEKIT_WS_URL}`);
  console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:8080'}`);
  console.log(`🔍 Debug endpoints:`);
  console.log(`   - GET /api/rooms - List active rooms`);
  console.log(`   - POST /api/debug/test-room - Test room creation`);
});

export default app;
