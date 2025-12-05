import { CheckCircle, XCircle, Loader2, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import type { GamePhase } from '@shared/types';

interface LeaderboardEntry {
	id: string;
	name: string;
	score: number;
	rank: number;
}

interface PlayerWaitingScreenProps {
	phase: GamePhase;
	answerResult: { isCorrect: boolean; score: number } | null;
	finalScore?: number;
	playerId: string | null;
	leaderboard?: LeaderboardEntry[];
}

// Confetti particle component
function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
	return (
		<motion.div
			className="absolute w-3 h-3 rounded-sm"
			style={{ backgroundColor: color, left: `${x}%` }}
			initial={{ y: -20, opacity: 1, rotate: 0, scale: 1 }}
			animate={{
				y: ['0vh', '100vh'],
				opacity: [1, 1, 0],
				rotate: [0, 360, 720],
				x: [0, Math.random() * 40 - 20],
			}}
			transition={{
				duration: 3 + Math.random() * 2,
				delay,
				ease: 'easeOut',
			}}
		/>
	);
}

// Celebration confetti animation
function CelebrationConfetti() {
	const particles = useMemo(() => {
		const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
		return Array.from({ length: 50 }, (_, i) => ({
			id: i,
			delay: Math.random() * 0.5,
			x: Math.random() * 100,
			color: colors[Math.floor(Math.random() * colors.length)],
		}));
	}, []);

	return (
		<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
			{particles.map((p) => (
				<ConfettiParticle key={p.id} delay={p.delay} x={p.x} color={p.color} />
			))}
		</div>
	);
}

// Podium rank display component
function PodiumRankDisplay({ rank }: { rank: number }) {
	const config = {
		1: { color: 'text-yellow-400', label: '1st Place!', emoji: '🥇' },
		2: { color: 'text-gray-300', label: '2nd Place!', emoji: '🥈' },
		3: { color: 'text-amber-600', label: '3rd Place!', emoji: '🥉' },
	}[rank];

	if (!config) return null;

	return (
		<motion.div
			initial={{ scale: 0, rotate: -180 }}
			animate={{ scale: 1, rotate: 0 }}
			transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
			className="flex flex-col items-center"
		>
			<motion.span
				animate={{ scale: [1, 1.1, 1] }}
				transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
				className="text-8xl mb-4"
			>
				{config.emoji}
			</motion.span>
			<motion.h3
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.5 }}
				className={`text-4xl font-bold ${config.color}`}
			>
				{config.label}
			</motion.h3>
		</motion.div>
	);
}

export function PlayerWaitingScreen({ phase, answerResult, finalScore, playerId, leaderboard = [] }: PlayerWaitingScreenProps) {
	const [showConfetti, setShowConfetti] = useState(false);

	// Find player's final rank
	const myFinalEntry = leaderboard.find((p) => p.id === playerId);
	const myFinalRank = myFinalEntry?.rank ?? 0;
	const isOnPodium = myFinalRank >= 1 && myFinalRank <= 3;

	// Trigger confetti for podium finishes
	useEffect(() => {
		if (phase === 'END' && isOnPodium) {
			setShowConfetti(true);
			// Stop confetti after animation completes
			const timer = setTimeout(() => setShowConfetti(false), 5000);
			return () => clearTimeout(timer);
		}
	}, [phase, isOnPodium]);

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
						<div
							className={`flex flex-col items-center justify-center text-center ${answerResult.isCorrect ? 'text-green-300' : 'text-red-300'}`}
						>
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
				const myEntry = leaderboard.find((p) => p.id === playerId);
				const myRank = myEntry?.rank ?? 0;
				const top3 = leaderboard.slice(0, 3);
				return (
					<div className="text-center">
						<h2 className="text-4xl font-bold mb-4">Current Standings</h2>
						{myRank > 0 && (
							<p className="text-2xl mb-6">
								You are in <span className="font-bold text-quiz-yellow">#{myRank}</span> place!
							</p>
						)}
						<ul className="space-y-2 text-lg">
							{top3.map((player, i) => (
								<li key={player.id} className="flex justify-between w-64 mx-auto">
									<span>
										<Trophy
											className={`inline w-5 h-5 mr-2 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : 'text-yellow-600'}`}
										/>
										{player.name}
									</span>
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
						{showConfetti && <CelebrationConfetti />}
						<motion.h2
							initial={{ opacity: 0, y: -20 }}
							animate={{ opacity: 1, y: 0 }}
							className="text-4xl font-bold mb-6"
						>
							Game Over!
						</motion.h2>

						{isOnPodium ? (
							<PodiumRankDisplay rank={myFinalRank} />
						) : myFinalRank > 0 ? (
							<motion.div
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.2 }}
								className="mb-4"
							>
								<span className="text-5xl block mb-2">⭐</span>
								<span className="text-3xl font-bold text-indigo-300">#{myFinalRank}</span>
								<p className="text-xl text-slate-300 mt-2">Thanks for playing!</p>
							</motion.div>
						) : null}

						<motion.p
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.8 }}
							className="text-2xl mt-4"
						>
							Final score: <span className="font-bold text-quiz-yellow">{finalScore}</span>
						</motion.p>
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
