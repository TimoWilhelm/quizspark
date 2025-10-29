import { useParams } from 'react-router-dom';
import { useGamePolling } from '@/hooks/useGamePolling';
import { useGameStore } from '@/lib/game-store';
import { QRCode } from '@/components/game/QRCode';
import { BarChart, Crown, Loader2, Users, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
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
export function HostPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { isLoading, error } = useGamePolling(gameId!);
  const gameState = useGameStore(s => s.gameState);
  const handleNext = async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/next`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to advance game state');
    } catch (err) {
      toast.error('Could not proceed to the next step.');
    }
  };
  const handleStart = async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/start`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start game');
    } catch (err) {
      toast.error('Could not start the game.');
    }
  };
  if (isLoading && !gameState) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100">
        <Loader2 className="h-16 w-16 animate-spin text-quiz-blue" />
      </div>
    );
  }
  if (error) {
    return <div className="min-h-screen w-full flex items-center justify-center bg-red-100 text-red-700">{error}</div>;
  }
  if (!gameState) {
    return <div className="min-h-screen w-full flex items-center justify-center bg-slate-100">Game not found.</div>;
  }
  const renderContent = () => {
    switch (gameState.phase) {
      case 'LOBBY':
        return <Lobby onStart={handleStart} />;
      case 'QUESTION':
        return <QuestionView onNext={handleNext} />;
      case 'REVEAL':
        return <RevealView onNext={handleNext} />;
      case 'LEADERBOARD':
        return <LeaderboardView onNext={handleNext} />;
      case 'END':
        return <EndView />;
      default:
        return <div>Unknown game phase.</div>;
    }
  };
  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 flex flex-col">
      <AnimatePresence mode="wait">
        <motion.main
          key={gameState.phase}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-grow flex flex-col"
        >
          {renderContent()}
        </motion.main>
      </AnimatePresence>
      <Toaster richColors />
    </div>
  );
}
function Lobby({ onStart }: { onStart: () => void }) {
  const { pin, players } = useGameStore(s => ({ pin: s.gameState?.pin, players: s.gameState?.players }));
  const joinUrl = `${window.location.origin}/join`;
  return (
    <div className="flex-grow flex flex-col items-center justify-center p-8 space-y-8">
      <h1 className="text-4xl font-bold">Join the Game!</h1>
      <div className="flex flex-col md:flex-row items-center gap-8">
        <Card className="p-6 text-center shadow-lg">
          <CardHeader>
            <CardTitle>Scan to Join</CardTitle>
          </CardHeader>
          <CardContent>
            <QRCode value={joinUrl} />
            <p className="mt-4 text-muted-foreground">{joinUrl}</p>
          </CardContent>
        </Card>
        <div className="text-center">
          <p className="text-2xl">Game PIN:</p>
          <p className="text-8xl font-bold tracking-widest text-quiz-blue">{pin}</p>
        </div>
      </div>
      <div className="w-full max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users /> Players ({players?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 p-4 min-h-[60px]">
            {players?.map(p => (
              <motion.div key={p.id} initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-quiz-pink text-white font-bold py-2 px-4 rounded-lg shadow">
                {p.name}
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Button onClick={onStart} size="lg" className="bg-quiz-blue text-white text-2xl font-bold px-12 py-8 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-transform" disabled={(players?.length || 0) < 1}>
        Start Game
      </Button>
    </div>
  );
}
function QuestionView({ onNext }: { onNext: () => void }) {
  const { question, index, total, startTime } = useGameStore(s => ({
    question: s.gameState?.questions[s.gameState.currentQuestionIndex],
    index: s.gameState?.currentQuestionIndex,
    total: s.gameState?.questions.length,
    startTime: s.gameState?.questionStartTime,
  }));
  const [timeLeft, setTimeLeft] = React.useState(20);
  React.useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = (Date.now() - (startTime || 0)) / 1000;
      const remaining = Math.max(0, 20 - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        clearInterval(timer);
        onNext();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [startTime, onNext]);
  if (!question) return null;
  return (
    <div className="flex-grow flex flex-col p-8">
      <div className="flex justify-between items-center mb-4">
        <span className="text-2xl font-bold">Question {index! + 1}/{total}</span>
        <div className="text-5xl font-bold bg-white rounded-full w-24 h-24 flex items-center justify-center shadow-lg">{timeLeft}</div>
      </div>
      <div className="flex-grow center bg-white rounded-2xl shadow-lg p-8 mb-8">
        <h2 className="text-5xl font-bold text-center">{question.text}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {question.options.map((option, i) => (
          <div key={i} className={`flex items-center p-6 rounded-2xl text-white font-bold text-3xl shadow-md ${shapeColors[i]}`}>
            <svg viewBox="0 0 24 24" className="w-12 h-12 mr-4 fill-current"><path d={shapePaths[i]} /></svg>
            {option}
          </div>
        ))}
      </div>
    </div>
  );
}
function RevealView({ onNext }: { onNext: () => void }) {
  const { question, answers, players } = useGameStore(s => ({
    question: s.gameState?.questions[s.gameState.currentQuestionIndex],
    answers: s.gameState?.answers,
    players: s.gameState?.players,
  }));
  if (!question || !answers || !players) return null;
  const answerCounts = question.options.map((_, i) => answers.filter(a => a.answerIndex === i).length);
  const totalAnswers = answers.length;
  return (
    <div className="flex-grow flex flex-col items-center justify-center p-8 space-y-8">
      <h2 className="text-5xl font-bold text-center mb-4">{question.text}</h2>
      <div className="w-full max-w-4xl space-y-4">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correctAnswerIndex;
          const count = answerCounts[i];
          const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
          return (
            <div key={i} className={`p-4 rounded-lg shadow-md ${isCorrect ? 'bg-green-200 border-4 border-green-500' : 'bg-white'}`}>
              <div className="flex justify-between items-center font-bold text-2xl">
                <span>{option}</span>
                <span>{count}</span>
              </div>
              <Progress value={percentage} className="mt-2 h-4" />
            </div>
          );
        })}
      </div>
      <Button onClick={onNext} size="lg" className="bg-quiz-blue text-white text-2xl font-bold px-12 py-8 rounded-2xl">Next</Button>
    </div>
  );
}
function LeaderboardView({ onNext }: { onNext: () => void }) {
  const { players, isLastQuestion } = useGameStore(s => ({
    players: s.gameState?.players,
    isLastQuestion: s.gameState ? s.gameState.currentQuestionIndex === s.gameState.questions.length - 1 : false,
  }));
  const top5 = players?.slice(0, 5) || [];
  return (
    <div className="flex-grow flex flex-col items-center justify-center p-8 space-y-8">
      <h1 className="text-6xl font-bold flex items-center gap-4"><Trophy className="w-16 h-16 text-quiz-yellow" /> Leaderboard</h1>
      <Card className="w-full max-w-2xl shadow-lg">
        <CardContent className="p-0">
          <ul className="divide-y">
            {top5.map((player, i) => (
              <li key={player.id} className="flex items-center justify-between p-4 text-2xl font-bold">
                <span className="flex items-center">
                  {i < 3 && <Crown className={`w-8 h-8 mr-4 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : 'text-yellow-600'}`} />}
                  {player.name}
                </span>
                <span>{player.score}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Button onClick={onNext} size="lg" className="bg-quiz-blue text-white text-2xl font-bold px-12 py-8 rounded-2xl">
        {isLastQuestion ? 'Final Results' : 'Next Question'}
      </Button>
    </div>
  );
}
function EndView() {
  const players = useGameStore(s => s.gameState?.players);
  const top3 = players?.slice(0, 3) || [];
  return (
    <div className="flex-grow flex flex-col items-center justify-center p-8 space-y-8">
      <h1 className="text-7xl font-bold">Final Podium</h1>
      <div className="flex items-end gap-4">
        {top3[1] && <PodiumPlace player={top3[1]} rank={2} />}
        {top3[0] && <PodiumPlace player={top3[0]} rank={1} />}
        {top3[2] && <PodiumPlace player={top3[2]} rank={3} />}
      </div>
      <Button onClick={() => window.location.href = '/'} size="lg" className="bg-quiz-blue text-white text-2xl font-bold px-12 py-8 rounded-2xl">
        Play Again
      </Button>
    </div>
  );
}
function PodiumPlace({ player, rank }: { player: any, rank: number }) {
  const height = rank === 1 ? 'h-64' : rank === 2 ? 'h-48' : 'h-32';
  const color = rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-gray-400' : 'bg-yellow-600';
  return (
    <div className="text-center">
      <p className="text-4xl font-bold">{player.name}</p>
      <p className="text-2xl">{player.score}</p>
      <div className={`${height} w-48 ${color} rounded-t-lg flex items-center justify-center text-6xl font-bold text-white`}>
        {rank}
      </div>
    </div>
  );
}