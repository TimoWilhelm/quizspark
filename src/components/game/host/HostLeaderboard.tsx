import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Trophy, ChevronUp, ChevronDown } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import type { LeaderboardEntry } from '@/hooks/useGameWebSocket';

interface HostLeaderboardProps {
	onNext: () => void;
	leaderboard: LeaderboardEntry[];
	isLastQuestion: boolean;
}

export function HostLeaderboard({ onNext, leaderboard, isLastQuestion }: HostLeaderboardProps) {
	const top5 = leaderboard.slice(0, 5);
	const [animationPhase, setAnimationPhase] = useState<'intro' | 'reorder' | 'done'>('intro');

	// Check if any player has rank changes to animate
	const hasRankChanges = useMemo(() => top5.some((p) => p.previousRank !== undefined && p.previousRank !== p.rank), [top5]);

	// Sort by previous rank for initial display, then switch to current rank
	const sortedPlayers = useMemo(() => {
		if (animationPhase === 'intro' && hasRankChanges) {
			// Sort by previous rank, new entries go to end
			return [...top5].sort((a, b) => {
				const aPrev = a.previousRank ?? 999;
				const bPrev = b.previousRank ?? 999;
				return aPrev - bPrev;
			});
		}
		return top5;
	}, [top5, animationPhase, hasRankChanges]);

	// Phase timing: intro -> reorder -> done
	useEffect(() => {
		// Wait for intro animation to complete (5 items * 150ms delay + 300ms animation)
		const introDelay = setTimeout(() => {
			if (hasRankChanges) {
				setAnimationPhase('reorder');
			} else {
				setAnimationPhase('done');
			}
		}, 1200);

		return () => clearTimeout(introDelay);
	}, [hasRankChanges]);

	// Mark reorder animation as done
	useEffect(() => {
		if (animationPhase === 'reorder') {
			const reorderDelay = setTimeout(() => {
				setAnimationPhase('done');
			}, 800);
			return () => clearTimeout(reorderDelay);
		}
	}, [animationPhase]);

	const getRankChangeIndicator = (player: LeaderboardEntry) => {
		if (player.previousRank === undefined) {
			// New entry to top-5
			return (
				<motion.span
					initial={{ opacity: 0, scale: 0 }}
					animate={{ opacity: 1, scale: 1 }}
					className="ml-2 text-sm bg-green-500 text-white px-1.5 py-0.5 rounded-full"
				>
					NEW
				</motion.span>
			);
		}

		const currentRank = player.rank;
		const diff = player.previousRank - currentRank;
		if (diff > 0) {
			// Moved up
			return (
				<motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="ml-2 flex items-center text-green-500">
					<ChevronUp className="w-5 h-5" />
					<span className="text-sm font-medium">{diff}</span>
				</motion.span>
			);
		} else if (diff < 0) {
			// Moved down
			return (
				<motion.span initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="ml-2 flex items-center text-red-500">
					<ChevronDown className="w-5 h-5" />
					<span className="text-sm font-medium">{Math.abs(diff)}</span>
				</motion.span>
			);
		}

		return null;
	};

	return (
		<div className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 space-y-8">
			<motion.h1
				initial={{ opacity: 0, y: -30 }}
				animate={{ opacity: 1, y: 0 }}
				className="text-5xl sm:text-6xl font-bold flex items-center gap-4"
			>
				<Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-quiz-gold" /> Leaderboard
			</motion.h1>
			<Card className="w-full max-w-2xl shadow-lg rounded-2xl overflow-hidden">
				<CardContent className="p-0">
					<LayoutGroup>
						<ul className="divide-y">
							<AnimatePresence mode="popLayout">
								{sortedPlayers.map((player, i) => {
									// Get the visual position for rank display
									const displayRank = player.rank;
									const isMovingUp = player.previousRank !== undefined && player.previousRank > displayRank;
									const isMovingDown = player.previousRank !== undefined && player.previousRank < displayRank;
									const isReordering = animationPhase === 'reorder';

									return (
										<motion.li
											key={player.id}
											layout
											className="flex items-center justify-between p-4 text-xl sm:text-2xl font-bold bg-card"
											initial={{ opacity: 0, x: -100 }}
											animate={{
												opacity: 1,
												x: 0,
												scale: isReordering && (isMovingUp || isMovingDown) ? [1, 1.02, 1] : 1,
											}}
											exit={{ opacity: 0, x: 100 }}
											transition={{
												layout: { type: 'spring', stiffness: 300, damping: 30 },
												opacity: { duration: 0.2 },
												x: { duration: 0.3, delay: i * 0.15 },
												scale: { duration: 0.5 },
											}}
										>
											<span className="flex items-center">
												<span className="w-10 text-center">
													{displayRank <= 3 ? (
														<Crown
															className={`w-8 h-8 mr-4 ${
																displayRank === 1 ? 'text-yellow-400' : displayRank === 2 ? 'text-gray-400' : 'text-yellow-600'
															}`}
														/>
													) : (
														<span className="text-2xl font-bold mr-4">{displayRank}</span>
													)}
												</span>
												{player.name}
												{animationPhase === 'done' && getRankChangeIndicator(player)}
											</span>
											<span>{player.score}</span>
										</motion.li>
									);
								})}
							</AnimatePresence>
						</ul>
					</LayoutGroup>
				</CardContent>
			</Card>
			<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
				<Button onClick={onNext} size="lg" className="bg-quiz-orange text-white text-2xl font-bold px-12 py-8 rounded-2xl">
					{isLastQuestion ? 'Final Results' : 'Next Question'}
				</Button>
			</motion.div>
		</div>
	);
}
