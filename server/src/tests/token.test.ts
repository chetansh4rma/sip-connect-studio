import { AccessToken } from 'livekit-server-sdk';

describe('LiveKit Token Generation', () => {
  const mockConfig = {
    LIVEKIT_API_KEY: 'test_api_key',
    LIVEKIT_API_SECRET: 'test_secret',
    LIVEKIT_WS_URL: 'wss://test.livekit.cloud',
    LIVEKIT_SIP_DOMAIN: 'sip.test.cloud',
    LIVEKIT_SIP_TRUNK_NUMBER: '12345',
    TWILIO_ACCOUNT_SID: 'test_sid',
    TWILIO_AUTH_TOKEN: 'test_token',
    TWILIO_PHONE_NUMBER: '+1234567890'
  };

  test('should generate valid token with correct permissions', () => {
    const token = new AccessToken(
      mockConfig.LIVEKIT_API_KEY,
      mockConfig.LIVEKIT_API_SECRET,
      {
        identity: 'test-user',
        ttl: '1h',
      }
    );

    token.addGrant({
      room: 'test-room',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = token.toJwt();
    
    expect(jwt).toBeDefined();
    expect(typeof jwt).toBe('string');
    expect(jwt.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  test('should generate different tokens for different identities', () => {
    const token1 = new AccessToken(
      mockConfig.LIVEKIT_API_KEY,
      mockConfig.LIVEKIT_API_SECRET,
      { identity: 'user1', ttl: '1h' }
    );

    const token2 = new AccessToken(
      mockConfig.LIVEKIT_API_KEY,
      mockConfig.LIVEKIT_API_SECRET,
      { identity: 'user2', ttl: '1h' }
    );

    token1.addGrant({ room: 'test-room', roomJoin: true });
    token2.addGrant({ room: 'test-room', roomJoin: true });

    const jwt1 = token1.toJwt();
    const jwt2 = token2.toJwt();

    expect(jwt1).not.toBe(jwt2);
  });

  test('should include required grants for audio communication', () => {
    const token = new AccessToken(
      mockConfig.LIVEKIT_API_KEY,
      mockConfig.LIVEKIT_API_SECRET,
      { identity: 'audio-user', ttl: '1h' }
    );

    const grants = {
      room: 'audio-room',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    };

    token.addGrant(grants);
    const jwt = token.toJwt();

    // Decode JWT payload to verify grants (simplified check)
    const payload = JSON.parse(
      Buffer.from(jwt.split('.')[1], 'base64').toString()
    );

    expect(payload.video).toBeDefined();
    expect(payload.video.room).toBe(grants.room);
    expect(payload.video.roomJoin).toBe(true);
    expect(payload.video.canPublish).toBe(true);
    expect(payload.video.canSubscribe).toBe(true);
  });
});