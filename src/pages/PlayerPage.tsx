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
type View = 'LOADING' | 'NICKNAME' | 'GAME';
export function PlayerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlGameId = searchParams.get('gameId');
  // Zustand state
  const { gameState, gameId: sessionGameId, playerId, nickname, setGameState, setSession, clearSession } = useGameStore(s => ({
    gameState: s.gameState,
    gameId: s.gameId,
    playerId: s.playerId,
    nickname: s.nickname,
    setGameState: s.setGameState,
    setSession: s.setSession,
    clearSession: s.clearSession,
  }));
  const [view, setView] = useState<View>('LOADING');
  const [isJoining, setIsJoining] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; score: number } | null>(null);
  const [optionIndices, setOptionIndices] = useState<number[]>([]);
  const { playSound } = useSound();
  useEffect(() => {
    if (!urlGameId) {
      toast.error("No game ID found. Returning to home page.");
      navigate('/');
      return;
    }
    // Case 1: Player has a session for this game -> Reconnect
    if (playerId && sessionGameId === urlGameId) {
      setView('GAME');
    }
    // Case 2: Player has a session for a *different* game -> Clear old session
    else if (playerId && sessionGameId && sessionGameId !== urlGameId) {
      clearSession();
      setView('NICKNAME');
    }
    // Case 3: New player or cleared session
    else {
      setView('NICKNAME');
    }
  }, [urlGameId, sessionGameId, playerId, navigate, clearSession]);
  const { isLoading, error } = useGamePolling(urlGameId!, view === 'GAME' && !!urlGameId);
  const currentQuestionIndex = gameState?.currentQuestionIndex;
  const questionOptionsCount = gameState?.questions[currentQuestionIndex ?? -1]?.options.length;
  useEffect(() => {
    if (gameState?.phase === 'QUESTION' && questionOptionsCount) {
      setSubmittedAnswer(null);
      setAnswerResult(null);
      const initialIndices = Array.from({ length: questionOptionsCount }, (_, i) => i);
      setOptionIndices(initialIndices);
    }
  }, [gameState?.phase, currentQuestionIndex, questionOptionsCount]);
  useEffect(() => {
    if (gameState?.phase === 'REVEAL' && submittedAnswer !== null) {
      const myAnswer = gameState.answers.find(a => a.playerId === playerId);
      if (myAnswer && !answerResult) {
        const result = { isCorrect: myAnswer.isCorrect, score: myAnswer.score };
        setAnswerResult(result);
        playSound(result.isCorrect ? 'correct' : 'incorrect');
      }
    }
  }, [gameState?.phase, gameState?.answers, playerId, submittedAnswer, playSound, answerResult]);
  const handleJoin = async (name: string) => {
    if (!name.trim() || !urlGameId) return;
    setIsJoining(true);
    const newPlayerId = crypto.randomUUID();
    try {
      const res = await fetch(`/api/games/${urlGameId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, playerId: newPlayerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      setSession({ gameId: urlGameId, playerId: newPlayerId, nickname: name });
      setGameState(data.data);
      setView('GAME');
      toast.success(`Welcome, ${name}!`);
      playSound('join');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsJoining(false);
    }
  };
  const handleAnswer = async (answerIndex: number) => {
    if (submittedAnswer !== null || !playerId || !urlGameId) return;
    setSubmittedAnswer(answerIndex);
    try {
      await fetch(`/api/games/${urlGameId}/answer`, {
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
  if (view === 'LOADING') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-800">
        <Loader2 className="h-16 w-16 animate-spin text-white" />
      </div>
    );
  }
  if (view === 'NICKNAME') {
    return (
      <>
        <PlayerNicknameForm onJoin={handleJoin} isLoading={isJoining} />
        <Toaster richColors />
      </>
    );
  }
  const me = gameState?.players.find(p => p.id === playerId);
  const renderGameContent = () => {
    if (isLoading && !gameState) return <Loader2 className="h-16 w-16 animate-spin text-white" />;
    if (error) return <div className="text-red-300">{error}</div>;
    if (!gameState) return <div>Waiting for game...</div>;
    if (gameState.phase === 'QUESTION' && optionIndices.length > 0) {
      return (
        <PlayerAnswerScreen
          onAnswer={handleAnswer}
          submittedAnswer={submittedAnswer}
          optionIndices={optionIndices}
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
          {renderGameContent()}
        </AnimatePresence>
      </main>
      <Toaster richColors theme="dark" />
    </div>
  );
}