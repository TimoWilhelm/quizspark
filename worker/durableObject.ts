import { DurableObject } from "cloudflare:workers";
import type { GameState, Question, Player, Answer, QuizTopic, Quiz } from '@shared/types';
const GENERAL_KNOWLEDGE_QUIZ: Question[] = [
  {
    text: "What is the capital of France?",
    options: ["Berlin", "Madrid", "Paris", "Rome"],
    correctAnswerIndex: 2,
  },
  {
    text: "Which planet is known as the Red Planet?",
    options: ["Earth", "Mars", "Jupiter", "Venus"],
    correctAnswerIndex: 1,
  },
  {
    text: "What is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correctAnswerIndex: 3,
  },
  {
    text: "Who wrote 'To Kill a Mockingbird'?",
    options: ["Harper Lee", "J.K. Rowling", "Ernest Hemingway", "Mark Twain"],
    correctAnswerIndex: 0,
  },
];
const TECH_QUIZ: Question[] = [
  {
    text: "What does 'CPU' stand for?",
    options: ["Central Processing Unit", "Computer Personal Unit", "Central Processor Unit", "Control Processing Unit"],
    correctAnswerIndex: 0,
  },
  {
    text: "Which company developed the JavaScript programming language?",
    options: ["Microsoft", "Apple", "Netscape", "Sun Microsystems"],
    correctAnswerIndex: 2,
  },
  {
    text: "What is the main function of a DNS server?",
    options: ["To store websites", "To resolve domain names to IP addresses", "To send emails", "To secure network connections"],
    correctAnswerIndex: 1,
  },
];
const GEOGRAPHY_QUIZ: Question[] = [
  {
    text: "What is the longest river in the world?",
    options: ["Amazon River", "Nile River", "Yangtze River", "Mississippi River"],
    correctAnswerIndex: 1,
  },
  {
    text: "Which desert is the largest in the world?",
    options: ["Sahara Desert", "Arabian Desert", "Gobi Desert", "Antarctic Polar Desert"],
    correctAnswerIndex: 3,
  },
  {
    text: "What is the capital of Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Perth"],
    correctAnswerIndex: 2,
  },
];
const QUIZZES: Record<string, Question[]> = {
  'general': GENERAL_KNOWLEDGE_QUIZ,
  'tech': TECH_QUIZ,
  'geo': GEOGRAPHY_QUIZ,
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
      // Check custom quizzes first
      const customQuiz = await this.getCustomQuizById(quizId);
      if (customQuiz) {
        questions = customQuiz.questions;
      } else {
        // Fallback to predefined quizzes
        questions = QUIZZES[quizId];
      }
    }
    // Default to general knowledge if no quizId or not found
    if (!questions) {
      questions = GENERAL_KNOWLEDGE_QUIZ;
    }
    if (questions.length === 0) {
      return { error: "Cannot start a game with an empty quiz." };
    }
    const gameId = crypto.randomUUID();
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
    };
    await this.ctx.storage.put('game_state', newGame);
    return newGame;
  }
  async getGameState(): Promise<GameState | null> {
    const state = await this.ctx.storage.get<GameState>('game_state');
    return state || null;
  }
  async addPlayer(name: string, playerId: string): Promise<GameState | { error: string }> {
    const state = await this.getGameState();
    if (!state || state.phase !== 'LOBBY') {
      return { error: 'Game not in LOBBY phase or does not exist.' };
    }
    if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'Player name already taken.' };
    }
    const newPlayer: Player = { id: playerId, name, score: 0, answered: false };
    state.players.push(newPlayer);
    await this.ctx.storage.put('game_state', state);
    return state;
  }
  async startGame(): Promise<GameState | { error: string }> {
    const state = await this.getGameState();
    if (!state || state.phase !== 'LOBBY') {
      return { error: 'Game not in LOBBY phase.' };
    }
    state.phase = 'QUESTION';
    state.questionStartTime = Date.now();
    await this.ctx.storage.put('game_state', state);
    return state;
  }
  async submitAnswer(playerId: string, answerIndex: number): Promise<GameState | { error: string }> {
    const state = await this.getGameState();
    if (!state || state.phase !== 'QUESTION') {
      return { error: 'Not in QUESTION phase.' };
    }
    const player = state.players.find(p => p.id === playerId);
    if (!player || player.answered) {
      return { error: 'Player not found or has already answered.' };
    }
    const timeTaken = Date.now() - state.questionStartTime;
    if (timeTaken > QUESTION_TIME_LIMIT_MS) {
      return { error: 'Time is up for this question.' };
    }
    const currentQuestion = state.questions[state.currentQuestionIndex];
    const isCorrect = currentQuestion.correctAnswerIndex === answerIndex;
    let score = 0;
    if (isCorrect) {
      const timeFactor = 1 - (timeTaken / (QUESTION_TIME_LIMIT_MS * 2));
      score = Math.floor(1000 * timeFactor);
    }
    player.score += score;
    player.answered = true;
    const answer: Answer = { playerId, answerIndex, time: timeTaken, isCorrect, score };
    state.answers.push(answer);
    await this.ctx.storage.put('game_state', state);
    return state;
  }
  async nextState(): Promise<GameState | { error: string }> {
    const state = await this.getGameState();
    if (!state) {
      return { error: 'Game not found.' };
    }
    switch (state.phase) {
      case 'QUESTION':
        state.phase = 'REVEAL';
        break;
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
          state.players.forEach(p => p.answered = false);
        } else {
          state.phase = 'END';
        }
        break;
      default:
        return { error: 'Invalid state transition.' };
    }
    await this.ctx.storage.put('game_state', state);
    return state;
  }
  // --- Custom Quiz Methods ---
  async getCustomQuizzes(): Promise<Quiz[]> {
    return (await this.ctx.storage.get<Quiz[]>('custom_quizzes')) || [];
  }
  async getCustomQuizById(id: string): Promise<Quiz | null> {
    const quizzes = await this.getCustomQuizzes();
    return quizzes.find(q => q.id === id) || null;
  }
  async saveCustomQuiz(quizData: Omit<Quiz, 'id'> & { id?: string }): Promise<Quiz> {
    const quizzes = await this.getCustomQuizzes();
    if (quizData.id) {
      // Update existing quiz
      const index = quizzes.findIndex(q => q.id === quizData.id);
      if (index > -1) {
        quizzes[index] = { ...quizzes[index], ...quizData, id: quizData.id };
      } else {
        // If ID provided but not found, treat as new (or throw error)
        const newQuiz = { ...quizData, id: crypto.randomUUID() };
        quizzes.push(newQuiz);
        return newQuiz;
      }
    } else {
      // Create new quiz
      const newQuiz = { ...quizData, id: crypto.randomUUID() };
      quizzes.push(newQuiz);
    }
    await this.ctx.storage.put('custom_quizzes', quizzes);
    return quizzes.find(q => q.id === quizData.id)! || quizzes[quizzes.length - 1];
  }
  async deleteCustomQuiz(id: string): Promise<{ success: boolean }> {
    let quizzes = await this.getCustomQuizzes();
    const initialLength = quizzes.length;
    quizzes = quizzes.filter(q => q.id !== id);
    if (quizzes.length < initialLength) {
      await this.ctx.storage.put('custom_quizzes', quizzes);
      return { success: true };
    }
    return { success: false };
  }
}