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
export interface Quiz {
	id: string;
	title: string;
	questions: Question[];
	type?: 'predefined' | 'custom';
}

// ============ WebSocket Message Types ============

export type ClientRole = 'host' | 'player';

// Client -> Server Messages
export type ClientMessage =
	| { type: 'connect'; role: 'host'; gameId: string; hostSecret: string }
	| { type: 'connect'; role: 'player'; gameId: string; playerId?: string; nickname?: string }
	| { type: 'join'; nickname: string }
	| { type: 'startGame' }
	| { type: 'submitAnswer'; answerIndex: number }
	| { type: 'nextState' };

// Server -> Client Messages
export type ServerMessage =
	| { type: 'connected'; role: ClientRole; playerId?: string }
	| { type: 'error'; message: string }
	| { type: 'lobbyUpdate'; players: { id: string; name: string }[]; pin: string; gameId: string }
	| {
			type: 'questionStart';
			questionIndex: number;
			totalQuestions: number;
			questionText: string;
			options: string[];
			startTime: number;
			timeLimitMs: number;
	  }
	| { type: 'answerReceived'; answerIndex: number }
	| { type: 'playerAnswered'; playerId: string; answeredCount: number; totalPlayers: number }
	| {
			type: 'reveal';
			correctAnswerIndex: number;
			playerResult?: { isCorrect: boolean; score: number; answerIndex: number };
			answerCounts: number[]; // count per option for host display
	  }
	| {
			type: 'leaderboard';
			leaderboard: { id: string; name: string; score: number; rank: number }[];
			isLastQuestion: boolean;
	  }
	| {
			type: 'gameEnd';
			finalLeaderboard: { id: string; name: string; score: number; rank: number }[];
	  }
	| { type: 'playerJoined'; player: { id: string; name: string } }
	| { type: 'kicked'; reason: string };
