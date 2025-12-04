export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}
export interface Question {
	text: string;
	options: string[];
	correctAnswerIndex: number;
}
export interface Player {
	id: string;
	name: string;
	score: number;
	answered: boolean;
}
export interface Answer {
	playerId: string;
	answerIndex: number;
	time: number; // Time in ms from question start
	isCorrect?: boolean;
	score?: number;
}
export type GamePhase = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'END';
export interface GameState {
	id: string;
	pin: string;
	phase: GamePhase;
	players: Player[];
	questions: Question[];
	currentQuestionIndex: number;
	questionStartTime: number; // Unix timestamp in ms
	answers: Answer[];
	hostSecret?: string;
}
export interface QuizTopic {
	id: string;
	title: string;
	type: 'predefined' | 'custom';
}
export interface Quiz {
	id: string;
	title: string;
	questions: Question[];
}
