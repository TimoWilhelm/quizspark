import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface LeaderboardEntry {
	id: string;
	name: string;
	score: number;
	rank: number;
}

function PodiumPlace({ player, rank }: { player: LeaderboardEntry; rank: number }) {
	const height = rank === 1 ? 'h-64' : rank === 2 ? 'h-48' : 'h-32';
	const color = rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-gray-400' : 'bg-yellow-600';
	const delay = rank === 1 ? 0.4 : rank === 2 ? 0.2 : 0.6;
	return (
		<motion.div
			className="text-center flex flex-col items-center"
			initial={{ opacity: 0, y: 100 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ type: 'spring', stiffness: 100, delay }}
		>
			<p className="text-2xl sm:text-4xl font-bold">{player.name}</p>
			<p className="text-lg sm:text-2xl">{player.score}</p>
			<div
				className={`${height} w-32 sm:w-48 ${color} rounded-t-lg flex items-center justify-center text-5xl sm:text-6xl font-bold text-white shadow-lg`}
			>
				{rank}
			</div>
		</motion.div>
	);
}

interface HostEndProps {
	leaderboard: LeaderboardEntry[];
}

export function HostEnd({ leaderboard }: HostEndProps) {
	const top3 = leaderboard.slice(0, 3);
	// Reorder for visual podium: 2nd, 1st, 3rd
	const podiumOrder = [top3[1], top3[0], top3[2]];
	return (
		<div className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 space-y-8">
			<motion.h1 initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="text-5xl sm:text-7xl font-bold">
				Final Podium
			</motion.h1>
			<div className="flex items-end gap-2 sm:gap-4">
				{podiumOrder[0] && <PodiumPlace player={podiumOrder[0]} rank={2} />}
				{podiumOrder[1] && <PodiumPlace player={podiumOrder[1]} rank={1} />}
				{podiumOrder[2] && <PodiumPlace player={podiumOrder[2]} rank={3} />}
			</div>
			<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
				<Button
					onClick={() => (window.location.href = '/')}
					size="lg"
					className="bg-quiz-orange text-white text-2xl font-bold px-12 py-8 rounded-2xl"
				>
					Play Again
				</Button>
			</motion.div>
		</div>
	);
}
