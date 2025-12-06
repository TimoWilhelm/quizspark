import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { PREDEFINED_QUIZZES, GENERAL_KNOWLEDGE_QUIZ } from './quizzes';
import type { ApiResponse, GameState, Quiz } from '@shared/types';
import { generateQuizFromPrompt, generateSingleQuestion, type GenerationStatus, type GeneratedQuestion } from './ai';
import { z } from 'zod';
import {
	aiGenerateRequestSchema,
	quizSchema,
	playerJoinRequestSchema,
	submitAnswerRequestSchema,
	hostAuthRequestSchema,
	createGameRequestSchema,
} from '@shared/validation';
import { exports } from 'cloudflare:workers';
import { generateGameId } from './words';

export function userRoutes(app: Hono<{ Bindings: Env }>) {
	// WebSocket upgrade endpoint - forwards to GameRoom Durable Object
	app.get('/api/games/:gameId/ws', async (c) => {
		const { gameId } = c.req.param();
		const upgradeHeader = c.req.header('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return c.text('Expected WebSocket upgrade', 426);
		}

		// Get the GameRoom DO instance by game ID
		const gameRoomStub = exports.GameRoomDurableObject.getByName(gameId);

		// Forward the WebSocket upgrade request to the Durable Object
		const url = new URL(c.req.url);
		url.pathname = '/websocket';

		return gameRoomStub.fetch(
			new Request(url.toString(), {
				headers: c.req.raw.headers,
			}),
		);
	});
	app.get('/api/quizzes', (c) => {
		return c.json({ success: true, data: PREDEFINED_QUIZZES } satisfies ApiResponse<Quiz[]>);
	});
	app.get('/api/quizzes/custom', async (c) => {
		const quizStoreStub = exports.QuizStoreDurableObject.getByName('global');
		const data = await quizStoreStub.getCustomQuizzes();
		return c.json({ success: true, data } satisfies ApiResponse<Quiz[]>);
	});
	app.get('/api/quizzes/custom/:id', async (c) => {
		const { id } = c.req.param();
		const quizStoreStub = exports.QuizStoreDurableObject.getByName('global');
		const data = await quizStoreStub.getCustomQuizById(id);
		if (!data) {
			return c.json({ success: false, error: 'Quiz not found' }, 404);
		}
		return c.json({ success: true, data } satisfies ApiResponse<Quiz>);
	});
	app.post('/api/quizzes/custom', async (c) => {
		const body = await c.req.json();
		const result = quizSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const quizStoreStub = exports.QuizStoreDurableObject.getByName('global');
		const data = await quizStoreStub.saveCustomQuiz(result.data);
		return c.json({ success: true, data }, 201);
	});
	app.put('/api/quizzes/custom/:id', async (c) => {
		const { id } = c.req.param();
		const body = await c.req.json();
		const result = quizSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		if (id !== result.data.id) {
			return c.json({ success: false, error: 'ID mismatch' }, 400);
		}
		const quizStoreStub = exports.QuizStoreDurableObject.getByName('global');
		const data = await quizStoreStub.saveCustomQuiz(result.data);
		return c.json({ success: true, data });
	});
	app.delete('/api/quizzes/custom/:id', async (c) => {
		const { id } = c.req.param();
		const quizStoreStub = exports.QuizStoreDurableObject.getByName('global');
		const data = await quizStoreStub.deleteCustomQuiz(id);
		if (!data.success) {
			return c.json({ success: false, error: 'Quiz not found' }, 404);
		}
		return c.json({ success: true });
	});
	// AI Quiz Generation endpoint with SSE streaming for status updates
	app.post('/api/quizzes/generate', async (c) => {
		const body = await c.req.json();
		const result = aiGenerateRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { prompt, numQuestions } = result.data;

		return streamSSE(c, async (stream) => {
			try {
				const onStatusUpdate = (status: GenerationStatus) => {
					stream.writeSSE({ event: 'status', data: JSON.stringify(status) });
				};

				const generatedQuiz = await generateQuizFromPrompt(prompt, numQuestions, c.req.raw.signal, onStatusUpdate);

				// Save the generated quiz as a custom quiz
				const quizStoreStub = exports.QuizStoreDurableObject.getByName('global');
				const savedQuiz = await quizStoreStub.saveCustomQuiz({
					title: generatedQuiz.title,
					questions: generatedQuiz.questions,
				});

				await stream.writeSSE({
					event: 'complete',
					data: JSON.stringify({ success: true, data: savedQuiz } satisfies ApiResponse<Quiz>),
				});
			} catch (error) {
				console.error('[AI Quiz Generation Error]', error);
				await stream.writeSSE({
					event: 'error',
					data: JSON.stringify({
						success: false,
						error: error instanceof Error ? error.message : 'Failed to generate quiz',
					} satisfies ApiResponse),
				});
			}
		});
	});
	// AI Single Question Generation endpoint
	app.post('/api/quizzes/generate-question', async (c) => {
		const body = await c.req.json();
		const schema = z.object({
			title: z.string().min(1, 'Quiz title is required'),
			existingQuestions: z
				.array(
					z.object({
						text: z.string(),
						options: z.array(z.string()),
						correctAnswerIndex: z.number(),
					}),
				)
				.optional()
				.default([]),
		});

		const result = schema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}

		try {
			const { title, existingQuestions } = result.data;
			const question = await generateSingleQuestion(title, existingQuestions, c.req.raw.signal);
			return c.json({ success: true, data: question } satisfies ApiResponse<GeneratedQuestion>);
		} catch (error) {
			console.error('[AI Question Generation Error]', error);
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Failed to generate question',
				} satisfies ApiResponse,
				500,
			);
		}
	});
	app.post('/api/games', async (c) => {
		const body = await c.req.json();
		const result = createGameRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}

		// Resolve questions from quiz ID
		let questions = GENERAL_KNOWLEDGE_QUIZ;
		if (result.data.quizId) {
			const quizStoreStub = exports.QuizStoreDurableObject.getByName('global');
			const customQuiz = await quizStoreStub.getCustomQuizById(result.data.quizId);
			if (customQuiz) {
				questions = customQuiz.questions;
			} else {
				const predefinedQuiz = PREDEFINED_QUIZZES.find((q) => q.id === result.data.quizId);
				if (predefinedQuiz) {
					questions = predefinedQuiz.questions;
				}
			}
		}

		// Generate a unique game ID for the room (adjective-color-animal format)
		const gameId = generateGameId();
		const gameRoomStub = exports.GameRoomDurableObject.getByName(gameId);

		// Create game with the resolved questions (copied into game state)
		const data = await gameRoomStub.createGame(gameId, questions);
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}

		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.get('/api/games/:gameId', async (c) => {
		const { gameId } = c.req.param();
		const gameRoomStub = exports.GameRoomDurableObject.getByName(gameId);
		const data = await gameRoomStub.getGameState();
		if (!data) {
			return c.json({ success: false, error: 'Game not found' }, 404);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/host', async (c) => {
		const { gameId } = c.req.param();
		const body = await c.req.json();
		const result = hostAuthRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { hostSecret } = result.data;
		const gameRoomStub = exports.GameRoomDurableObject.getByName(gameId);
		const data = await gameRoomStub.getFullGameState();
		if (!data) {
			return c.json({ success: false, error: 'Game not found' }, 404);
		}
		if (data.hostSecret !== hostSecret) {
			return c.json({ success: false, error: 'Forbidden' }, 403);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/players', async (c) => {
		const { gameId } = c.req.param();
		const body = await c.req.json();
		const result = playerJoinRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { name, playerId } = result.data;
		const gameRoomStub = exports.GameRoomDurableObject.getByName(gameId);
		const data = await gameRoomStub.addPlayer(name, playerId);
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/start', async (c) => {
		const { gameId } = c.req.param();
		const body = await c.req.json();
		const result = hostAuthRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { hostSecret } = result.data;
		const gameRoomStub = exports.GameRoomDurableObject.getByName(gameId);
		const state = await gameRoomStub.getFullGameState();
		if (!state) {
			return c.json({ success: false, error: 'Game not found' }, 404);
		}
		if (state.hostSecret !== hostSecret) {
			return c.json({ success: false, error: 'Forbidden' }, 403);
		}
		const data = await gameRoomStub.startGame();
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/answer', async (c) => {
		const { gameId } = c.req.param();
		const body = await c.req.json();
		const result = submitAnswerRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { playerId, answerIndex } = result.data;
		const gameRoomStub = exports.GameRoomDurableObject.getByName(gameId);
		const data = await gameRoomStub.submitAnswer(playerId, answerIndex);
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/next', async (c) => {
		const { gameId } = c.req.param();
		const body = await c.req.json();
		const result = hostAuthRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { hostSecret } = result.data;
		const gameRoomStub = exports.GameRoomDurableObject.getByName(gameId);
		const state = await gameRoomStub.getFullGameState();
		if (!state) {
			return c.json({ success: false, error: 'Game not found' }, 404);
		}
		if (state.hostSecret !== hostSecret) {
			return c.json({ success: false, error: 'Forbidden' }, 403);
		}
		const data = await gameRoomStub.nextState();
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
}
