import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/lib/game-store';
import { useGamePolling } from '@/hooks/useGamePolling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
const shapeColors = [
  'bg-quiz-red',    // Triangle
  'bg-quiz-blue',   // Diamond
  'bg-quiz-yellow', // Circle
  'bg-quiz-pink',   // Square
];
const shapePaths = [
  "M12 2L2 22h20L12 2z", // Triangle
  "M12 2l10 10-10 10-10-10L12 2z", // Diamond
  "M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z", // Circle
  "M2 2h20v20H2V2z" // Square
];
export function PlayerPage() {
  const navigate = useNavigate();
  const { gamePin, playerId, setPlayerId, setGameState } = useGameStore(s => ({
    gamePin: s.gamePin,
    playerId: s.playerId,
    setPlayerId: s.setPlayerId,
    setGameState: s.setGameState,
  }));
  const [nickname, setNickname] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; score: number } | null>(null);
  useEffect(() => {
    if (!gamePin) {
      navigate('/join');
    }
    if (!playerId) {
      setPlayerId(crypto.randomUUID());
    }
  }, [gamePin, playerId, navigate, setPlayerId]);
  const { isLoading, error, gameState } = useGamePolling(gamePin, isJoined);
  useEffect(() => {
    if (gameState?.phase === 'QUESTION') {
      setSubmittedAnswer(null);
      setAnswerResult(null);
    }
    if (gameState?.phase === 'REVEAL' && submittedAnswer !== null) {
      const myAnswer = gameState.answers.find(a => a.playerId === playerId && a.answerIndex === submittedAnswer);
      if (myAnswer) {
        setAnswerResult({ isCorrect: myAnswer.isCorrect, score: myAnswer.score });
      }
    }
  }, [gameState?.phase, gameState?.answers, playerId, submittedAnswer]);
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !playerId) return;
    try {
      const res = await fetch(`/api/games/${gamePin}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nickname, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      setGameState(data.data);
      setIsJoined(true);
      toast.success(`Welcome, ${nickname}!`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  const handleAnswer = async (answerIndex: number) => {
    if (submittedAnswer !== null) return;
    setSubmittedAnswer(answerIndex);
    try {
      await fetch(`/api/games/${gamePin}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, answerIndex }),
      });
    } catch (err) {
      console.error(err);
      toast.error('Could not submit answer.');
      setSubmittedAnswer(null);
    }
  };
  if (!isJoined) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-2xl rounded-2xl animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-display">Enter a Nickname</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-6">
              <Input
                placeholder="Your cool name"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="text-center text-2xl h-16"
              />
              <Button type="submit" className="w-full text-xl py-6 rounded-xl bg-quiz-blue hover:bg-quiz-blue/90" size="lg">
                Join Game
              </Button>
            </form>
          </CardContent>
        </Card>
        <Toaster richColors />
      </div>
    );
  }
  const me = gameState?.players.find(p => p.id === playerId);
  const renderContent = () => {
    if (isLoading && !gameState) return <Loader2 className="h-16 w-16 animate-spin text-white" />;
    if (error) return <div className="text-red-300">{error}</div>;
    if (!gameState) return <div>Waiting for game...</div>;
    switch (gameState.phase) {
      case 'LOBBY':
        return <div className="text-center"><h2 className="text-4xl font-bold">You're in!</h2><p>See your name on the big screen.</p></div>;
      case 'QUESTION':
        return (
          <div className="grid grid-cols-2 gap-4 w-full h-full">
            {shapeColors.slice(0, gameState.questions[gameState.currentQuestionIndex].options.length).map((color, i) => (
              <motion.button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={submittedAnswer !== null}
                className={`rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 ${color} ${submittedAnswer !== null && submittedAnswer !== i ? 'opacity-25' : ''}`}
                whileTap={{ scale: 0.9 }}
              >
                <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 text-white fill-current"><path d={shapePaths[i]} /></svg>
              </motion.button>
            ))}
          </div>
        );
      case 'REVEAL':
      case 'LEADERBOARD':
        if (answerResult) {
          return (
            <div className={`flex flex-col items-center justify-center text-center ${answerResult.isCorrect ? 'text-green-300' : 'text-red-300'}`}>
              {answerResult.isCorrect ? <CheckCircle className="w-24 h-24" /> : <XCircle className="w-24 h-24" />}
              <h2 className="text-5xl font-bold mt-4">{answerResult.isCorrect ? 'Correct!' : 'Incorrect'}</h2>
              <p className="text-3xl">+ {answerResult.score} points</p>
            </div>
          );
        }
        return <div className="text-center"><h2 className="text-4xl font-bold">Get ready...</h2><p>Look at the main screen.</p></div>;
      case 'END':
        return <div className="text-center"><h2 className="text-4xl font-bold">Game Over!</h2><p className="text-2xl">Your final score: {me?.score}</p></div>;
      default:
        return <div>Waiting...</div>;
    }
  };
  return (
    <div className="min-h-screen w-full bg-slate-800 text-white flex flex-col p-4">
      <header className="flex justify-between items-center text-2xl font-bold">
        <span>{nickname}</span>
        <span>Score: {me?.score || 0}</span>
      </header>
      <main className="flex-grow flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={gameState?.phase}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="w-full h-full flex items-center justify-center"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
      <Toaster richColors theme="dark" />
    </div>
  );
}