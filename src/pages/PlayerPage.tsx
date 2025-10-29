import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '@/lib/game-store';
import { useGamePolling } from '@/hooks/useGamePolling';
import { Loader2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import { PlayerNicknameForm } from '@/components/game/player/PlayerNicknameForm';
import { PlayerAnswerScreen } from '@/components/game/player/PlayerAnswerScreen';
import { PlayerWaitingScreen } from '@/components/game/player/PlayerWaitingScreen';
import { useSound } from '@/hooks/useSound';
// Fisher-Yates shuffle algorithm
const shuffleArray = (array: number[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};
export function PlayerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId');
  const playerId = useGameStore(s => s.playerId);
  const setPlayerId = useGameStore(s => s.setPlayerId);
  const setGameState = useGameStore(s => s.setGameState);
  const [nickname, setNickname] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; score: number } | null>(null);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const { playSound } = useSound();
  useEffect(() => {
    if (!gameId) {
      toast.error("No game ID found. Returning to home page.");
      navigate('/');
    }
    if (!playerId) {
      setPlayerId(crypto.randomUUID()); // This is safe, it only runs if playerId is not in session storage
    }
  }, [gameId, playerId, navigate, setPlayerId]);
  const { isLoading, error, gameState } = useGamePolling(gameId!, isJoined && !!gameId);
  const currentQuestionIndex = gameState?.currentQuestionIndex;
  const questionOptionsCount = gameState?.questions[currentQuestionIndex ?? -1]?.options.length;
  useEffect(() => {
    if (gameState?.phase === 'QUESTION' && questionOptionsCount) {
      setSubmittedAnswer(null);
      setAnswerResult(null);
      const initialIndices = Array.from({ length: questionOptionsCount }, (_, i) => i);
      setShuffledIndices(shuffleArray(initialIndices));
    }
    if (gameState?.phase === 'REVEAL' && submittedAnswer !== null) {
      const myAnswer = gameState.answers.find(a => a.playerId === playerId);
      if (myAnswer && !answerResult) { // Only set result once
        const result = { isCorrect: myAnswer.isCorrect, score: myAnswer.score };
        setAnswerResult(result);
        playSound(result.isCorrect ? 'correct' : 'incorrect');
      }
    }
  }, [gameState?.phase, currentQuestionIndex, questionOptionsCount, gameState?.answers, playerId, submittedAnswer, playSound, answerResult]);
  const handleJoin = async (name: string) => {
    if (!name.trim() || !playerId || !gameId) return;
    setIsJoining(true);
    setNickname(name);
    try {
      const res = await fetch(`/api/games/${gameId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      setGameState(data.data);
      setIsJoined(true);
      toast.success(`Welcome, ${name}!`);
      playSound('join');
    } catch (err: any) {
      toast.error(err.message);
      setIsJoining(false);
    }
  };
  const handleAnswer = async (answerIndex: number) => {
    if (submittedAnswer !== null || !playerId || !gameId) return;
    setSubmittedAnswer(answerIndex);
    try {
      await fetch(`/api/games/${gameId}/answer`, {
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
    if (gameState.phase === 'QUESTION' && shuffledIndices.length > 0) {
      return (
        <PlayerAnswerScreen
          onAnswer={handleAnswer}
          submittedAnswer={submittedAnswer}
          shuffledIndices={shuffledIndices}
        />
      );
    }
    return (
      <PlayerWaitingScreen
        phase={gameState.phase}
        answerResult={answerResult}
        finalScore={me?.score}
        playerId={playerId}
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