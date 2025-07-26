import React from 'react';
import { CallCenter } from '@/components/CallCenter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Globe, Zap, Shield } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <div className="pt-8 pb-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-primary rounded-lg shadow-glow">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                PSTN-to-Browser
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Production-grade system connecting phone calls to browser clients via Twilio + LiveKit
            </p>
            <div className="flex justify-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Globe className="w-3 h-3 mr-1" />
                Twilio SIP
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                LiveKit WebRTC
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />
                Real-time Audio
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Call Center */}
      <CallCenter />

      {/* Architecture Info */}
      <div className="max-w-4xl mx-auto px-6 pb-8">
        <Card className="shadow-soft mt-8">
          <CardHeader>
            <CardTitle className="text-lg">System Architecture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div className="space-y-2">
                <div className="font-medium text-primary">1. PSTN Call</div>
                <div className="text-muted-foreground">Caller dials Twilio number</div>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-primary">2. SIP Forward</div>
                <div className="text-muted-foreground">TwiML routes to LiveKit trunk</div>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-primary">3. Room Assignment</div>
                <div className="text-muted-foreground">Dispatch rule creates room</div>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-primary">4. Browser Join</div>
                <div className="text-muted-foreground">Web client connects via WebRTC</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
