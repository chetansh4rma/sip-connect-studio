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
  // Instantiate Livekit SipClient to interact with Livekit Cloud API
  const client = new SipClient(config.LIVEKIT_WS_URL, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);

  try {
    // We are casting to 'any' here for CreateSipDispatchRuleRequest.
    // This is a workaround because your local SDK's type definitions might not
    // explicitly include 'dispatchKey' or 'inboundSipTrunking' at the top level
    // of CreateSipDispatchRuleRequest, even though the Livekit API accepts them.
    const request: any = { // <-- Cast to 'any' here
      sipDispatchRuleId: 'pstn-to-room-rule', // Unique ID for this rule
      name: 'PSTN Call Router',
      metadata: 'Routes incoming PSTN calls to LiveKit rooms dynamically',

      // --- CRITICAL CONFIGURATION FOR SIP DISPATCH RULE ---

      // The 'dispatchKey' is the specific SIP 'user' part Livekit will look for
      // in the incoming SIP URI (e.g., sip:+18563918711@your.domain.livekit.cloud).
      // It MUST match your config.LIVEKIT_SIP_TRUNK_NUMBER.
      dispatchKey: config.LIVEKIT_SIP_TRUNK_NUMBER, // e.g., "8563918711" or "+18563918711"

      // This flag tells Livekit that this rule is for INBOUND SIP calls through a trunk.
      inboundSipTrunking: true,

      // Link this dispatch rule to the specific SIP Trunk you created.
      // Make sure 'twilio-pstn-trunk' matches the sipTrunkId used in setupSipTrunk.
      trunkIds: ['twilio-pstn-trunk'],

      // The 'target' object defines how Livekit should map incoming SIP call details
      // to a Livekit room and participant based on SIP headers.
      target: {
        // Get the Livekit room name from the 'X-LK-RoomName' SIP header that Twilio sends.
        roomName: {
          fromHeader: 'X-LK-RoomName'
        },
        // Get the Livekit participant identity from the 'X-LK-CallerId' SIP header.
        participantIdentity: {
          fromHeader: 'X-LK-CallerId'
        },
        // Automatically publish the SIP participant's audio to the Livekit room.
        autoPublish: {
          audio: true,
          video: false // Assuming this is a voice-only call
        }
      },

      // If a room with the extracted roomName (from X-LK-RoomName) doesn't exist,
      // Livekit will automatically create it. Essential for dynamic rooms.
      createRoom: true,

      // Optional: You can set a default room preset if desired.
      roomPreset: 'video_call', // Consider 'audio_call' for voice-only
      // Optional: Default participant name if 'X-LK-CallerId' is not available or for display.
      participantName: 'PSTN Caller'
      // You can remove hidePhoneNumber and participantMetadata if not strictly needed
      // hidePhoneNumber: false,
      // participantMetadata: JSON.stringify({
      //   source: 'pstn',
      //   callType: 'incoming'
      // })
    };

    console.log('Attempting to create/update SIP dispatch rule with configuration:', {
      ruleId: request.sipDispatchRuleId,
      name: request.name,
      dispatchKey: request.dispatchKey,
      inboundSipTrunking: request.inboundSipTrunking,
      trunkIds: request.trunkIds,
      targetRoomNameSource: request.target.roomName,
      targetParticipantIdentitySource: request.target.participantIdentity,
      createRoom: request.createRoom
    });

    // Call the LiveKit API to create or update the SIP Dispatch Rule
    const dispatchInfo = await client.updateSipDispatchRule(request);

    console.log(`✓ SIP dispatch rule '${dispatchInfo.name}' created/updated successfully`);
    console.log(`  - Rule ID: ${dispatchInfo.sipDispatchRuleId}`);
    console.log(`  - Routes calls matching '${request.dispatchKey}' to rooms from 'X-LK-RoomName' header.`);
    console.log(`  - Participant identity from 'X-LK-CallerId' header.`);

    return dispatchInfo;

  } catch (error) {
    console.error('Failed to create dispatch rule:', error);
    throw new Error(`Dispatch rule creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
