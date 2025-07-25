export interface Config {
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_WS_URL: string;
  LIVEKIT_SIP_DOMAIN: string;
  LIVEKIT_SIP_TRUNK_NUMBER: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
}

export function validateEnv(): Config {
  const requiredEnvVars = [
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET', 
    'LIVEKIT_WS_URL',
    'LIVEKIT_SIP_DOMAIN',
    'LIVEKIT_SIP_TRUNK_NUMBER',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  return {
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY!,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET!,
    LIVEKIT_WS_URL: process.env.LIVEKIT_WS_URL!,
    LIVEKIT_SIP_DOMAIN: process.env.LIVEKIT_SIP_DOMAIN!,
    LIVEKIT_SIP_TRUNK_NUMBER: process.env.LIVEKIT_SIP_TRUNK_NUMBER!,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID!,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN!,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER!
  };
}