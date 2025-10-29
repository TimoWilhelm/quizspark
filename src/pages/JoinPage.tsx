import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster, toast } from 'sonner';
import { useGameStore } from '@/lib/game-store';
export function JoinPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const setGamePin = useGameStore(s => s.setGamePin);
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) {
      setGamePin(pin);
      navigate('/play');
    } else {
      toast.error('Please enter a valid 6-digit game PIN.');
    }
  };
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-2xl animate-scale-in">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-display">Join a Game</CardTitle>
          <CardDescription>Enter the PIN shown on the host's screen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-6">
            <Input
              type="text"
              placeholder="Game PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-4xl h-20 font-bold tracking-[1em]"
              maxLength={6}
            />
            <Button type="submit" className="w-full text-xl py-6 rounded-xl bg-quiz-blue hover:bg-quiz-blue/90" size="lg">
              Enter
            </Button>
          </form>
        </CardContent>
      </Card>
      <Toaster richColors />
    </div>
  );
}