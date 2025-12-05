import { Hono } from 'hono';
import { Env } from './core-utils';
import { QUIZ_TOPICS } from './durableObject';
import type { ApiResponse, GameState, QuizTopic, Quiz } from '@shared/types';
import { generateQuizFromPrompt } from './ai';
import { z } from 'zod';
import {
	aiGenerateRequestSchema,
	quizSchema,
	playerJoinRequestSchema,
	submitAnswerRequestSchema,
	hostAuthRequestSchema,
	createGameRequestSchema,
} from '@shared/validation';

export function userRoutes(app: Hono<{ Bindings: Env }>) {
	// WebSocket upgrade endpoint - forwards to Durable Object
	app.get('/api/games/:gameId/ws', async (c) => {
		const upgradeHeader = c.req.header('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return c.text('Expected WebSocket upgrade', 426);
		}

		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));

		// Forward the WebSocket upgrade request to the Durable Object
		const url = new URL(c.req.url);
		url.pathname = '/websocket';

		return durableObjectStub.fetch(
			new Request(url.toString(), {
				headers: c.req.raw.headers,
			}),
		);
	});
	app.get('/api/quizzes', (c) => {
		return c.json({ success: true, data: QUIZ_TOPICS } satisfies ApiResponse<QuizTopic[]>);
	});
	app.get('/api/quizzes/custom', async (c) => {
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.getCustomQuizzes();
		return c.json({ success: true, data } satisfies ApiResponse<Quiz[]>);
	});
	app.get('/api/quizzes/custom/:id', async (c) => {
		const { id } = c.req.param();
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.getCustomQuizById(id);
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
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.saveCustomQuiz(result.data);
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
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.saveCustomQuiz(result.data);
		return c.json({ success: true, data });
	});
	app.delete('/api/quizzes/custom/:id', async (c) => {
		const { id } = c.req.param();
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.deleteCustomQuiz(id);
		if (!data.success) {
			return c.json({ success: false, error: 'Quiz not found' }, 404);
		}
		return c.json({ success: true });
	});
	// AI Quiz Generation endpoint
	app.post('/api/quizzes/generate', async (c) => {
		try {
			const body = await c.req.json();
			const result = aiGenerateRequestSchema.safeParse(body);
			if (!result.success) {
				return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
			}
			const { prompt, numQuestions } = result.data;
			const generatedQuiz = await generateQuizFromPrompt(prompt, numQuestions, c.req.raw.signal);
			// Save the generated quiz as a custom quiz
			const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
			const savedQuiz = await durableObjectStub.saveCustomQuiz({
				title: generatedQuiz.title,
				questions: generatedQuiz.questions,
			});
			return c.json({ success: true, data: savedQuiz } satisfies ApiResponse<Quiz>, 201);
		} catch (error) {
			console.error('[AI Quiz Generation Error]', error);
			return c.json(
				{ success: false, error: error instanceof Error ? error.message : 'Failed to generate quiz' } satisfies ApiResponse,
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
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.createGame(result.data.quizId);
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.get('/api/games/:gameId', async (c) => {
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.getGameState();
		if (!data) {
			return c.json({ success: false, error: 'Game not found' }, 404);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/host', async (c) => {
		const body = await c.req.json();
		const result = hostAuthRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { hostSecret } = result.data;
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.getFullGameState();
		if (!data) {
			return c.json({ success: false, error: 'Game not found' }, 404);
		}
		if (data.hostSecret !== hostSecret) {
			return c.json({ success: false, error: 'Forbidden' }, 403);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/players', async (c) => {
		const body = await c.req.json();
		const result = playerJoinRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { name, playerId } = result.data;
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.addPlayer(name, playerId);
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/start', async (c) => {
		const body = await c.req.json();
		const result = hostAuthRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { hostSecret } = result.data;
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const state = await durableObjectStub.getFullGameState();
		if (!state) {
			return c.json({ success: false, error: 'Game not found' }, 404);
		}
		if (state.hostSecret !== hostSecret) {
			return c.json({ success: false, error: 'Forbidden' }, 403);
		}
		const data = await durableObjectStub.startGame();
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/answer', async (c) => {
		const body = await c.req.json();
		const result = submitAnswerRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { playerId, answerIndex } = result.data;
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.submitAnswer(playerId, answerIndex);
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/next', async (c) => {
		const body = await c.req.json();
		const result = hostAuthRequestSchema.safeParse(body);
		if (!result.success) {
			return c.json({ success: false, error: z.prettifyError(result.error) } satisfies ApiResponse, 400);
		}
		const { hostSecret } = result.data;
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const state = await durableObjectStub.getFullGameState();
		if (!state) {
			return c.json({ success: false, error: 'Game not found' }, 404);
		}
		if (state.hostSecret !== hostSecret) {
			return c.json({ success: false, error: 'Forbidden' }, 403);
		}
		const data = await durableObjectStub.nextState();
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
}
