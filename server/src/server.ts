import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
// We no longer import setupSipTrunk or createDispatchRule to prevent conflicts.
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


import { twiml as Twiml } from 'twilio';

// This is the helper function to create your clean room ID. It's perfect.
function extractRoomId(phone: string): string {
  let digits = phone.replace(/\D/g, ''); // Remove all non-digits
  if (digits.length > 10) {
    digits = digits.slice(-10); // Always return last 10 digits
  }
  return digits;
}

// This is the final, corrected webhook for the "Header" rule.
// Enhanced webhook with comprehensive logging
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
    const roomName = cleanRoomId; // or use `room_${cleanRoomId}` if needed
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
});

export default app;
