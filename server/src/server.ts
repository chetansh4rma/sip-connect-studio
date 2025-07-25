import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
import { setupSipTrunk, createDispatchRule } from './livekit-setup';
import { validateEnv } from './config';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:8080',
  credentials: true
}));
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

// SIP configuration endpoint
app.post('/api/sip/setup', async (req, res) => {
  try {
    console.log('Setting up SIP trunk and dispatch rules...');
    
    const trunkInfo = await setupSipTrunk(config);
    const dispatchInfo = await createDispatchRule(config);
    
    res.json({
      success: true,
      sipTrunk: trunkInfo,
      dispatchRule: dispatchInfo,
      message: 'SIP configuration completed successfully'
    });

  } catch (error) {
    console.error('Error setting up SIP:', error);
    res.status(500).json({ 
      error: 'Failed to setup SIP configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// TwiML webhook for incoming calls
app.post('/api/twilio/webhook', (req, res) => {
  const { From, To, CallSid } = req.body;
  
  // Create room ID based on timestamp for better uniqueness
  const timestamp = Date.now();
  const roomId = `call-${timestamp}`;
  
  console.log(`📞 Incoming call from ${From} → assigned to room: ${roomId}`, {
    from: From,
    to: To,
    callSid: CallSid,
    roomId,
    timestamp: new Date().toISOString()
  });
  
  // Generate TwiML response to forward call to LiveKit SIP trunk
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip>sip:${config.LIVEKIT_SIP_TRUNK_NUMBER}@${config.LIVEKIT_SIP_DOMAIN}?X-LK-CallerId=${encodeURIComponent(From)}&X-LK-RoomName=${encodeURIComponent(roomId)}</Sip>
    </Dial>
</Response>`;

  res.set('Content-Type', 'text/xml');
  res.send(twiml);
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
  console.log(`📞 Twilio webhook URL: http://localhost:${PORT}/api/twilio/webhook`);
  console.log(`🔗 LiveKit WebSocket: ${config.LIVEKIT_WS_URL}`);
  console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:8080'}`);
});

export default app;