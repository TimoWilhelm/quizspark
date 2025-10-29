import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/lib/game-store';
import { useGamePolling } from '@/hooks/useGamePolling';
import { Loader2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import { PlayerNicknameForm } from '@/components/game/player/PlayerNicknameForm';
import { PlayerAnswerScreen } from '@/components/game/player/PlayerAnswerScreen';
import { PlayerWaitingScreen } from '@/components/game/player/PlayerWaitingScreen';
export function PlayerPage() {
  const navigate = useNavigate();
  const gamePin = useGameStore(s => s.gamePin);
  const playerId = useGameStore(s => s.playerId);
  const setPlayerId = useGameStore(s => s.setPlayerId);
  const setGameState = useGameStore(s => s.setGameState);
  const [nickname, setNickname] = useState('');
  const [isJoining, setIsJoining] = useState(false);
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
  const handleJoin = async (name: string) => {
    if (!name.trim() || !playerId || !gamePin) return;
    setIsJoining(true);
    setNickname(name);
    try {
      const res = await fetch(`/api/games/${gamePin}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      setGameState(data.data);
      setIsJoined(true);
      toast.success(`Welcome, ${name}!`);
    } catch (err: any) {
      toast.error(err.message);
      setIsJoining(false);
    }
  };
  const handleAnswer = async (answerIndex: number) => {
    if (submittedAnswer !== null || !playerId || !gamePin) return;
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
      <>
        <PlayerNicknameForm onJoin={handleJoin} isLoading={isJoining} />
        <Toaster richColors />
      </>
    );
  }
  const me = gameState?.players.find(p => p.id === playerId);
  const renderContent = () => {
    if (isLoading && !gameState) return <Loader2 className="h-16 w-16 animate-spin text-white" />;
    if (error) return <div className="text-red-300">{error}</div>;
    if (!gameState) return <div>Waiting for game...</div>;
    if (gameState.phase === 'QUESTION') {
      const question = gameState.questions[gameState.currentQuestionIndex];
      return (
        <PlayerAnswerScreen
          onAnswer={handleAnswer}
          submittedAnswer={submittedAnswer}
          answerCount={question.options.length}
        />
      );
    }
    return (
      <PlayerWaitingScreen
        phase={gameState.phase}
        answerResult={answerResult}
        finalScore={me?.score}
      />
    );
  };
  return (
    <div className="min-h-screen w-full bg-slate-800 text-white flex flex-col p-4">
      <header className="flex justify-between items-center text-2xl font-bold">
        <span>{nickname}</span>
        <span>Score: {me?.score || 0}</span>
      </header>
      <main className="flex-grow flex items-center justify-center">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
      <Toaster richColors theme="dark" />
    </div>
  );
}