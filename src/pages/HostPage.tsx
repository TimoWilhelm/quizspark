import { Link, useParams } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { HostLobby } from '@/components/game/host/HostLobby';
import { HostQuestion } from '@/components/game/host/HostQuestion';
import { HostReveal } from '@/components/game/host/HostReveal';
import { HostLeaderboard } from '@/components/game/host/HostLeaderboard';
import { HostEnd } from '@/components/game/host/HostEnd';
import { useGameWebSocket } from '@/hooks/useGameWebSocket';
import { useHostStore } from '@/lib/host-store';
import { Button } from '@/components/ui/button';

export function HostPage() {
	const { gameId } = useParams<{ gameId: string }>();
	const getSecret = useHostStore((s) => s.getSecret);
	const hostSecret = getSecret(gameId!);

	const { isConnecting, isConnected, error, gameState, startGame, nextState } = useGameWebSocket({
		gameId: gameId!,
		role: 'host',
		hostSecret,
		onError: (msg) => toast.error(msg),
	});

	if (isConnecting && !isConnected) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center bg-slate-100">
				<Loader2 className="h-16 w-16 animate-spin text-quiz-orange" />
			</div>
		);
	}

	if (error && !isConnected) {
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

	const renderContent = () => {
		switch (gameState.phase) {
			case 'LOBBY':
				return <HostLobby onStart={startGame} players={gameState.players} gameId={gameState.gameId} />;
			case 'QUESTION':
				return (
					<HostQuestion
						onNext={nextState}
						questionText={gameState.questionText}
						options={gameState.options}
						questionIndex={gameState.questionIndex}
						totalQuestions={gameState.totalQuestions}
						startTime={gameState.startTime}
						timeLimitMs={gameState.timeLimitMs}
						answeredCount={gameState.answeredCount}
						totalPlayers={gameState.players.length}
						isDoublePoints={gameState.isDoublePoints}
					/>
				);
			case 'REVEAL':
				return (
					<HostReveal
						onNext={nextState}
						questionText={gameState.questionText}
						options={gameState.options}
						correctAnswerIndex={gameState.correctAnswerIndex!}
						answerCounts={gameState.answerCounts}
					/>
				);
			case 'LEADERBOARD':
				return <HostLeaderboard onNext={nextState} leaderboard={gameState.leaderboard} isLastQuestion={gameState.isLastQuestion} />;
			case 'END':
				return <HostEnd leaderboard={gameState.leaderboard} />;
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
