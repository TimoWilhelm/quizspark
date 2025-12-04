import React, { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGameStore } from '@/lib/game-store';
import { Loader2, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { HostLobby } from '@/components/game/host/HostLobby';
import { HostQuestion } from '@/components/game/host/HostQuestion';
import { HostReveal } from '@/components/game/host/HostReveal';
import { HostLeaderboard } from '@/components/game/host/HostLeaderboard';
import { HostEnd } from '@/components/game/host/HostEnd';
import { useHostGamePolling } from '@/hooks/useHostGamePolling';
import { Button } from '@/components/ui/button';
export function HostPage() {
	const { gameId } = useParams<{ gameId: string }>();
	const { isLoading, error } = useHostGamePolling(gameId!);
	const gameState = useGameStore((s) => s.gameState);
	const handleNext = useCallback(async () => {
		try {
			const res = await fetch(`/api/games/${gameId}/next`, { method: 'POST' });
			if (!res.ok) throw new Error('Failed to advance game state');
		} catch (err) {
			toast.error('Could not proceed to the next step.');
		}
	}, [gameId]);
	const handleStart = useCallback(async () => {
		try {
			const res = await fetch(`/api/games/${gameId}/start`, { method: 'POST' });
			if (!res.ok) throw new Error('Failed to start game');
		} catch (err) {
			toast.error('Could not start the game.');
		}
	}, [gameId]);
	if (isLoading && !gameState) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center bg-slate-100">
				<Loader2 className="h-16 w-16 animate-spin text-quiz-blue" />
			</div>
		);
	}
	if (error) {
		return (
			<div className="min-h-screen w-full flex flex-col items-center justify-center bg-red-100 text-red-800 p-4">
				<ShieldAlert className="h-16 w-16 mb-4" />
				<h1 className="text-3xl font-bold mb-2">Access Denied</h1>
				<p className="text-center mb-6">{error}</p>
				<Button asChild>
					<Link to="/">Return to Home</Link>
				</Button>
			</div>
		);
	}
	if (!gameState) {
		return <div className="min-h-screen w-full flex items-center justify-center bg-slate-100">Game not found.</div>;
	}
	const renderContent = () => {
		switch (gameState.phase) {
			case 'LOBBY':
				return <HostLobby onStart={handleStart} />;
			case 'QUESTION':
				return <HostQuestion onNext={handleNext} />;
			case 'REVEAL':
				return <HostReveal onNext={handleNext} />;
			case 'LEADERBOARD':
				return <HostLeaderboard onNext={handleNext} />;
			case 'END':
				return <HostEnd />;
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
