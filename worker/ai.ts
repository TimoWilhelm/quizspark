import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
	type LanguageModel,
	NoSuchToolError,
	type ToolCallRepairFunction,
	type ToolSet,
	generateText,
	ToolLoopAgent,
	stepCountIs,
	Output,
} from 'ai';
import { stripIndent } from 'common-tags';
import { z } from 'zod/v4';
import { env } from 'cloudflare:workers';
import type { Question, Quiz } from '@shared/types';

const gateway = createOpenAICompatible({
	name: 'cloudflare-ai-gateway',
	baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_AI_GATEWAY_ID}/compat`,
	supportsStructuredOutputs: true,
	includeUsage: true,
	headers: {
		'cf-aig-authorization': `Bearer ${env.CLOUDFLARE_AI_GATEWAY_API_TOKEN}`,
		'cf-aig-metadata': JSON.stringify({
			hello: 'world',
		}),
	},
});
const model = gateway.chatModel('dynamic/shopping-agent');

// Schema for AI-generated quiz questions
const QuestionSchema = z.object({
	text: z.string().describe('The question text'),
	options: z.array(z.string()).length(4).describe('Exactly 4 answer options'),
	correctAnswerIndex: z.number().min(0).max(3).describe('Index of the correct answer (0-3)'),
});

const QuizSchema = z.object({
	title: z.string().describe('A catchy title for the quiz'),
	questions: z.array(QuestionSchema).min(3).max(10).describe('Array of quiz questions'),
});

export type GeneratedQuiz = z.infer<typeof QuizSchema>;

/**
 * Generate a quiz using AI based on a user prompt
 */
export async function generateQuizFromPrompt(prompt: string, numQuestions: number = 5): Promise<GeneratedQuiz> {
	const { output } = await generateText({
		model,
		output: Output.object({
			schema: QuizSchema,
		}),
		stopWhen: stepCountIs(2),
		prompt: stripIndent`
			You are a quiz generator. Create an engaging and educational quiz based on the following topic or request:
			
			"${prompt}"
			
			Generate exactly ${numQuestions} multiple-choice questions. Each question should:
			- Have exactly 4 answer options
			- Have one clearly correct answer
			- Be interesting and educational
			- Vary in difficulty
			
			Also create a catchy title for the quiz that reflects the topic.
		`,
	});

	if (!output) {
		throw new Error('Failed to generate quiz - no output returned');
	}

	return output;
}

async function createAgent(model: LanguageModel, instructions: string) {
	const agent = new ToolLoopAgent({
		model,
		instructions,
		tools: {
			// TODO
		},
		experimental_repairToolCall: repairToolCall(model),
		stopWhen: stepCountIs(20),
	});

	return agent;
}

const repairToolCall: <T extends ToolSet>(model: LanguageModel) => ToolCallRepairFunction<T> =
	(model) =>
	async ({ toolCall, tools, inputSchema, error }) => {
		if (NoSuchToolError.isInstance(error)) {
			return null; // do not attempt to fix invalid tool names
		}

		const tool = tools[toolCall.toolName as keyof typeof tools];

		if (tool.inputSchema === undefined) {
			return null;
		}

		const { output } = await generateText({
			model,
			output: Output.object({
				schema: tool.inputSchema,
			}),
			prompt: [
				`The model tried to call the tool "${toolCall.toolName}"` + ` with the following arguments:`,
				JSON.stringify(toolCall.input),
				`The tool accepts the following schema:`,
				JSON.stringify(inputSchema(toolCall)),
				'Please fix the arguments.',
			].join('\n'),
		});

		return { ...toolCall, input: JSON.stringify(output) };
	};
