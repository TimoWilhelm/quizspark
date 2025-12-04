import { DurableObject } from 'cloudflare:workers';
import type { GameState, Question, Player, Answer, QuizTopic, Quiz } from '@shared/types';
import { adjectives, colors, animals } from './words';
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
		if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
			return { error: 'Player name already taken.' };
		}
		const newPlayer: Player = { id: playerId, name, score: 0, answered: false };
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
