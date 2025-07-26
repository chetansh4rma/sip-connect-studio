import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Room {
  name: string;
  participantCount: number;
  lastActivity: string;
}

interface RoomListProps {
  onJoinRoom: (roomName: string) => void;
}

export function RoomList({ onJoinRoom }: RoomListProps) {
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const { toast } = useToast();

  // Mock room data - in a real app, this would come from LiveKit API
  useEffect(() => {
    // Simulate some active rooms
    const mockRooms: Room[] = [
      { name: "7626818255", participantCount: 1, lastActivity: "2 minutes ago" },
      { name: "5551234567", participantCount: 0, lastActivity: "5 minutes ago" },
      { name: "9876543210", participantCount: 1, lastActivity: "1 minute ago" },
    ];
    
    setAvailableRooms(mockRooms);
  }, []);

  const handleJoinRoom = (roomName: string) => {
    toast({
      title: "Joining room",
      description: `Connecting to room ${roomName}...`,
    });
    onJoinRoom(roomName);
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