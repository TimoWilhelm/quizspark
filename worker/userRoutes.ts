import { Hono } from "hono";
import { Env } from './core-utils';
import { QUIZ_TOPICS } from './durableObject';
import type { ApiResponse, GameState, QuizTopic } from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    // Get available quizzes
    app.get('/api/quizzes', (c) => {
        return c.json({ success: true, data: QUIZ_TOPICS } satisfies ApiResponse<QuizTopic[]>);
    });
    // Create a new game
    app.post('/api/games', async (c) => {
        const { quizId } = await c.req.json<{ quizId?: string }>();
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.createGame(quizId);
        return c.json({ success: true, data } satisfies ApiResponse<GameState>);
    });
    // Get the current game state
    app.get('/api/games/:gameId', async (c) => {
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.getGameState();
        if (!data) {
            return c.json({ success: false, error: 'Game not found' }, 404);
        }
        return c.json({ success: true, data } satisfies ApiResponse<GameState>);
    });
    // Player joins a game
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
    // Host starts the game
    app.post('/api/games/:gameId/start', async (c) => {
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.startGame();
        if ('error' in data) {
            return c.json({ success: false, error: data.error }, 400);
        }
        return c.json({ success: true, data } satisfies ApiResponse<GameState>);
    });
    // Player submits an answer
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
    // Host advances to the next state (e.g., from question to leaderboard)
    app.post('/api/games/:gameId/next', async (c) => {
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await durableObjectStub.nextState();
        if ('error' in data) {
            return c.json({ success: false, error: data.error }, 400);
        }
        return c.json({ success: true, data } satisfies ApiResponse<GameState>);
    });
}