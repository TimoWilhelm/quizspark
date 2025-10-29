import { useGameStore } from '@/lib/game-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
export function HostLeaderboard({ onNext }: { onNext: () => void }) {
  const players = useGameStore(s => s.gameState?.players);
  const isLastQuestion = useGameStore(s => s.gameState ? s.gameState.currentQuestionIndex === s.gameState.questions.length - 1 : false);
  const top5 = players?.slice(0, 5) || [];
  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 space-y-8">
      <motion.h1 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl sm:text-6xl font-bold flex items-center gap-4"
      >
        <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-quiz-yellow" /> Leaderboard
      </motion.h1>
      <Card className="w-full max-w-2xl shadow-lg rounded-2xl">
        <CardContent className="p-0">
          <ul className="divide-y">
            {top5.map((player, i) => (
              <motion.li 
                key={player.id} 
                className="flex items-center justify-between p-4 text-xl sm:text-2xl font-bold"
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <span className="flex items-center">
                  <span className="w-10 text-center">
                    {i < 3 ? <Crown className={`w-8 h-8 mr-4 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : 'text-yellow-600'}`} /> : <span className="text-2xl font-bold mr-4">{i+1}</span>}
                  </span>
                  {player.name}
                </span>
                <span>{player.score}</span>
              </motion.li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        <Button onClick={onNext} size="lg" className="bg-quiz-blue text-white text-2xl font-bold px-12 py-8 rounded-2xl">
          {isLastQuestion ? 'Final Results' : 'Next Question'}
        </Button>
      </motion.div>
    </div>
  );
}