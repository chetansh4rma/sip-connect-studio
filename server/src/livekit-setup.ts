import { SipTrunkInfo, SipDispatchRuleInfo, CreateSipTrunkRequest, CreateSipDispatchRuleRequest, SipClient } from 'livekit-server-sdk';
import type { Config } from './config';

// Dummy function for password generation (assuming you have one, or use a real one)
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Sets up the LiveKit SIP trunk for receiving calls from Twilio
 */
export async function setupSipTrunk(config: Config): Promise<SipTrunkInfo> {
  // Instantiate Livekit SipClient to interact with Livekit Cloud API
  const client = new SipClient(config.LIVEKIT_WS_URL, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);

  try {
    const request: CreateSipTrunkRequest = {
      // It's good practice to use a static ID or derive it uniquely,
      // but 'twilio-pstn-trunk' is fine for a single trunk demo.
      sipTrunkId: 'twilio-pstn-trunk',
      name: 'Twilio PSTN Trunk',
      metadata: 'Trunk for receiving PSTN calls via Twilio',
      // Allow incoming calls from Twilio's IP ranges (CRITICAL for self-hosted, good to specify for cloud)
      inboundAddresses: [
        '54.172.60.0/30',      // Twilio US East
        '54.244.51.0/30',      // Twilio US West
        '177.71.206.192/30',   // Twilio South America
        '54.171.127.192/30'    // Additional Twilio range
        // Add more Twilio IP ranges if needed based on your Twilio number's region
      ],
      // Use username/password auth for Twilio (Livekit Cloud side)
      inboundUsername: config.LIVEKIT_SIP_TRUNK_NUMBER, // Often the E.164 number
      inboundPassword: generateSecurePassword(),
      transport: 'udp' // Or 'tls' if you set that up with Twilio
    };

    console.log('Attempting to create/update SIP trunk with configuration:', {
      sipTrunkId: request.sipTrunkId,
      name: request.name,
      addressCount: request.inboundAddresses?.length,
      username: request.inboundUsername
    });

    // Call the LiveKit API to create or update the SIP Trunk
    const trunkInfo = await client.updateSipInboundTrunk(request);

    console.log(`✓ SIP trunk '${trunkInfo.name}' created/updated successfully`);
    console.log(`  - Trunk ID: ${trunkInfo.sipTrunkId}`);
    console.log(`  - Username: ${trunkInfo.inboundUsername}`);
    console.log(`  - Allowed addresses: ${trunkInfo.inboundAddresses?.length || 0} ranges`);

    return trunkInfo;

  } catch (error) {
    console.error('Failed to setup SIP trunk:', error);
    throw new Error(`SIP trunk setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates a dispatch rule to route incoming SIP calls to rooms
 */
export async function createDispatchRule(config: Config): Promise<SipDispatchRuleInfo> {
  const client = new SipClient(config.LIVEKIT_WS_URL, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);

  try {
    const request: CreateSipDispatchRuleRequest = {
      // You can give it a new name to avoid confusion
      name: 'PSTN Auto-Room Rule',
      
      // Link this rule to the trunk you created earlier
      trunkIds: ['twilio-pstn-trunk'], 
      
      // --- THIS IS THE MAGIC PART ---
      // Instead of using header-based routing, we create an "Individual" rule.
      rule: {
        dispatchRuleIndividual: {
          // This prefix will be added to the beginning of the room name.
          // For a call to +18563918711, the room will be named: "pstn_room_18563918711"
          // Make sure your web app joins this exact room name!
          roomPrefix: 'pstn_room_', 
        }
      },

      // Configure the room to close if the caller is alone for 20 seconds.
      roomConfig: {
        emptyTimeout: 20
      }
    };

    console.log('Attempting to create/update a SIMPLE SIP dispatch rule:', {
      name: request.name,
      trunkIds: request.trunkIds,
      ruleType: 'Individual',
      roomPrefix: request.rule?.dispatchRuleIndividual?.roomPrefix
    });

    // Use the same update function to create or update the rule
    const dispatchInfo = await client.updateSipDispatchRule(request);

    console.log(`✓ SIP dispatch rule '${dispatchInfo.name}' created/updated successfully`);
    console.log(`  - Rule will now automatically create rooms for calls on trunk 'twilio-pstn-trunk'.`);

    return dispatchInfo;

  } catch (error) {
    console.error('Failed to create dispatch rule:', error);
    throw new Error(`Dispatch rule creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
