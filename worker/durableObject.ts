import { DurableObject } from 'cloudflare:workers';
import type { GameState, Question, Player, Answer, QuizTopic, Quiz, ClientMessage, ServerMessage, ClientRole } from '@shared/types';
import { adjectives, colors, animals } from './words';
import { z } from 'zod';
import { wsClientMessageSchema, nicknameSchema, LIMITS } from '@shared/validation';

// WebSocket attachment data stored per connection
interface WebSocketAttachment {
	role: ClientRole;
	playerId?: string;
	authenticated: boolean;
}
const GENERAL_KNOWLEDGE_QUIZ: Question[] = [
	{
		text: 'What is the capital of France?',
		options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
		correctAnswerIndex: 2,
	},
	{
		text: 'Which planet is known as the Red Planet?',
		options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
		correctAnswerIndex: 1,
	},
	{
		text: 'What is the largest ocean on Earth?',
		options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
		correctAnswerIndex: 3,
	},
	{
		text: "Who wrote 'To Kill a Mockingbird'?",
		options: ['Harper Lee', 'J.K. Rowling', 'Ernest Hemingway', 'Mark Twain'],
		correctAnswerIndex: 0,
	},
];
const TECH_QUIZ: Question[] = [
	{
		text: "What does 'CPU' stand for?",
		options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Processor Unit', 'Control Processing Unit'],
		correctAnswerIndex: 0,
	},
	{
		text: 'Which company developed the JavaScript programming language?',
		options: ['Microsoft', 'Apple', 'Netscape', 'Sun Microsystems'],
		correctAnswerIndex: 2,
	},
	{
		text: 'What is the main function of a DNS server?',
		options: ['To store websites', 'To resolve domain names to IP addresses', 'To send emails', 'To secure network connections'],
		correctAnswerIndex: 1,
	},
];
const GEOGRAPHY_QUIZ: Question[] = [
	{
		text: 'What is the longest river in the world?',
		options: ['Amazon River', 'Nile River', 'Yangtze River', 'Mississippi River'],
		correctAnswerIndex: 1,
	},
	{
		text: 'Which desert is the largest in the world?',
		options: ['Sahara Desert', 'Arabian Desert', 'Gobi Desert', 'Antarctic Polar Desert'],
		correctAnswerIndex: 3,
	},
	{
		text: 'What is the capital of Australia?',
		options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'],
		correctAnswerIndex: 2,
	},
];
const QUIZZES: Record<string, Question[]> = {
	general: GENERAL_KNOWLEDGE_QUIZ,
	tech: TECH_QUIZ,
	geo: GEOGRAPHY_QUIZ,
};
export const QUIZ_TOPICS: QuizTopic[] = [
	{ id: 'general', title: 'General Knowledge', type: 'predefined' },
	{ id: 'tech', title: 'Tech Trivia', type: 'predefined' },
	{ id: 'geo', title: 'World Geography', type: 'predefined' },
];
const QUESTION_TIME_LIMIT_MS = 20000;

export class GlobalDurableObject extends DurableObject {
	// ============ WebSocket Hibernation API Methods ============

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Handle WebSocket upgrade requests
		if (url.pathname === '/websocket') {
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				return new Response('Expected WebSocket upgrade', { status: 426 });
			}

			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			// Accept the WebSocket with hibernation support
			this.ctx.acceptWebSocket(server);

			// Set initial attachment - not yet authenticated
			server.serializeAttachment({
				role: 'player',
				authenticated: false,
			} as WebSocketAttachment);

