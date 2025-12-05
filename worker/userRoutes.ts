import { Hono } from 'hono';
import { Env } from './core-utils';
import { QUIZ_TOPICS } from './durableObject';
import type { ApiResponse, GameState, QuizTopic, Quiz } from '@shared/types';
import { generateQuizFromPrompt } from './ai';

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

		return durableObjectStub.fetch(new Request(url.toString(), {
			headers: c.req.raw.headers,
		}));
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
		const body = await c.req.json<Omit<Quiz, 'id'>>();
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.saveCustomQuiz(body);
		return c.json({ success: true, data }, 201);
	});
	app.put('/api/quizzes/custom/:id', async (c) => {
		const { id } = c.req.param();
		const body = await c.req.json<Quiz>();
		if (id !== body.id) {
			return c.json({ success: false, error: 'ID mismatch' }, 400);
		}
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.saveCustomQuiz(body);
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
			const { prompt, numQuestions } = await c.req.json<{ prompt: string; numQuestions?: number }>();
			if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
				return c.json({ success: false, error: 'Prompt is required' } satisfies ApiResponse, 400);
			}
			const generatedQuiz = await generateQuizFromPrompt(prompt.trim(), numQuestions ?? 5);
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
		const { quizId } = await c.req.json<{ quizId?: string }>();
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.createGame(quizId);
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
		const { hostSecret } = await c.req.json<{ hostSecret: string }>();
		if (!hostSecret) {
			return c.json({ success: false, error: 'Host secret is required' }, 400);
		}
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
		const { name, playerId } = await c.req.json<{ name: string; playerId: string }>();
		if (!name || !playerId) {
			return c.json({ success: false, error: 'Name and playerId are required' }, 400);
		}
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.addPlayer(name, playerId);
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/start', async (c) => {
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.startGame();
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/answer', async (c) => {
		const { playerId, answerIndex } = await c.req.json<{ playerId: string; answerIndex: number }>();
		if (playerId === undefined || answerIndex === undefined) {
			return c.json({ success: false, error: 'playerId and answerIndex are required' }, 400);
		}
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.submitAnswer(playerId, answerIndex);
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
	app.post('/api/games/:gameId/next', async (c) => {
		const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
		const data = await durableObjectStub.nextState();
		if ('error' in data) {
			return c.json({ success: false, error: data.error }, 400);
		}
		return c.json({ success: true, data } satisfies ApiResponse<GameState>);
	});
}
