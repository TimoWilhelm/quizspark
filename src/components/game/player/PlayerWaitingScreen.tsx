import { CheckCircle, XCircle, Loader2, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import type { GamePhase } from '@shared/types';
import { useGameStore } from '@/lib/game-store';
interface PlayerWaitingScreenProps {
  phase: GamePhase;
  answerResult: { isCorrect: boolean; score: number } | null;
  finalScore?: number;
  playerId: string | null;
}
export function PlayerWaitingScreen({ phase, answerResult, finalScore, playerId }: PlayerWaitingScreenProps) {
  const players = useGameStore(s => s.gameState?.players) || [];
  const renderContent = () => {
    switch (phase) {
      case 'LOBBY':
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold">You're in!</h2>
            <p>See your name on the big screen.</p>
          </div>
        );
      case 'REVEAL':
        if (answerResult) {
          return (
            <div className={`flex flex-col items-center justify-center text-center ${answerResult.isCorrect ? 'text-green-300' : 'text-red-300'}`}>
              {answerResult.isCorrect ? <CheckCircle className="w-24 h-24" /> : <XCircle className="w-24 h-24" />}
              <h2 className="text-5xl font-bold mt-4">{answerResult.isCorrect ? 'Correct!' : 'Incorrect'}</h2>
              <p className="text-3xl">+ {answerResult.score} points</p>
            </div>
          );
        }
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold">Get ready...</h2>
            <p>Look at the main screen.</p>
          </div>
        );
      case 'LEADERBOARD': {
        const myRank = players.findIndex(p => p.id === playerId) + 1;
        const top3 = players.slice(0, 3);
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">Current Standings</h2>
            {myRank > 0 && (
              <p className="text-2xl mb-6">You are in <span className="font-bold text-quiz-yellow">#{myRank}</span> place!</p>
            )}
            <ul className="space-y-2 text-lg">
              {top3.map((player, i) => (
                <li key={player.id} className="flex justify-between w-64 mx-auto">
                  <span><Trophy className={`inline w-5 h-5 mr-2 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : 'text-yellow-600'}`} />{player.name}</span>
                  <span>{player.score}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      }
      case 'END':
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold">Game Over!</h2>
            <p className="text-2xl">Your final score: {finalScore}</p>
          </div>
        );
      default:
        return (
          <div className="text-center flex flex-col items-center">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <h2 className="text-4xl font-bold">Waiting...</h2>
          </div>
        );
    }
  };
  return (
    <motion.div
      key={phase + (answerResult ? 'result' : '')}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="w-full h-full flex items-center justify-center"
    >
      {renderContent()}
    </motion.div>
  );
}