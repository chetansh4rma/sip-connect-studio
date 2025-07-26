import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock active calls management system
interface ActiveCall {
  id: string;
  roomId: string;
  callerNumber: string;
  startTime: Date;
  status: 'waiting' | 'connected' | 'ended';
  agentId?: string;
}

interface Agent {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  currentCallId?: string;
}

class CallManagementSystem {
  private calls: ActiveCall[] = [];
  private agents: Agent[] = [];
  private autoAssign: boolean = false;

  // Simulate incoming call
  receiveCall(callerNumber: string): ActiveCall {
    const timestamp = Date.now();
    const roomId = `call-${timestamp}`;
    
    const newCall: ActiveCall = {
      id: timestamp.toString(),
      roomId,
      callerNumber,
      startTime: new Date(),
      status: 'waiting'
    };

    this.calls.push(newCall);
    console.log(`📞 Incoming call from ${callerNumber} → assigned to room: ${roomId}`);

    // Auto-assign if enabled and agents available
    if (this.autoAssign) {
      const availableAgent = this.agents.find(a => a.status === 'available');
      if (availableAgent) {
        this.assignCall(newCall.id, availableAgent.id);
      }
    }

    return newCall;
  }

  // Register agent
  registerAgent(name: string): Agent {
    const agent: Agent = {
      id: Date.now().toString(),
      name,
      status: 'available'
    };
    this.agents.push(agent);
    return agent;
  }

  // Assign call to agent
  assignCall(callId: string, agentId: string): boolean {
    const call = this.calls.find(c => c.id === callId);
    const agent = this.agents.find(a => a.id === agentId);

    if (!call || !agent || agent.status !== 'available') {
      return false;
    }

    call.status = 'connected';
    call.agentId = agentId;
    
    agent.status = 'busy';
    agent.currentCallId = callId;

    console.log(`🎯 Call ${call.callerNumber} assigned to agent ${agent.name}`);
    return true;
  }

  // End call
  endCall(callId: string): boolean {
    const call = this.calls.find(c => c.id === callId);
    if (!call) return false;

    if (call.agentId) {
      const agent = this.agents.find(a => a.id === call.agentId);
      if (agent) {
        agent.status = 'available';
        agent.currentCallId = undefined;
      }
    }

    call.status = 'ended';
    console.log(`📞 Call ended: ${call.callerNumber} - Room: ${call.roomId}`);
    return true;
  }

  // Getters
  getWaitingCalls(): ActiveCall[] {
    return this.calls.filter(c => c.status === 'waiting');
  }

  getActiveCalls(): ActiveCall[] {
    return this.calls.filter(c => c.status === 'connected');
  }

  getAvailableAgents(): Agent[] {
    return this.agents.filter(a => a.status === 'available');
  }

  setAutoAssign(enabled: boolean): void {
    this.autoAssign = enabled;
  }

  // Clear all data (for testing)
  clear(): void {
    this.calls = [];
    this.agents = [];
    this.autoAssign = false;
  }
}

