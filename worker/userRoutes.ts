import { Hono } from "hono";
import { Env } from './core-utils';
import { QUIZ_TOPICS } from './durableObject';
import type { ApiResponse, GameState, QuizTopic, Quiz } from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    app.get('/api/quizzes', (c) => {
        return c.json({ success: true, data: QUIZ_TOPICS } satisfies ApiResponse<QuizTopic[]>);
    });
    app.get('/api/quizzes/custom', async (c) => {
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.getCustomQuizzes();
        return c.json({ success: true, data } satisfies ApiResponse<Quiz[]>);
    });
    app.get('/api/quizzes/custom/:id', async (c) => {
        const { id } = c.req.param();
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.getCustomQuizById(id);
        if (!data) {
            return c.json({ success: false, error: 'Quiz not found' }, 404);
        }
        return c.json({ success: true, data } satisfies ApiResponse<Quiz>);
    });
    app.post('/api/quizzes/custom', async (c) => {
        const body = await c.req.json<Omit<Quiz, 'id'>>();
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.saveCustomQuiz(body);
        return c.json({ success: true, data }, 201);
    });
    app.put('/api/quizzes/custom/:id', async (c) => {
        const { id } = c.req.param();
        const body = await c.req.json<Quiz>();
        if (id !== body.id) {
            return c.json({ success: false, error: 'ID mismatch' }, 400);
        }
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.saveCustomQuiz(body);
        return c.json({ success: true, data });
    });
    app.delete('/api/quizzes/custom/:id', async (c) => {
        const { id } = c.req.param();
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.deleteCustomQuiz(id);
        if (!data.success) {
            return c.json({ success: false, error: 'Quiz not found' }, 404);
        }
        return c.json({ success: true });
    });
    app.post('/api/games', async (c) => {
        const { quizId } = await c.req.json<{ quizId?: string }>();
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.createGame(quizId);
        if ('error' in data) {
            return c.json({ success: false, error: data.error }, 400);
        }
        return c.json({ success: true, data } satisfies ApiResponse<GameState>);
    });
    app.get('/api/games/:gameId', async (c) => {
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
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
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
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
        const { name, playerId } = await c.req.json<{ name: string, playerId: string }>();
        if (!name || !playerId) {
            return c.json({ success: false, error: 'Name and playerId are required' }, 400);
        }
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.addPlayer(name, playerId);
        if ('error' in data) {
            return c.json({ success: false, error: data.error }, 400);
        }
        return c.json({ success: true, data } satisfies ApiResponse<GameState>);
    });
    app.post('/api/games/:gameId/start', async (c) => {
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.startGame();
        if ('error' in data) {
            return c.json({ success: false, error: data.error }, 400);
        }
        return c.json({ success: true, data } satisfies ApiResponse<GameState>);
    });
    app.post('/api/games/:gameId/answer', async (c) => {
        const { playerId, answerIndex } = await c.req.json<{ playerId: string, answerIndex: number }>();
        if (playerId === undefined || answerIndex === undefined) {
            return c.json({ success: false, error: 'playerId and answerIndex are required' }, 400);
        }
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.submitAnswer(playerId, answerIndex);
        if ('error' in data) {
            return c.json({ success: false, error: data.error }, 400);
        }
        return c.json({ success: true, data } satisfies ApiResponse<GameState>);
    });
    app.post('/api/games/:gameId/next', async (c) => {
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.nextState();
        if ('error' in data) {
            return c.json({ success: false, error: data.error }, 400);
        }
        return c.json({ success: true, data } satisfies ApiResponse<GameState>);
    });
}