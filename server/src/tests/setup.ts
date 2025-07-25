// Jest setup file for global test configuration

// Mock environment variables for tests
process.env.LIVEKIT_API_KEY = 'test_api_key';
process.env.LIVEKIT_API_SECRET = 'test_secret';
process.env.LIVEKIT_WS_URL = 'wss://test.livekit.cloud';
process.env.LIVEKIT_SIP_DOMAIN = 'sip.test.cloud';
process.env.LIVEKIT_SIP_TRUNK_NUMBER = '12345';
process.env.TWILIO_ACCOUNT_SID = 'test_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_token';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';
process.env.PORT = '3001';
process.env.CLIENT_URL = 'http://localhost:8080';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup fetch mock for HTTP requests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
);