describe('Call Management System', () => {
  let callSystem: CallManagementSystem;
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    callSystem = new CallManagementSystem();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    callSystem.clear();
  });

  describe('Incoming Call Flow', () => {
    it('should create a new call with correct room ID format', () => {
      const callerNumber = '+18563918711';
      const call = callSystem.receiveCall(callerNumber);

      expect(call.callerNumber).toBe(callerNumber);
      expect(call.roomId).toMatch(/^call-\d+$/);
      expect(call.status).toBe('waiting');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`📞 Incoming call from ${callerNumber} → assigned to room: ${call.roomId}`)
      );
    });

    it('should generate unique room IDs for multiple calls', () => {
      const call1 = callSystem.receiveCall('+15551234567');
      const call2 = callSystem.receiveCall('+15559876543');

      expect(call1.roomId).not.toBe(call2.roomId);
      expect(call1.id).not.toBe(call2.id);
    });

    it('should track waiting calls correctly', () => {
      callSystem.receiveCall('+15551111111');
      callSystem.receiveCall('+15552222222');

      const waitingCalls = callSystem.getWaitingCalls();
      expect(waitingCalls).toHaveLength(2);
      expect(waitingCalls.every(c => c.status === 'waiting')).toBe(true);
    });
  });

  describe('Agent Management', () => {
    it('should register agents as available', () => {
      const agent = callSystem.registerAgent('John Doe');

      expect(agent.name).toBe('John Doe');
      expect(agent.status).toBe('available');
      expect(callSystem.getAvailableAgents()).toHaveLength(1);
    });

    it('should assign calls to available agents', () => {
      const agent = callSystem.registerAgent('Jane Smith');
      const call = callSystem.receiveCall('+15551234567');

      const assigned = callSystem.assignCall(call.id, agent.id);

      expect(assigned).toBe(true);
      expect(call.status).toBe('connected');
      expect(call.agentId).toBe(agent.id);
      expect(agent.status).toBe('busy');
      expect(agent.currentCallId).toBe(call.id);
    });

    it('should not assign calls to busy agents', () => {
      const agent = callSystem.registerAgent('Bob Wilson');
      const call1 = callSystem.receiveCall('+15551111111');
      const call2 = callSystem.receiveCall('+15552222222');

      // Assign first call
      callSystem.assignCall(call1.id, agent.id);
      
      // Try to assign second call to same agent
      const assigned = callSystem.assignCall(call2.id, agent.id);

      expect(assigned).toBe(false);
      expect(call2.status).toBe('waiting');
      expect(call2.agentId).toBeUndefined();
    });
  });

  describe('Auto-Assignment Feature', () => {
    it('should automatically assign calls when auto-assign is enabled', () => {
      callSystem.setAutoAssign(true);
      const agent = callSystem.registerAgent('Auto Agent');
      
      const call = callSystem.receiveCall('+15551234567');

      // Call should be automatically assigned
      expect(call.status).toBe('connected');
      expect(call.agentId).toBe(agent.id);
      expect(agent.status).toBe('busy');
    });

    it('should not auto-assign when no agents are available', () => {
      callSystem.setAutoAssign(true);
      
      const call = callSystem.receiveCall('+15551234567');

      expect(call.status).toBe('waiting');
      expect(call.agentId).toBeUndefined();
    });

    it('should not auto-assign when feature is disabled', () => {
      callSystem.setAutoAssign(false);
      const agent = callSystem.registerAgent('Manual Agent');
      
      const call = callSystem.receiveCall('+15551234567');

      expect(call.status).toBe('waiting');
      expect(call.agentId).toBeUndefined();
      expect(agent.status).toBe('available');
    });
  });

  describe('Call Termination', () => {
    it('should end calls and free up agents', () => {
      const agent = callSystem.registerAgent('Test Agent');
      const call = callSystem.receiveCall('+15551234567');
      callSystem.assignCall(call.id, agent.id);

      const ended = callSystem.endCall(call.id);

      expect(ended).toBe(true);
      expect(call.status).toBe('ended');
      expect(agent.status).toBe('available');
      expect(agent.currentCallId).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`📞 Call ended: ${call.callerNumber} - Room: ${call.roomId}`)
      );
    });

    it('should handle ending non-existent calls gracefully', () => {
      const ended = callSystem.endCall('non-existent-id');
      expect(ended).toBe(false);
    });
  });

  describe('Real-time Notifications', () => {
    it('should log room assignment for incoming calls', () => {
      const callerNumber = '+18563918711';
      const call = callSystem.receiveCall(callerNumber);

      expect(consoleSpy).toHaveBeenCalledWith(
        `📞 Incoming call from ${callerNumber} → assigned to room: ${call.roomId}`
      );
    });

    it('should log agent assignment', () => {
      const agent = callSystem.registerAgent('Notification Agent');
      const call = callSystem.receiveCall('+15551234567');
      
      callSystem.assignCall(call.id, agent.id);

      expect(consoleSpy).toHaveBeenCalledWith(
        `🎯 Call ${call.callerNumber} assigned to agent ${agent.name}`
      );
    });

    it('should log call termination', () => {
      const call = callSystem.receiveCall('+15551234567');
      
      callSystem.endCall(call.id);

      expect(consoleSpy).toHaveBeenCalledWith(
        `📞 Call ended: ${call.callerNumber} - Room: ${call.roomId}`
      );
    });
  });

  describe('Room ID Compatibility', () => {
    it('should generate room IDs that browser can join', () => {
      const call = callSystem.receiveCall('+18563918711');
      
      // Room ID should be in format: call-<timestamp>
      expect(call.roomId).toMatch(/^call-\d{13}$/);
      
      // Should be joinable by browser using same room ID
      expect(call.roomId.startsWith('call-')).toBe(true);
      expect(call.roomId.length).toBeGreaterThan(10);
    });

    it('should handle multiple simultaneous calls', () => {
      const calls = [
        callSystem.receiveCall('+15551111111'),
        callSystem.receiveCall('+15552222222'),
        callSystem.receiveCall('+15553333333')
      ];

      // All calls should have unique room IDs
      const roomIds = calls.map(c => c.roomId);
      const uniqueRoomIds = new Set(roomIds);
      expect(uniqueRoomIds.size).toBe(3);

      // All should be waiting for assignment
      expect(callSystem.getWaitingCalls()).toHaveLength(3);
    });
  });
});