import { useEffect, useRef, useCallback, useState } from 'react';
import type { ClientMessage, ServerMessage, ClientRole, GamePhase } from '@shared/types';

// Game state derived from WebSocket messages
export interface WebSocketGameState {
	phase: GamePhase;
	gameId: string;
	pin: string;
	players: { id: string; name: string }[];
	// Question phase
	questionIndex: number;
	totalQuestions: number;
	questionText: string;
	options: string[];
	startTime: number;
	timeLimitMs: number;
	// Answer tracking (for host)
	answeredCount: number;
	// Reveal phase
	correctAnswerIndex: number | null;
	playerResult: { isCorrect: boolean; score: number; answerIndex: number } | null;
	answerCounts: number[];
	// Leaderboard
	leaderboard: { id: string; name: string; score: number; rank: number }[];
	isLastQuestion: boolean;
}

interface UseGameWebSocketOptions {
	gameId: string;
	role: ClientRole;
	hostSecret?: string;
	playerId?: string;
	onError?: (message: string) => void;
	onConnected?: (playerId?: string) => void;
	onPlayerJoined?: (player: { id: string; name: string }) => void;
}

const initialGameState: WebSocketGameState = {
	phase: 'LOBBY',
	gameId: '',
	pin: '',
	players: [],
	questionIndex: 0,
	totalQuestions: 0,
	questionText: '',
	options: [],
	startTime: 0,
	timeLimitMs: 20000,
	answeredCount: 0,
	correctAnswerIndex: null,
	playerResult: null,
	answerCounts: [],
	leaderboard: [],
	isLastQuestion: false,
};

export function useGameWebSocket({ gameId, role, hostSecret, playerId, onError, onConnected, onPlayerJoined }: UseGameWebSocketOptions) {
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [gameState, setGameState] = useState<WebSocketGameState>(initialGameState);
	const [submittedAnswer, setSubmittedAnswer] = useState<number | null>(null);

	const handleMessage = useCallback(
		(event: MessageEvent) => {
			try {
				const message = JSON.parse(event.data) as ServerMessage;

				switch (message.type) {
					case 'connected':
						setIsConnected(true);
						setIsConnecting(false);
						setError(null);
						onConnected?.(message.playerId);
						break;

					case 'error':
						setError(message.message);
						onError?.(message.message);
						break;

					case 'lobbyUpdate':
						setGameState((prev) => ({
							...prev,
							phase: 'LOBBY',
							gameId: message.gameId,
							pin: message.pin,
							players: message.players,
						}));
						break;

					case 'playerJoined':
						setGameState((prev) => ({
							...prev,
							players: [...prev.players, message.player],
						}));
						onPlayerJoined?.(message.player);
						break;

					case 'questionStart':
						setSubmittedAnswer(null);
						setGameState((prev) => ({
							...prev,
							phase: 'QUESTION',
							questionIndex: message.questionIndex,
							totalQuestions: message.totalQuestions,
							questionText: message.questionText,
							options: message.options,
							startTime: message.startTime,
							timeLimitMs: message.timeLimitMs,
							answeredCount: 0,
							correctAnswerIndex: null,
							playerResult: null,
							answerCounts: [],
						}));
						break;

					case 'answerReceived':
						setSubmittedAnswer(message.answerIndex);
						break;

					case 'playerAnswered':
						setGameState((prev) => ({
							...prev,
							answeredCount: message.answeredCount,
						}));
						break;

					case 'reveal':
						setGameState((prev) => ({
							...prev,
							phase: 'REVEAL',
							correctAnswerIndex: message.correctAnswerIndex,
							playerResult: message.playerResult ?? null,
							answerCounts: message.answerCounts,
						}));
						break;

					case 'leaderboard':
						setGameState((prev) => ({
							...prev,
							phase: 'LEADERBOARD',
							leaderboard: message.leaderboard,
							isLastQuestion: message.isLastQuestion,
						}));
						break;

					case 'gameEnd':
						setGameState((prev) => ({
							...prev,
							phase: 'END',
							leaderboard: message.finalLeaderboard,
						}));
						break;

					case 'kicked':
						setError(message.reason);
						wsRef.current?.close();
						break;
				}
			} catch (err) {
				console.error('Failed to parse WebSocket message:', err);
			}
		},
		[onConnected, onError, onPlayerJoined],
	);

	const connect = useCallback(() => {
		// Prevent duplicate connections - check both OPEN and CONNECTING states
		if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

		setIsConnecting(true);
		setError(null);

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/api/games/${gameId}/ws`;

		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onopen = () => {
			// Send connect message for authentication
			const connectMsg: ClientMessage =
				role === 'host'
					? { type: 'connect', role: 'host', gameId, hostSecret: hostSecret! }
					: { type: 'connect', role: 'player', gameId, playerId };

			ws.send(JSON.stringify(connectMsg));
		};

		ws.onmessage = handleMessage;

		ws.onclose = (event) => {
			setIsConnected(false);

			// Attempt reconnection for unexpected closures
			if (event.code !== 1000 && event.code < 4000) {
				// Keep isConnecting true to show loading state during reconnect delay
				setIsConnecting(true);
				setError(null);
				reconnectTimeoutRef.current = setTimeout(() => {
					connect();
				}, 2000);
			} else {
				setIsConnecting(false);
			}
		};

		ws.onerror = () => {
			// Don't set isConnecting here - onclose will handle state management
			// and will decide whether to show loading (reconnecting) or error
			setError('WebSocket connection error');
		};
	}, [gameId, role, hostSecret, playerId, handleMessage]);

	// Store connect in a ref to avoid effect re-running on connect changes
	const connectRef = useRef(connect);
	connectRef.current = connect;

	// Connect on mount - use empty deps to run only once
	useEffect(() => {
		connectRef.current();

		return () => {
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (wsRef.current) {
				wsRef.current.close(1000, 'Component unmounted');
			}
		};
	}, [gameId]);

	// Send message helper
	const sendMessage = useCallback((message: ClientMessage) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(message));
		}
	}, []);

	// Player actions
	const join = useCallback(
		(nickname: string) => {
			sendMessage({ type: 'join', nickname });
		},
		[sendMessage],
	);

	const submitAnswer = useCallback(
		(answerIndex: number) => {
			if (submittedAnswer !== null) return; // Prevent double submission
			sendMessage({ type: 'submitAnswer', answerIndex });
		},
		[sendMessage, submittedAnswer],
	);

	// Host actions
	const startGame = useCallback(() => {
		sendMessage({ type: 'startGame' });
	}, [sendMessage]);

	const nextState = useCallback(() => {
		sendMessage({ type: 'nextState' });
	}, [sendMessage]);

	return {
		isConnected,
		isConnecting,
		error,
		gameState,
		submittedAnswer,
		// Player actions
		join,
		submitAnswer,
		// Host actions
		startGame,
		nextState,
	};
}
