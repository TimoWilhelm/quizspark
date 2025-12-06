import { DurableObject } from 'cloudflare:workers';
import type { Quiz } from '@shared/types';

/**
 * QuizStoreDurableObject - Singleton DO for storing custom quizzes
 * Accessed via idFromName('global') for a single shared instance
 */
export class QuizStoreDurableObject extends DurableObject<Env> {
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
				// Update existing quiz
				quizzes[index] = { ...quizzes[index], ...quizData, id: quizData.id };
				await this.ctx.storage.put('custom_quizzes', quizzes);
				return quizzes[index];
			}
		}

		// Create new quiz
		const newQuiz: Quiz = { ...quizData, id: quizData.id || crypto.randomUUID() } as Quiz;
		quizzes.push(newQuiz);
		await this.ctx.storage.put('custom_quizzes', quizzes);
		return newQuiz;
	}

	async deleteCustomQuiz(id: string): Promise<{ success: boolean }> {
		const quizzes = await this.getCustomQuizzes();
		const initialLength = quizzes.length;
		const filtered = quizzes.filter((q) => q.id !== id);

		if (filtered.length < initialLength) {
			await this.ctx.storage.put('custom_quizzes', filtered);
			return { success: true };
		}
		return { success: false };
	}
}
