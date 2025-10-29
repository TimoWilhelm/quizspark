import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, CheckCircle, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Toaster, toast } from 'sonner';
import type { ApiResponse, GameState, QuizTopic, Quiz } from '@shared/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
export function HomePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isGameStarting, setIsGameStarting] = useState(false);
  const [predefinedQuizzes, setPredefinedQuizzes] = useState<QuizTopic[]>([]);
  const [customQuizzes, setCustomQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const fetchQuizzes = async () => {
    setIsLoading(true);
    try {
      const [predefinedRes, customRes] = await Promise.all([
        fetch('/api/quizzes'),
        fetch('/api/quizzes/custom'),
      ]);
      const predefinedResult = await predefinedRes.json() as ApiResponse<QuizTopic[]>;
      const customResult = await customRes.json() as ApiResponse<Quiz[]>;
      if (predefinedResult.success && predefinedResult.data) {
        setPredefinedQuizzes(predefinedResult.data);
      }
      if (customResult.success && customResult.data) {
        setCustomQuizzes(customResult.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not load quizzes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchQuizzes();
  }, []);
  const handleStartGame = async () => {
    if (!selectedQuizId) {
      toast.error('Please select a quiz to start.');
      return;
    }
    setIsGameStarting(true);
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: selectedQuizId }),
      });
      const result = await response.json() as ApiResponse<GameState>;
      if (result.success && result.data) {
        if ('error' in result.data) {
          throw new Error((result.data as any).error);
        }
        toast.success('New game created!');
        navigate(`/host/${result.data.id}`);
      } else {
        throw new Error(result.error || 'Failed to create game');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Could not start a new game. Please try again.');
      setIsGameStarting(false);
    }
  };
  const handleDeleteQuiz = async (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this quiz?')) {
      try {
        const res = await fetch(`/api/quizzes/custom/${quizId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete quiz');
        toast.success('Quiz deleted!');
        if (selectedQuizId === quizId) setSelectedQuizId(null);
        fetchQuizzes(); // Refresh list
      } catch (err) {
        toast.error('Could not delete quiz.');
      }
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
          Select a quiz to begin the fun, or create your own!
        </p>
        {isLoading ? <Loader2 className="mx-auto h-12 w-12 animate-spin text-quiz-blue" /> : (
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-left mb-4">Featured Quizzes</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {predefinedQuizzes.map((quiz, index) => (
                  <motion.div key={quiz.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                    <Card onClick={() => setSelectedQuizId(quiz.id)} className={cn("cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl", selectedQuizId === quiz.id && "ring-4 ring-quiz-blue shadow-xl")}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">{quiz.title}{selectedQuizId === quiz.id && <CheckCircle className="w-6 h-6 text-quiz-blue" />}</CardTitle>
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-2xl font-bold text-left mb-4">Your Quizzes</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {customQuizzes.map((quiz, index) => (
                  <motion.div key={quiz.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (predefinedQuizzes.length + index) * 0.1 }}>
                    <Card onClick={() => setSelectedQuizId(quiz.id)} className={cn("cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl", selectedQuizId === quiz.id && "ring-4 ring-quiz-blue shadow-xl")}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="truncate pr-2">{quiz.title}</span>
                          <div className="flex items-center shrink-0">
                            {selectedQuizId === quiz.id && <CheckCircle className="w-6 h-6 text-quiz-blue mr-2" />}
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/edit/${quiz.id}`); }}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={(e) => handleDeleteQuiz(e, quiz.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (predefinedQuizzes.length + customQuizzes.length) * 0.1 }}>
                  <Card onClick={() => navigate('/edit')} className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl border-dashed border-2 flex items-center justify-center h-full min-h-[95px]">
                    <div className="flex items-center text-muted-foreground">
                      <PlusCircle className="w-6 h-6 mr-2" /> Create New Quiz
                    </div>
                  </Card>
                </motion.div>
              </div>
            </section>
          </div>
        )}
        <div className="flex justify-center gap-4 pt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <Button size="lg" onClick={handleStartGame} disabled={isGameStarting || !selectedQuizId} className="bg-quiz-blue hover:bg-quiz-blue/90 text-white px-12 py-8 text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95">
                    {isGameStarting ? <Loader2 className="mr-2 h-8 w-8 animate-spin" /> : 'Start Selected Quiz'}
                  </Button>
                </div>
              </TooltipTrigger>
              {!selectedQuizId && (
                <TooltipContent>
                  <p>Please select a quiz first!</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <footer className="absolute bottom-8 text-center text-muted-foreground/80">
        <p>Built with ❤️ at Cloudflare</p>
      </footer>
      <Toaster richColors closeButton />
    </div>
  );
}