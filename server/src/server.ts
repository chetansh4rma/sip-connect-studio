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
app.post('/api/twilio/webhook', (req, res) => {
  try {
    const { From, To, CallSid } = req.body;

    // --- You are now in 100% control of the Room ID ---
    const cleanRoomId = extractRoomId(From); // e.g., "7626818255"

    console.log(`✅ ROOM CAPTURED: Call from ${From} is assigned to predictable room: ${cleanRoomId}`);
    
    const identity = From;
    const livekitTrunkNumber = config.LIVEKIT_SIP_TRUNK_NUMBER; 
    const sipDomain = config.LIVEKIT_SIP_DOMAIN;

    const sipUri = `sip:${livekitTrunkNumber}@${sipDomain}?X-LK-RoomName=${encodeURIComponent(cleanRoomId)}&X-LK-Identity=${encodeURIComponent(identity)}`;

    // ✅ THE FIX IS HERE: The ampersand '&' must be escaped as '&' for valid TwiML.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial timeout="25">
        <Sip>${sipUri.replace(/&/g, '&')}</Sip>
    </Dial>
</Response>`;

    res.status(200).type('text/xml').send(twiml);

  } catch (error) {
    console.error('❌ Webhook error:', error);
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
