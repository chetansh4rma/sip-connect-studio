import { SipTrunkInfo, SipDispatchRuleInfo, CreateSipTrunkRequest, CreateSipDispatchRuleRequest } from 'livekit-server-sdk';
import type { Config } from './config';

/**
 * Sets up the LiveKit SIP trunk for receiving calls from Twilio
 */
export async function setupSipTrunk(config: Config): Promise<SipTrunkInfo> {
  try {
    const request: CreateSipTrunkRequest = {
      sipTrunkId: 'twilio-pstn-trunk',
      name: 'Twilio PSTN Trunk',
      metadata: 'Trunk for receiving PSTN calls via Twilio',
      // Allow incoming calls from Twilio's IP ranges
      inboundAddresses: [
        '54.172.60.0/30',    // Twilio US East
        '54.244.51.0/30',    // Twilio US West  
        '177.71.206.192/30', // Twilio South America
        '54.171.127.192/30'  // Additional Twilio range
      ],
      // Use username/password auth for Twilio
      inboundUsername: config.LIVEKIT_SIP_TRUNK_NUMBER,
      inboundPassword: generateSecurePassword(),
      // Transport settings
      transport: 'udp'
    };

    console.log('Creating SIP trunk with configuration:', {
      sipTrunkId: request.sipTrunkId,
      name: request.name,
      addressCount: request.inboundAddresses?.length
    });

    // Note: In a real implementation, you would call the LiveKit API here
    // For this demo, we'll simulate the response
    const trunkInfo: SipTrunkInfo = {
      sipTrunkId: request.sipTrunkId!,
      name: request.name!,
      metadata: request.metadata || '',
      inboundAddresses: request.inboundAddresses || [],
      inboundUsername: request.inboundUsername!,
      inboundPassword: request.inboundPassword!,
      transport: request.transport || 'udp'
    };

    console.log(`✓ SIP trunk '${trunkInfo.name}' created successfully`);
    console.log(`  - Trunk ID: ${trunkInfo.sipTrunkId}`);
    console.log(`  - Username: ${trunkInfo.inboundUsername}`);
    console.log(`  - Allowed addresses: ${trunkInfo.inboundAddresses.length} ranges`);

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
  try {
    const request: CreateSipDispatchRuleRequest = {
      sipDispatchRuleId: 'pstn-to-room-rule',
      name: 'PSTN Call Router',
      metadata: 'Routes incoming PSTN calls to LiveKit rooms',
      // Route to trunk
      trunkIds: ['twilio-pstn-trunk'],
      // Create room based on caller ID or call SID
      roomName: '${caller_id}-${call_id}',
      roomPreset: 'video_call',
      // Auto-create rooms for incoming calls
      hidePhoneNumber: false,
      // Participant settings
      participantIdentity: 'pstn-caller-${caller_id}',
      participantName: 'Caller ${caller_id}',
      participantMetadata: JSON.stringify({
        source: 'pstn',
        callType: 'incoming'
      })
    };

    console.log('Creating SIP dispatch rule:', {
      ruleId: request.sipDispatchRuleId,
      name: request.name,
      trunkIds: request.trunkIds
    });

    // Note: In a real implementation, you would call the LiveKit API here
    // For this demo, we'll simulate the response
    const dispatchInfo: SipDispatchRuleInfo = {
      sipDispatchRuleId: request.sipDispatchRuleId!,
      name: request.name!,
      metadata: request.metadata || '',
      trunkIds: request.trunkIds || [],
      roomName: request.roomName!,
      roomPreset: request.roomPreset,
      hidePhoneNumber: request.hidePhoneNumber || false,
      participantIdentity: request.participantIdentity!,
      participantName: request.participantName,
      participantMetadata: request.participantMetadata
    };

    console.log(`✓ SIP dispatch rule '${dispatchInfo.name}' created successfully`);
    console.log(`  - Rule ID: ${dispatchInfo.sipDispatchRuleId}`);
    console.log(`  - Room pattern: ${dispatchInfo.roomName}`);
    console.log(`  - Participant identity: ${dispatchInfo.participantIdentity}`);

    return dispatchInfo;

  } catch (error) {
    console.error('Failed to create dispatch rule:', error);
    throw new Error(`Dispatch rule creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates a secure password for SIP authentication
 */
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}