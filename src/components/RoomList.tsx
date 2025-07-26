import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Room {
  name: string;
  participantCount: number;
  lastActivity: string;
}

interface LiveKitRoom {
  name: string;
  sid: string;
  participants: number;
  createdAt: string;
}

interface RoomListProps {
  onJoinRoom: (roomName: string) => void;
}

// Extract clean room ID from phone number (same logic as server)
function extractRoomId(phone: string): string {
  let digits = phone.replace(/\D/g, ''); // Remove all non-digits
  if (digits.length > 10) {
    digits = digits.slice(-10); // Always return last 10 digits
  }
  return digits;
}

export function RoomList({ onJoinRoom }: RoomListProps) {
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const { toast } = useToast();
  const autoConnectedRef = useRef<Set<string>>(new Set());

  // Fetch rooms from LiveKit API and auto-connect to PSTN rooms
  const fetchRooms = async () => {
    try {
      const response = await fetch('https://sip-connect-studio-3.onrender.com/api/rooms');
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const rooms: Room[] = data.map((room: LiveKitRoom) => ({
          name: room.name,
          participantCount: room.participants,
          lastActivity: new Date(room.createdAt).toLocaleString()
        }));
        
        setAvailableRooms(rooms);
        
        // Auto-connect to PSTN rooms (pattern: room__+[phone]_[id])
        const pstnRooms = rooms.filter(room => 
          room.name.startsWith('room__+') && 
          room.participantCount > 0 &&
          !autoConnectedRef.current.has(room.name)
        );
        
        if (pstnRooms.length > 0) {
          const targetRoom = pstnRooms[0];
          autoConnectedRef.current.add(targetRoom.name);
          
          console.log(`🤖 Auto-connecting to PSTN room: ${targetRoom.name}`);
          toast({
            title: "Auto-connecting",
            description: `Joining PSTN call room ${targetRoom.name}`,
          });
          onJoinRoom(targetRoom.name);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchRooms();
    
    // Poll every 5 seconds
    const interval = setInterval(fetchRooms, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleJoinRoom = (roomName: string) => {
    const cleanRoomId = extractRoomId(roomName);
    console.log(`📋 RoomList joining: "${roomName}" -> Clean ID: "${cleanRoomId}"`);
    
    toast({
      title: "Joining room",
      description: `Connecting to room ${cleanRoomId}...`,
    });
    onJoinRoom(cleanRoomId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Available Rooms
        </CardTitle>
      </CardHeader>
      <CardContent>
        {availableRooms.length === 0 ? (
          <p className="text-muted-foreground">No active rooms</p>
        ) : (
          <div className="space-y-3">
            {availableRooms.map((room) => (
              <div
                key={room.name}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">Room: {room.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {room.participantCount} participant(s) • {room.lastActivity}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleJoinRoom(room.name)}
                  size="sm"
                  variant={room.participantCount > 0 ? "default" : "outline"}
                >
                  Join Call
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}