			return new Response(null, { status: 101, webSocket: client });
		}

		return new Response('Not Found', { status: 404 });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		try {
			const rawData = JSON.parse(message.toString());
			const parseResult = wsClientMessageSchema.safeParse(rawData);
			if (!parseResult.success) {
				this.sendMessage(ws, { type: 'error', message: z.prettifyError(parseResult.error) });
				return;
			}
			const data = parseResult.data as ClientMessage;
			const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;

			// Handle connection/authentication
			if (data.type === 'connect') {
				await this.handleConnect(ws, data);
				return;
			}

			// All other messages require authentication
			if (!attachment?.authenticated) {
				this.sendMessage(ws, { type: 'error', message: 'Not authenticated. Send connect message first.' });
				return;
			}

			// Route message based on type
			switch (data.type) {
				case 'join':
					await this.handleJoin(ws, attachment, data.nickname);
					break;
				case 'startGame':
					await this.handleStartGame(ws, attachment);
					break;
				case 'submitAnswer':
					await this.handleSubmitAnswer(ws, attachment, data.answerIndex);
					break;
				case 'nextState':
					await this.handleNextState(ws, attachment);
					break;
				default:
					this.sendMessage(ws, { type: 'error', message: 'Unknown message type' });
			}
		} catch (err) {
			console.error('WebSocket message error:', err);
			this.sendMessage(ws, { type: 'error', message: 'Invalid message format' });
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
		// Clean up on disconnect - the player remains in the game state for potential reconnection
		console.log(`WebSocket closed: code=${code}, reason=${reason}, wasClean=${wasClean}`);
	}

	async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
		console.error('WebSocket error:', error);
	}

	// ============ WebSocket Message Handlers ============

	private async handleConnect(ws: WebSocket, data: Extract<ClientMessage, { type: 'connect' }>): Promise<void> {
		const state = await this.getFullGameState();
		if (!state) {
			this.sendMessage(ws, { type: 'error', message: 'Game not found' });
			ws.close(4004, 'Game not found');
			return;
		}

		if (data.role === 'host') {
			// Verify host secret
			if (data.hostSecret !== state.hostSecret) {
				this.sendMessage(ws, { type: 'error', message: 'Invalid host secret' });
				ws.close(4003, 'Forbidden');
				return;
			}

			ws.serializeAttachment({
				role: 'host',
				authenticated: true,
			} as WebSocketAttachment);

			this.sendMessage(ws, { type: 'connected', role: 'host' });
			// Send current state based on phase
			await this.sendCurrentStateToHost(ws, state);
		} else {
			// Player connection
			let playerId = data.playerId;
			const existingPlayer = playerId ? state.players.find((p) => p.id === playerId) : null;

			// If reconnecting with valid playerId
			if (existingPlayer) {
				ws.serializeAttachment({
					role: 'player',
					playerId: playerId,
					authenticated: true,
				} as WebSocketAttachment);

				this.sendMessage(ws, { type: 'connected', role: 'player', playerId });
				await this.sendCurrentStateToPlayer(ws, state, playerId!);
			} else {
				// New player - needs to join
				ws.serializeAttachment({
					role: 'player',
					authenticated: true, // Authenticated but not yet joined
				} as WebSocketAttachment);

				this.sendMessage(ws, { type: 'connected', role: 'player' });

				// If game not in lobby, can't join
				if (state.phase !== 'LOBBY') {
					this.sendMessage(ws, { type: 'error', message: 'Game has already started' });
				}
			}
		}
	}

	private async handleJoin(ws: WebSocket, attachment: WebSocketAttachment, nickname: string): Promise<void> {
		if (attachment.role !== 'player') {
			this.sendMessage(ws, { type: 'error', message: 'Only players can join' });
			return;
		}

		if (attachment.playerId) {
			this.sendMessage(ws, { type: 'error', message: 'Already joined' });
			return;
		}

		// Validate nickname with Zod
		const nicknameResult = nicknameSchema.safeParse(nickname);
		if (!nicknameResult.success) {
			this.sendMessage(ws, { type: 'error', message: z.prettifyError(nicknameResult.error) });
			return;
		}
		const validatedNickname = nicknameResult.data;

		const state = await this.getFullGameState();
		if (!state || state.phase !== 'LOBBY') {
			this.sendMessage(ws, { type: 'error', message: 'Cannot join - game not in lobby' });
			return;
		}

		if (state.players.some((p) => p.name.toLowerCase() === validatedNickname.toLowerCase())) {
			this.sendMessage(ws, { type: 'error', message: 'Nickname already taken' });
			return;
		}

		const playerId = crypto.randomUUID();
		const newPlayer: Player = { id: playerId, name: validatedNickname, score: 0, answered: false };
		state.players.push(newPlayer);
		await this.ctx.storage.put('game_state', state);

		// Update WebSocket attachment with playerId
		ws.serializeAttachment({
			...attachment,
			playerId,
		} as WebSocketAttachment);

		// Send confirmation to the joining player
		this.sendMessage(ws, { type: 'connected', role: 'player', playerId });

		// Broadcast lobby update to all connected clients
		this.broadcastLobbyUpdate(state);
	}

	private async handleStartGame(ws: WebSocket, attachment: WebSocketAttachment): Promise<void> {
		if (attachment.role !== 'host') {
			this.sendMessage(ws, { type: 'error', message: 'Only host can start the game' });
			return;
		}

		const state = await this.getFullGameState();
		if (!state || state.phase !== 'LOBBY') {
			this.sendMessage(ws, { type: 'error', message: 'Game not in lobby phase' });
			return;
		}

		state.phase = 'QUESTION';
		state.questionStartTime = Date.now();
		await this.ctx.storage.put('game_state', state);

		// Broadcast question to all
		this.broadcastQuestionStart(state);
	}

	private async handleSubmitAnswer(ws: WebSocket, attachment: WebSocketAttachment, answerIndex: number): Promise<void> {
		if (attachment.role !== 'player' || !attachment.playerId) {
			this.sendMessage(ws, { type: 'error', message: 'Only players can submit answers' });
			return;
		}

		// Validate answer index
		if (typeof answerIndex !== 'number' || answerIndex < 0 || answerIndex >= LIMITS.OPTIONS_MAX) {
			this.sendMessage(ws, { type: 'error', message: 'Invalid answer index' });
			return;
		}

		const state = await this.getFullGameState();
		if (!state || state.phase !== 'QUESTION') {
			this.sendMessage(ws, { type: 'error', message: 'Not in question phase' });
			return;
		}

		const playerId = attachment.playerId;
		if (state.answers.some((a) => a.playerId === playerId)) {
			this.sendMessage(ws, { type: 'error', message: 'Already answered' });
			return;
		}

		const timeTaken = Date.now() - state.questionStartTime;
		if (timeTaken > QUESTION_TIME_LIMIT_MS) {
			this.sendMessage(ws, { type: 'error', message: 'Time is up' });
			return;
		}

		const answer: Answer = { playerId, answerIndex, time: timeTaken };
		state.answers.push(answer);
		await this.ctx.storage.put('game_state', state);

		// Confirm to player
		this.sendMessage(ws, { type: 'answerReceived', answerIndex });

		// Notify host of answer count
		this.broadcastToRole('host', {
			type: 'playerAnswered',
			playerId,
			answeredCount: state.answers.length,
			totalPlayers: state.players.length,
		});

		// Auto-advance to reveal if all players answered
		if (state.answers.length === state.players.length) {
			await this.advanceToReveal(state);
		}
	}

	private async handleNextState(ws: WebSocket, attachment: WebSocketAttachment): Promise<void> {
		if (attachment.role !== 'host') {
			this.sendMessage(ws, { type: 'error', message: 'Only host can advance state' });
			return;
		}

		const state = await this.getFullGameState();
		if (!state) {
			this.sendMessage(ws, { type: 'error', message: 'Game not found' });
			return;
		}

		switch (state.phase) {
			case 'QUESTION':
				await this.advanceToReveal(state);
				break;
			case 'REVEAL':
				state.phase = 'LEADERBOARD';
				state.players.sort((a, b) => b.score - a.score);
				await this.ctx.storage.put('game_state', state);
				this.broadcastLeaderboard(state);
				break;
			case 'LEADERBOARD':
				if (state.currentQuestionIndex < state.questions.length - 1) {
					state.currentQuestionIndex++;
					state.phase = 'QUESTION';
					state.questionStartTime = Date.now();
					state.answers = [];
					state.players.forEach((p) => (p.answered = false));
					await this.ctx.storage.put('game_state', state);
					this.broadcastQuestionStart(state);
				} else {
					state.phase = 'END';
					await this.ctx.storage.put('game_state', state);
					this.broadcastGameEnd(state);
				}
				break;
			default:
				this.sendMessage(ws, { type: 'error', message: 'Invalid state transition' });
		}
	}

	private async advanceToReveal(state: GameState): Promise<void> {
		const currentQuestion = state.questions[state.currentQuestionIndex];

		// Calculate scores
		state.answers.forEach((answer) => {
			const player = state.players.find((p) => p.id === answer.playerId);
			if (player) {
				const isCorrect = currentQuestion.correctAnswerIndex === answer.answerIndex;
				let score = 0;
				if (isCorrect) {
					const timeFactor = 1 - answer.time / (QUESTION_TIME_LIMIT_MS * 2);
					score = Math.floor(1000 * timeFactor);
				}
				player.score += score;
				answer.isCorrect = isCorrect;
				answer.score = score;
			}
		});

		state.phase = 'REVEAL';
		await this.ctx.storage.put('game_state', state);

		// Broadcast reveal with appropriate data for each role
		this.broadcastReveal(state);
	}

	// ============ Broadcast Helpers ============

	private sendMessage(ws: WebSocket, message: ServerMessage): void {
		try {
			ws.send(JSON.stringify(message));
		} catch (err) {
			console.error('Failed to send message:', err);
		}
	}

	private broadcastToAll(message: ServerMessage): void {
		const sockets = this.ctx.getWebSockets();
		for (const ws of sockets) {
			const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
			if (attachment?.authenticated) {
				this.sendMessage(ws, message);
			}
		}
	}

	private broadcastToRole(role: ClientRole, message: ServerMessage): void {
		const sockets = this.ctx.getWebSockets();
		for (const ws of sockets) {
			const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
			if (attachment?.authenticated && attachment.role === role) {
				this.sendMessage(ws, message);
			}
		}
	}

	private broadcastLobbyUpdate(state: GameState): void {
		this.broadcastToAll(this.buildLobbyMessage(state));
	}

	private broadcastQuestionStart(state: GameState): void {
		this.broadcastToAll(this.buildQuestionMessage(state));
	}

	private broadcastReveal(state: GameState): void {
		// Send to host (no player-specific result)
		this.broadcastToRole('host', this.buildRevealMessage(state));

		// Send to each player with their individual result
		const sockets = this.ctx.getWebSockets();
		for (const ws of sockets) {
			const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
			if (attachment?.authenticated && attachment.role === 'player' && attachment.playerId) {
				this.sendMessage(ws, this.buildRevealMessage(state, attachment.playerId));
			}
		}
	}

	private broadcastLeaderboard(state: GameState): void {
		this.broadcastToAll(this.buildLeaderboardMessage(state));
	}

	private broadcastGameEnd(state: GameState): void {
		this.broadcastToAll(this.buildGameEndMessage(state));
	}

	// ============ Shared State Builders ============

	private buildLeaderboard(state: GameState): { id: string; name: string; score: number; rank: number }[] {
		return [...state.players].sort((a, b) => b.score - a.score).map((p, i) => ({ id: p.id, name: p.name, score: p.score, rank: i + 1 }));
	}

	private buildLobbyMessage(state: GameState): ServerMessage {
		return {
			type: 'lobbyUpdate',
			players: state.players.map((p) => ({ id: p.id, name: p.name })),
			pin: state.pin,
			gameId: state.id,
		};
	}

	private buildQuestionMessage(state: GameState): ServerMessage {
		const question = state.questions[state.currentQuestionIndex];
		return {
			type: 'questionStart',
			questionIndex: state.currentQuestionIndex,
			totalQuestions: state.questions.length,
			questionText: question.text,
			options: question.options,
			startTime: state.questionStartTime,
			timeLimitMs: QUESTION_TIME_LIMIT_MS,
		};
	}

	private buildAnswerCounts(state: GameState): number[] {
		const question = state.questions[state.currentQuestionIndex];
		const answerCounts = new Array(question.options.length).fill(0);
		state.answers.forEach((a) => {
			if (a.answerIndex >= 0 && a.answerIndex < answerCounts.length) {
				answerCounts[a.answerIndex]++;
			}
		});
		return answerCounts;
	}

	private buildRevealMessage(state: GameState, playerId?: string): ServerMessage {
		const question = state.questions[state.currentQuestionIndex];
		const answerCounts = this.buildAnswerCounts(state);
		const playerAnswer = playerId ? state.answers.find((a) => a.playerId === playerId) : undefined;

		return {
			type: 'reveal',
			correctAnswerIndex: question.correctAnswerIndex,
			playerResult: playerAnswer
				? { isCorrect: playerAnswer.isCorrect ?? false, score: playerAnswer.score ?? 0, answerIndex: playerAnswer.answerIndex }
				: undefined,
			answerCounts,
		};
	}

	private buildLeaderboardMessage(state: GameState): ServerMessage {
		return {
			type: 'leaderboard',
			leaderboard: this.buildLeaderboard(state),
			isLastQuestion: state.currentQuestionIndex >= state.questions.length - 1,
		};
	}

	private buildGameEndMessage(state: GameState): ServerMessage {
		return { type: 'gameEnd', finalLeaderboard: this.buildLeaderboard(state) };
	}

	private async sendCurrentStateToHost(ws: WebSocket, state: GameState): Promise<void> {
		switch (state.phase) {
			case 'LOBBY':
				this.sendMessage(ws, this.buildLobbyMessage(state));
				break;
			case 'QUESTION':
				this.sendMessage(ws, this.buildQuestionMessage(state));
				break;
			case 'REVEAL':
				this.sendMessage(ws, this.buildRevealMessage(state));
				break;
			case 'LEADERBOARD':
				this.sendMessage(ws, this.buildLeaderboardMessage(state));
				break;
			case 'END':
				this.sendMessage(ws, this.buildGameEndMessage(state));
				break;
		}
	}

	private async sendCurrentStateToPlayer(ws: WebSocket, state: GameState, playerId: string): Promise<void> {
		switch (state.phase) {
			case 'LOBBY':
				this.sendMessage(ws, this.buildLobbyMessage(state));
				break;
			case 'QUESTION': {
				this.sendMessage(ws, this.buildQuestionMessage(state));
				// Check if player already answered
				const existingAnswer = state.answers.find((a) => a.playerId === playerId);
				if (existingAnswer) {
					this.sendMessage(ws, { type: 'answerReceived', answerIndex: existingAnswer.answerIndex });
				}
				break;
			}
			case 'REVEAL':
				this.sendMessage(ws, this.buildRevealMessage(state, playerId));
				break;
			case 'LEADERBOARD':
				this.sendMessage(ws, this.buildLeaderboardMessage(state));
				break;
			case 'END':
				this.sendMessage(ws, this.buildGameEndMessage(state));
				break;
		}
	}

	// ============ Original Game Logic Methods (kept for HTTP API compatibility) ============
	async createGame(quizId?: string): Promise<GameState | { error: string }> {
		let questions: Question[] | undefined;
		if (quizId) {
			const customQuiz = await this.getCustomQuizById(quizId);
			if (customQuiz) {
				questions = customQuiz.questions;
			} else {
				questions = QUIZZES[quizId];
			}
		}
		if (!questions) {
			questions = GENERAL_KNOWLEDGE_QUIZ;
		}
		if (questions.length === 0) {
			return { error: 'Cannot start a game with an empty quiz.' };
		}
		const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
		const color = colors[Math.floor(Math.random() * colors.length)];
		const animal = animals[Math.floor(Math.random() * animals.length)];
		const gameId = `${adj}-${color}-${animal}`.toLowerCase();
		const pin = Math.floor(100000 + Math.random() * 900000).toString();
		const newGame: GameState = {
			id: gameId,
			pin,
			phase: 'LOBBY',
			players: [],
			questions: questions,
			currentQuestionIndex: 0,
			questionStartTime: 0,
			answers: [],
			hostSecret: crypto.randomUUID(),
		};
		await this.ctx.storage.put('game_state', newGame);
		return newGame;
	}
	async getGameState(): Promise<GameState | null> {
		const state = await this.ctx.storage.get<GameState>('game_state');
		if (!state) return null;
		const publicState = { ...state };
		delete publicState.hostSecret;
		return publicState;
	}
	async getFullGameState(): Promise<GameState | null> {
		const state = await this.ctx.storage.get<GameState>('game_state');
		return state ?? null;
	}
	async addPlayer(name: string, playerId: string): Promise<GameState | { error: string }> {
		// Validate nickname
		const nicknameResult = nicknameSchema.safeParse(name);
		if (!nicknameResult.success) {
			return { error: z.prettifyError(nicknameResult.error) };
		}
		const validatedName = nicknameResult.data;

		const state = await this.getFullGameState();
		if (!state || state.phase !== 'LOBBY') {
			return { error: 'Game not in LOBBY phase or does not exist.' };
		}
		// Handle reconnection: if player already exists, just return the state
		if (state.players.some((p) => p.id === playerId)) {
			const gameState = await this.getGameState();
			if (!gameState) return { error: 'Game not found.' };
			return gameState;
		}
		if (state.players.some((p) => p.name.toLowerCase() === validatedName.toLowerCase())) {
			return { error: 'Player name already taken.' };
		}
		const newPlayer: Player = { id: playerId, name: validatedName, score: 0, answered: false };
		state.players.push(newPlayer);
		await this.ctx.storage.put('game_state', state);
		const gameState = await this.getGameState();
		if (!gameState) {
			return { error: 'Game not found.' };
		}
		return gameState;
	}
	async startGame(): Promise<GameState | { error: string }> {
		const state = await this.getFullGameState();
		if (!state || state.phase !== 'LOBBY') {
			return { error: 'Game not in LOBBY phase.' };
		}
		state.phase = 'QUESTION';
		state.questionStartTime = Date.now();
		await this.ctx.storage.put('game_state', state);
		const gameState = await this.getGameState();
		if (!gameState) {
			return { error: 'Game not found.' };
		}
		return gameState;
	}
	async submitAnswer(playerId: string, answerIndex: number): Promise<GameState | { error: string }> {
		const state = await this.getFullGameState();
		if (!state || state.phase !== 'QUESTION') {
			return { error: 'Not in QUESTION phase.' };
		}
		const player = state.players.find((p) => p.id === playerId);
		if (!player) {
			return { error: 'Player not found.' };
		}
		if (state.answers.some((a) => a.playerId === playerId)) {
			return { error: 'Player has already answered.' };
		}
		const timeTaken = Date.now() - state.questionStartTime;
		if (timeTaken > QUESTION_TIME_LIMIT_MS) {
			return { error: 'Time is up for this question.' };
		}
		const answer: Answer = { playerId, answerIndex, time: timeTaken };
		state.answers.push(answer);
		if (state.answers.length === state.players.length) {
			state.phase = 'REVEAL';
			const currentQuestion = state.questions[state.currentQuestionIndex];
			state.answers.forEach((ans) => {
				const p = state.players.find((p) => p.id === ans.playerId);
				if (p) {
					const isCorrect = currentQuestion.correctAnswerIndex === ans.answerIndex;
					let score = 0;
					if (isCorrect) {
						const timeFactor = 1 - ans.time / (QUESTION_TIME_LIMIT_MS * 2);
						score = Math.floor(1000 * timeFactor);
					}
					p.score += score;
					ans.isCorrect = isCorrect;
					ans.score = score;
				}
			});
		}
		await this.ctx.storage.put('game_state', state);
		const gameState = await this.getGameState();
		if (!gameState) {
			return { error: 'Game not found.' };
		}
		return gameState;
	}
	async nextState(): Promise<GameState | { error: string }> {
		const state = await this.getFullGameState();
		if (!state) {
			return { error: 'Game not found.' };
		}
		switch (state.phase) {
			case 'QUESTION': {
				const currentQuestion = state.questions[state.currentQuestionIndex];
				state.answers.forEach((answer) => {
					const player = state.players.find((p) => p.id === answer.playerId);
					if (player) {
						const isCorrect = currentQuestion.correctAnswerIndex === answer.answerIndex;
						let score = 0;
						if (isCorrect) {
							const timeFactor = 1 - answer.time / (QUESTION_TIME_LIMIT_MS * 2);
							score = Math.floor(1000 * timeFactor);
						}
						player.score += score;
						answer.isCorrect = isCorrect;
						answer.score = score;
					}
				});
				state.phase = 'REVEAL';
				break;
			}
			case 'REVEAL':
				state.phase = 'LEADERBOARD';
				state.players.sort((a, b) => b.score - a.score);
				break;
			case 'LEADERBOARD':
				if (state.currentQuestionIndex < state.questions.length - 1) {
					state.currentQuestionIndex++;
					state.phase = 'QUESTION';
					state.questionStartTime = Date.now();
					state.answers = [];
				} else {
					state.phase = 'END';
				}
				break;
			default:
				return { error: 'Invalid state transition.' };
		}
		await this.ctx.storage.put('game_state', state);
		const gameState = await this.getGameState();
		if (!gameState) {
			return { error: 'Game not found.' };
		}
		return gameState;
	}
	async getCustomQuizzes(): Promise<Quiz[]> {
		return (await this.ctx.storage.get<Quiz[]>('custom_quizzes')) || [];
	}
	async getCustomQuizById(id: string): Promise<Quiz | null> {
		const quizzes = await this.getCustomQuizzes();
		return quizzes.find((q) => q.id === id) || null;
	}
	async saveCustomQuiz(quizData: Omit<Quiz, 'id'> & { id?: string }): Promise<Quiz> {
		const quizzes = await this.getCustomQuizzes();
		if (quizData.id) {
			const index = quizzes.findIndex((q) => q.id === quizData.id);
			if (index > -1) {
				quizzes[index] = { ...quizzes[index], ...quizData, id: quizData.id };
			} else {
				const newQuiz = { ...quizData, id: crypto.randomUUID() };
				quizzes.push(newQuiz);
				return newQuiz;
			}
		} else {
			const newQuiz = { ...quizData, id: crypto.randomUUID() };
			quizzes.push(newQuiz);
		}
		await this.ctx.storage.put('custom_quizzes', quizzes);
		return quizzes.find((q) => q.id === quizData.id)! || quizzes[quizzes.length - 1];
	}
	async deleteCustomQuiz(id: string): Promise<{ success: boolean }> {
		let quizzes = await this.getCustomQuizzes();
		const initialLength = quizzes.length;
		quizzes = quizzes.filter((q) => q.id !== id);
		if (quizzes.length < initialLength) {
			await this.ctx.storage.put('custom_quizzes', quizzes);
			return { success: true };
		}
		return { success: false };
	}
}
