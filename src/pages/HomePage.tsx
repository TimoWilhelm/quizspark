import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster, toast } from 'sonner';
import type { ApiResponse, GameState, QuizTopic } from '@shared/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
export function HomePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [quizzes, setQuizzes] = useState<QuizTopic[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  useEffect(() => {
    const fetchQuizzes = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/quizzes');
        const result = await response.json() as ApiResponse<QuizTopic[]>;
        if (result.success && result.data) {
          setQuizzes(result.data);
        } else {
          throw new Error(result.error || 'Failed to fetch quizzes');
        }
      } catch (error) {
        console.error(error);
        toast.error('Could not load quizzes. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuizzes();
  }, []);
  const handleStartGame = async () => {
    if (!selectedQuizId) {
      toast.error('Please select a quiz to start.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: selectedQuizId }),
      });
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
      <div className="text-center space-y-8 relative z-10 animate-fade-in w-full max-w-4xl">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-quiz-pink to-quiz-blue flex items-center justify-center shadow-lg animate-float">
            <Sparkles className="w-12 h-12 text-white animate-pulse" />
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-bold text-balance leading-tight">
          Welcome to <span className="text-quiz-blue">QuizSpark</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto text-pretty">
          Select a quiz to begin the fun!
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AnimatePresence>
            {quizzes.map((quiz, index) => (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  onClick={() => setSelectedQuizId(quiz.id)}
                  className={cn(
                    "cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl",
                    selectedQuizId === quiz.id && "ring-4 ring-quiz-blue shadow-xl"
                  )}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {quiz.title}
                      {selectedQuizId === quiz.id && <CheckCircle className="w-6 h-6 text-quiz-blue" />}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            onClick={handleStartGame}
            disabled={isLoading || !selectedQuizId}
            className="bg-quiz-blue hover:bg-quiz-blue/90 text-white px-12 py-8 text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            ) : (
              'Start Selected Quiz'
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