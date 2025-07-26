import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { 
  Phone, 
  PhoneCall, 
  Users, 
  Clock, 
  UserCheck, 
  Bell, 
  PlayCircle,
  StopCircle,
  Volume2,
  VolumeX
} from 'lucide-react';
import { CallInterface } from './CallInterface';

interface ActiveCall {
  id: string;
  roomId: string;
  callerNumber: string;
  startTime: Date;
  status: 'waiting' | 'connected' | 'ended';
  agentId?: string;
  agentName?: string;
}

interface Agent {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  currentCallId?: string;
}

export const CallCenter = () => {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [autoAssign, setAutoAssign] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [joinedRoomId, setJoinedRoomId] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState('dashboard');

  // Mock agent registration
  const registerAgent = (name: string) => {
    const newAgent: Agent = {
      id: Date.now().toString(),
      name,
      status: 'available'
    };
    setAgents(prev => [...prev, newAgent]);
    setCurrentAgent(newAgent);
    toast({
      title: "Agent Registered",
      description: `Welcome, ${name}! You're now available to take calls.`
    });
  };

  // Simulate incoming calls
  const simulateIncomingCall = (callerNumber: string) => {
    const timestamp = Date.now();
    const roomId = `call-${timestamp}`;
    
    const newCall: ActiveCall = {
      id: timestamp.toString(),
      roomId,
      callerNumber,
      startTime: new Date(),
      status: 'waiting'
    };

    setActiveCalls(prev => [...prev, newCall]);
    
    // Console log as requested
    console.log(`📞 Incoming call from ${callerNumber} → assigned to room: ${roomId}`);
    
    // Show notification
    if (notifications) {
      toast({
        title: "Incoming Call 📞",
        description: `Call from ${callerNumber} - Room: ${roomId}`,
        action: (
          <Button 
            size="sm" 
            onClick={() => joinCall(newCall)}
            className="ml-2"
          >
            Answer
          </Button>
        )
      });
    }

    // Auto-assign if enabled and agent available
    if (autoAssign && currentAgent?.status === 'available') {
      setTimeout(() => assignCallToAgent(newCall.id, currentAgent.id), 1000);
    }
  };

  // Assign call to agent
  const assignCallToAgent = (callId: string, agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || agent.status !== 'available') return;

    setActiveCalls(prev => prev.map(call => 
      call.id === callId 
        ? { ...call, status: 'connected' as const, agentId, agentName: agent.name }
        : call
    ));

    setAgents(prev => prev.map(a => 
      a.id === agentId 
        ? { ...a, status: 'busy' as const, currentCallId: callId }
        : a
    ));

    const call = activeCalls.find(c => c.id === callId);
    if (call) {
      console.log(`🎯 Call ${call.callerNumber} assigned to agent ${agent.name}`);
      toast({
        title: "Call Assigned",
        description: `${agent.name} is now handling call from ${call.callerNumber}`
      });
    }
  };

  // Join call manually
  const joinCall = (call: ActiveCall) => {
    if (currentAgent && currentAgent.status === 'available') {
      assignCallToAgent(call.id, currentAgent.id);
      setJoinedRoomId(call.roomId);
      setSelectedTab('active-call');
    } else {
      setJoinedRoomId(call.roomId);
      setSelectedTab('active-call');
      toast({
        title: "Joining Call",
        description: `Connecting to room: ${call.roomId}`
      });
    }
  };

  // End call
  const endCall = (callId: string) => {
    const call = activeCalls.find(c => c.id === callId);
    if (call && call.agentId) {
      setAgents(prev => prev.map(a => 
        a.id === call.agentId 
          ? { ...a, status: 'available' as const, currentCallId: undefined }
          : a
      ));
    }

    setActiveCalls(prev => prev.map(call => 
      call.id === callId 
        ? { ...call, status: 'ended' as const }
        : call
    ));

    if (call) {
      console.log(`📞 Call ended: ${call.callerNumber} - Room: ${call.roomId}`);
    }

    if (joinedRoomId === call?.roomId) {
      setJoinedRoomId('');
      setSelectedTab('dashboard');
    }
  };

  // Remove ended calls after 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCalls(prev => 
        prev.filter(call => 
          call.status !== 'ended' || 
          Date.now() - call.startTime.getTime() < 30000
        )
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const waitingCalls = activeCalls.filter(call => call.status === 'waiting');
  const activeCalls_connected = activeCalls.filter(call => call.status === 'connected');
  const availableAgents = agents.filter(agent => agent.status === 'available');

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="grid w-fit grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="calls">Active Calls</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="active-call">Current Call</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4" />
              <Label htmlFor="notifications">Notifications</Label>
              <Switch 
                id="notifications"
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4" />
              <Label htmlFor="auto-assign">Auto-assign</Label>
              <Switch 
                id="auto-assign"
                checked={autoAssign}
                onCheckedChange={setAutoAssign}
              />
            </div>
          </div>
        </div>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex items-center p-4">
                <Phone className="w-8 h-8 text-primary mr-3" />
                <div>
                  <p className="text-2xl font-bold">{waitingCalls.length}</p>
                  <p className="text-sm text-muted-foreground">Waiting Calls</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center p-4">
                <PhoneCall className="w-8 h-8 text-green-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{activeCalls_connected.length}</p>
                  <p className="text-sm text-muted-foreground">Active Calls</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-4">
                <Users className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{availableAgents.length}</p>
                  <p className="text-sm text-muted-foreground">Available Agents</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-4">
                <Clock className="w-8 h-8 text-orange-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{agents.filter(a => a.status === 'busy').length}</p>
                  <p className="text-sm text-muted-foreground">Busy Agents</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent Registration */}
          {!currentAgent && (
            <Card>
              <CardHeader>
                <CardTitle>Register as Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter your name"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement;
                        if (target.value.trim()) {
                          registerAgent(target.value.trim());
                          target.value = '';
                        }
                      }
                    }}
                  />
                  <Button onClick={() => {
                    const input = document.querySelector('input[placeholder="Enter your name"]') as HTMLInputElement;
                    if (input?.value.trim()) {
                      registerAgent(input.value.trim());
                      input.value = '';
                    }
                  }}>
                    Register
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Test Incoming Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button 
                  onClick={() => simulateIncomingCall('+1 (856) 391-8711')}
                  variant="outline"
                >
                  Simulate Call from +1856391711
                </Button>
                <Button 
                  onClick={() => simulateIncomingCall('+1 (555) 123-4567')}
                  variant="outline"
                >
                  Simulate Call from +15551234567
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Waiting Calls */}
          {waitingCalls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" />
                  Incoming Calls ({waitingCalls.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {waitingCalls.map((call) => (
                    <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-orange-500" />
                        <div>
                          <p className="font-medium">{call.callerNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            Room: {call.roomId} • Waiting {Math.floor((Date.now() - call.startTime.getTime()) / 1000)}s
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => joinCall(call)}>
                          <PlayCircle className="w-4 h-4 mr-1" />
                          Answer
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => endCall(call.id)}>
                          <StopCircle className="w-4 h-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Active Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeCalls.filter(call => call.status !== 'ended').map((call) => (
                  <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={call.status === 'waiting' ? 'destructive' : 'default'}>
                        {call.status}
                      </Badge>
                      <div>
                        <p className="font-medium">{call.callerNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          Room: {call.roomId}
                          {call.agentName && ` • Agent: ${call.agentName}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {call.status === 'waiting' && (
                        <Button size="sm" onClick={() => joinCall(call)}>
                          Join
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => endCall(call.id)}>
                        End
                      </Button>
                    </div>
                  </div>
                ))}
                {activeCalls.filter(call => call.status !== 'ended').length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No active calls</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        agent.status === 'available' ? 'default' : 
                        agent.status === 'busy' ? 'destructive' : 'secondary'
                      }>
                        {agent.status}
                      </Badge>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        {agent.currentCallId && (
                          <p className="text-sm text-muted-foreground">
                            Handling call: {activeCalls.find(c => c.id === agent.currentCallId)?.callerNumber}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {agents.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No registered agents</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active-call" className="space-y-4">
          {joinedRoomId ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="w-5 h-5" />
                    Active Call - Room: {joinedRoomId}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        const call = activeCalls.find(c => c.roomId === joinedRoomId);
                        if (call) endCall(call.id);
                      }}
                    >
                      <StopCircle className="w-4 h-4 mr-2" />
                      End Call
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <CallInterface defaultRoomId={joinedRoomId} />
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <VolumeX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No active call</p>
                <p className="text-sm text-muted-foreground">Join a call from the dashboard to see it here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};