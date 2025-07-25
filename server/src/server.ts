import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
import { setupSipTrunk, createDispatchRule } from './livekit-setup';
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

import { twiml as Twiml } from 'twilio';

import { twiml as Twiml } from 'twilio';

app.post('/api/twilio/webhook', (req, res) => {
  try {
    const { From, CallSid } = req.body;
    const roomId = `support-room`;

    const response = new Twiml.VoiceResponse();

    // Say something while we dial
    response.say({ voice: 'alice' }, 'Please wait while we connect your call.');
    response.pause({ length: 3 });

    if (config.LIVEKIT_SIP_TRUNK_NUMBER && config.LIVEKIT_SIP_DOMAIN) {
      const sipUri = `sip:${config.LIVEKIT_SIP_TRUNK_NUMBER}@${config.LIVEKIT_SIP_DOMAIN}?X-LK-CallerId=${encodeURIComponent(
        From || 'unknown'
      )}&X-LK-RoomName=${encodeURIComponent(roomId)}`;

      const dial = response.dial({ timeout: 50 });
      dial.sip(sipUri);
    } else {
      response.say('Sorry, SIP trunk is not configured.');
    }

    // Fallback
    response.say({ voice: 'alice' }, 'Sorry, we could not connect your call.');

    const xml = response.toString();
    res.type('text/xml').send(xml); // ✅ Always send TwiML (XML)
  } catch (err) {
    console.error('❌ Webhook error:', err);

    // Send valid fallback TwiML even on error
    const errorResponse = new Twiml.VoiceResponse();
    errorResponse.say('An error occurred. Please try again later.');
    res.status(200).type('text/xml').send(errorResponse.toString());
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
  console.log(`📞 Twilio webhook URL: http://localhost:${PORT}/api/twilio/webhook`);
  console.log(`🔗 LiveKit WebSocket: ${config.LIVEKIT_WS_URL}`);
  console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:8080'}`);
});

export default app;
