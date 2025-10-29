import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster, toast } from 'sonner';
import type { ApiResponse, GameState } from '@shared/types';
export function HomePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const handleStartGame = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/games', { method: 'POST' });
      const result = await response.json() as ApiResponse<GameState>;
      if (result.success && result.data) {
        toast.success('New game created!');
        navigate(`/host/${result.data.id}`);
      } else {
        throw new Error(result.error || 'Failed to create game');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not start a new game. Please try again.');
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-fuchsia-100 to-slate-50 opacity-50 pointer-events-none" />
      <div className="text-center space-y-8 relative z-10 animate-fade-in">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-quiz-pink to-quiz-blue flex items-center justify-center shadow-lg animate-float">
            <Sparkles className="w-12 h-12 text-white animate-pulse" />
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-bold text-balance leading-tight">
          Welcome to <span className="text-quiz-blue">QuizSpark</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto text-pretty">
          The easiest way to host a live, interactive quiz for any event.
        </p>
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            onClick={handleStartGame}
            disabled={isLoading}
            className="bg-quiz-blue hover:bg-quiz-blue/90 text-white px-12 py-8 text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            ) : (
              'Start New Game'
            )}
          </Button>
        </div>
      </div>
      <footer className="absolute bottom-8 text-center text-muted-foreground/80">
        <p>Built with ❤️ at Cloudflare</p>
      </footer>
      <Toaster richColors closeButton />
    </div>
  );
}