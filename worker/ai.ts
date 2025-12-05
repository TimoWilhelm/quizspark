import { experimental_MCPClient as MCPClient, experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
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

export const getCloudflareDocsMCP: () => Promise<MCPClient> = async () => {
	return await createMCPClient({
		transport: new StreamableHTTPClientTransport(new URL('https://docs.mcp.cloudflare.com/mcp')),
	});
};

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
const model = gateway.chatModel('dynamic/gemini');

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
export async function generateQuizFromPrompt(prompt: string, numQuestions: number = 5, abortSignal: AbortSignal): Promise<GeneratedQuiz> {
	const cloudflareDocsMcp = await getCloudflareDocsMCP();

	const researchAgent = await createResearchAgent(model, [cloudflareDocsMcp]);

	const { output: researchOutput } = await researchAgent.generate({
		messages: [
			{
				role: 'user',
				content: stripIndent`
					Research the following topic and provide detailed information:
					${prompt}
				`,
			},
		],
		abortSignal,
	});

	const { output: quizOutput } = await generateText({
		model,
		output: Output.object({
			schema: QuizSchema,
		}),
		messages: [
			{
				role: 'system',
				content: stripIndent`
					You are a quiz generator.
					
					Generate exactly ${numQuestions} multiple-choice questions. Each question should:
					- Have exactly 4 answer options
					- Have one clearly correct answer
					- Be interesting and educational
					- Vary in difficulty

					- The quiz question must be a single sentence with less than 120 characters
					- The quiz options should be as concise as possible and must have less than 75 characters
					- Make sure there are no full stops at the end of the sentences
					
					Also create a catchy title for the quiz that reflects the topic.
				`,
			},
			{
				role: 'user',
				content: stripIndent`
					Create a quiz based on the following topic:

					${prompt}
				`,
			},
			{
				role: 'assistant',
				content: stripIndent`
					Information about the topic:

					${researchOutput}
				`,
			},
		],
		abortSignal,
	});

	if (!quizOutput) {
		throw new Error('Failed to generate quiz - no output returned');
	}

	return quizOutput;
}

async function createResearchAgent(model: LanguageModel, mcpServers: MCPClient[]) {
	const mcpToolSets = await Promise.all(mcpServers.flatMap((mcp) => mcp.tools()));
	const mcpTools = Object.assign({}, ...mcpToolSets);

	const instructions = stripIndent`
		You are a researcher.
		
		Use the tools to look up relevant information about the topic if needed.
		Generate an information-rich response based on the information you have found and your own knowledge.
	`;

	const agent = new ToolLoopAgent({
		model,
		output: Output.text(),
		instructions,
		tools: {
			...mcpTools,
		},
		experimental_repairToolCall: repairToolCall(model),
		stopWhen: stepCountIs(10),
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
