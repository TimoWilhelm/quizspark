import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '@/lib/game-store';
import { useGameWebSocket } from '@/hooks/useGameWebSocket';
import { Loader2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import { PlayerNicknameForm } from '@/components/game/player/PlayerNicknameForm';
import { PlayerAnswerScreen } from '@/components/game/player/PlayerAnswerScreen';
import { PlayerWaitingScreen } from '@/components/game/player/PlayerWaitingScreen';
import { useSound } from '@/hooks/useSound';

type View = 'LOADING' | 'NICKNAME' | 'GAME' | 'GAME_IN_PROGRESS';

export function PlayerPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const urlGameId = searchParams.get('gameId');

	// Zustand state for session persistence
	const sessionGameId = useGameStore((s) => s.gameId);
	const storedPlayerId = useGameStore((s) => s.playerId);
	const nickname = useGameStore((s) => s.nickname);
	const setSession = useGameStore((s) => s.setSession);
	const clearSession = useGameStore((s) => s.clearSession);

	const [view, setView] = useState<View>('LOADING');
	const [currentPlayerId, setCurrentPlayerId] = useState<string | undefined>(storedPlayerId ?? undefined);
	const [currentNickname, setCurrentNickname] = useState<string>(nickname ?? '');
	const pendingNicknameRef = useRef<string>(nickname ?? '');
	const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; score: number } | null>(null);
	const [totalScore, setTotalScore] = useState(0);
	const { playSound } = useSound();

	// Determine initial view
	useEffect(() => {
		if (!urlGameId) {
			toast.error('No game ID found. Returning to home page.');
			navigate('/');
			return;
		}

		// Case 1: Player has a session for this game -> Reconnect
		if (storedPlayerId && sessionGameId === urlGameId) {
			setCurrentPlayerId(storedPlayerId);
			setCurrentNickname(nickname ?? '');
			pendingNicknameRef.current = nickname ?? '';
			setView('GAME');
		}
		// Case 2: Player has a session for a *different* game -> Clear old session
		else if (storedPlayerId && sessionGameId && sessionGameId !== urlGameId) {
			clearSession();
			setCurrentPlayerId(undefined);
			setView('NICKNAME');
		}
		// Case 3: New player or cleared session
		else {
			setView('NICKNAME');
		}
	}, [urlGameId, sessionGameId, storedPlayerId, nickname, navigate, clearSession]);

	const handleConnected = useCallback(
		(playerId?: string) => {
			if (playerId && urlGameId) {
				setCurrentPlayerId(playerId);
				// Update session with server-assigned playerId
				// Use ref to get the latest nickname (avoids race condition with state)
				const nicknameToSave = pendingNicknameRef.current;
				if (nicknameToSave) {
					setSession({ gameId: urlGameId, playerId, nickname: nicknameToSave });
				}
				setView('GAME');
			} else if (!playerId && storedPlayerId) {
				// We tried to reconnect with a stored playerId but server didn't recognize us
				// Clear the invalid session - user will need to rejoin
				clearSession();
				setCurrentPlayerId(undefined);
				pendingNicknameRef.current = '';
				setCurrentNickname('');
				// Show nickname form (handleError will override to GAME_IN_PROGRESS if game started)
				setView('NICKNAME');
			}
		},
		[urlGameId, setSession, storedPlayerId, clearSession],
	);

	const handleError = useCallback(
		(msg: string) => {
			if (msg === 'Game has already started') {
				setView('GAME_IN_PROGRESS');
			} else {
				toast.error(msg);
			}
		},
		[],
	);

	const {
		isConnecting,
		isConnected,
		error,
		gameState,
		submittedAnswer,
		join,
		submitAnswer,
	} = useGameWebSocket({
		gameId: urlGameId!,
		role: 'player',
		playerId: currentPlayerId,
		onError: handleError,
		onConnected: handleConnected,
	});

	// Handle reveal results and update score immediately
	useEffect(() => {
		if (gameState.phase === 'REVEAL' && gameState.playerResult && !answerResult) {
			setAnswerResult({
				isCorrect: gameState.playerResult.isCorrect,
				score: gameState.playerResult.score,
			});
			// Update total score immediately when reveal comes in
			setTotalScore((prev) => prev + gameState.playerResult!.score);
			playSound(gameState.playerResult.isCorrect ? 'correct' : 'incorrect');
		}
	}, [gameState.phase, gameState.playerResult, answerResult, playSound]);

	// Sync total score with leaderboard when available (handles reconnection)
	useEffect(() => {
		if (gameState.leaderboard.length > 0 && currentPlayerId) {
			const myLeaderboardScore = gameState.leaderboard.find((p) => p.id === currentPlayerId)?.score;
			if (myLeaderboardScore !== undefined) {
				setTotalScore(myLeaderboardScore);
			}
		}
	}, [gameState.leaderboard, currentPlayerId]);

	// Reset answer result on new question
	useEffect(() => {
		if (gameState.phase === 'QUESTION') {
			setAnswerResult(null);
		}
	}, [gameState.phase, gameState.questionIndex]);

	const handleJoin = useCallback(
		(name: string) => {
			if (!name.trim() || !urlGameId) return;
			pendingNicknameRef.current = name; // Update ref immediately
			setCurrentNickname(name);
			join(name);
			toast.success(`Welcome, ${name}!`);
			playSound('join');
			// Session will be saved in handleConnected when server confirms with playerId
		},
		[urlGameId, join, playSound],
	);

	const handleAnswer = useCallback(
		(answerIndex: number) => {
			submitAnswer(answerIndex);
		},
		[submitAnswer],
	);

	if (view === 'LOADING' || (view === 'GAME' && isConnecting && !isConnected)) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center bg-slate-800">
				<Loader2 className="h-16 w-16 animate-spin text-white" />
			</div>
		);
	}

	if (view === 'NICKNAME') {
		return (
			<>
				<PlayerNicknameForm onJoin={handleJoin} isLoading={isConnecting} />
				<Toaster richColors />
			</>
		);
	}

	if (view === 'GAME_IN_PROGRESS') {
		return (
			<div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-800 text-white p-8">
				<div className="text-6xl mb-6">🎮</div>
				<h1 className="text-3xl font-bold mb-4 text-center">Game Already In Progress</h1>
				<p className="text-lg text-slate-300 text-center max-w-md mb-8">
					Sorry, this game has already started. You can wait for the next round or join a different game.
				</p>
				<button
					onClick={() => navigate('/')}
					className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors"
				>
					Back to Home
				</button>
			</div>
		);
	}

	// Use tracked total score (updates on reveal, syncs with leaderboard when available)
	const myScore = totalScore;

	const renderGameContent = () => {
		if (error && !isConnected) return <div className="text-red-300">{error}</div>;

		if (gameState.phase === 'QUESTION' && gameState.options.length > 0) {
			const optionIndices = Array.from({ length: gameState.options.length }, (_, i) => i);
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
				finalScore={myScore}
				playerId={currentPlayerId ?? null}
				leaderboard={gameState.leaderboard}
			/>
		);
	};

	return (
		<div className="min-h-screen w-full bg-slate-800 text-white flex flex-col p-4">
			<header className="flex justify-between items-center text-2xl font-bold">
				<span>{currentNickname}</span>
				<span>Score: {myScore}</span>
			</header>
			<main className="flex-grow flex items-center justify-center">
				<AnimatePresence mode="wait">{renderGameContent()}</AnimatePresence>
			</main>
			<Toaster richColors theme="dark" />
		</div>
	);
}
