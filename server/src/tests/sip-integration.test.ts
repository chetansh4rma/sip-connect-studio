import request from 'supertest';
import express from 'express';

// Mock the server setup for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mock token endpoint
  app.post('/api/token', (req, res) => {
    const { roomName, identity } = req.body;
    
    if (!roomName || !identity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    res.json({
      token: 'mock_jwt_token',
      wsUrl: 'wss://test.livekit.cloud',
      roomName,
      identity
    });
  });

  // Mock Twilio webhook endpoint
  app.post('/api/twilio/webhook', (req, res) => {
    const { From, To, CallSid } = req.body;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip>sip:12345@sip.test.cloud?X-LK-CallerId=${encodeURIComponent(From)}&X-LK-RoomName=${encodeURIComponent(CallSid)}</Sip>
    </Dial>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  });

  return app;
};

describe('SIP Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  test('should generate token for valid room join request', async () => {
    const response = await request(app)
      .post('/api/token')
      .send({
        roomName: 'test-room',
        identity: 'test-user'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('wsUrl');
    expect(response.body.roomName).toBe('test-room');
    expect(response.body.identity).toBe('test-user');
  });

  test('should reject token request with missing fields', async () => {
    const response = await request(app)
      .post('/api/token')
      .send({
        roomName: 'test-room'
        // missing identity
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('should generate proper TwiML for incoming call webhook', async () => {
    const response = await request(app)
      .post('/api/twilio/webhook')
      .send({
        From: '+1234567890',
        To: '+0987654321',
        CallSid: 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      });

    expect(response.status).toBe(200);
    expect(response.get('Content-Type')).toContain('text/xml');
    
    const twiml = response.text;
    expect(twiml).toContain('<Response>');
    expect(twiml).toContain('<Dial>');
    expect(twiml).toContain('<Sip>');
    expect(twiml).toContain('sip:12345@sip.test.cloud');
    expect(twiml).toContain('X-LK-CallerId=%2B1234567890');
    expect(twiml).toContain('X-LK-RoomName=CAxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  });

  test('should handle TwiML generation with special characters in caller ID', async () => {
    const response = await request(app)
      .post('/api/twilio/webhook')
      .send({
        From: '+1 (555) 123-4567',
        To: '+0987654321',
        CallSid: 'CAtest123'
      });

    expect(response.status).toBe(200);
    const twiml = response.text;
    
    // Check that special characters are properly URL encoded
    expect(twiml).toContain('X-LK-CallerId=' + encodeURIComponent('+1 (555) 123-4567'));
    expect(twiml).toContain('X-LK-RoomName=CAtest123');
  });

  test('should include proper XML declaration and structure', async () => {
    const response = await request(app)
      .post('/api/twilio/webhook')
      .send({
        From: '+1234567890',
        To: '+0987654321', 
        CallSid: 'CAtest'
      });

    const twiml = response.text;
    expect(twiml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(twiml).toContain('</Response>');
    expect(twiml).toContain('</Dial>');
    expect(twiml).toContain('</Sip>');
  });
});