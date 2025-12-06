import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, CheckCircle, Pencil, Trash2, PlusCircle, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster, toast } from 'sonner';
import type { ApiResponse, GameState, QuizTopic, Quiz } from '@shared/types';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { aiPromptSchema, LIMITS } from '@shared/validation';
import { motion } from 'framer-motion';
import { useHostStore } from '@/lib/host-store';

export function HomePage() {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(false);
	const [isGameStarting, setIsGameStarting] = useState(false);
	const [predefinedQuizzes, setPredefinedQuizzes] = useState<QuizTopic[]>([]);
	const [customQuizzes, setCustomQuizzes] = useState<Quiz[]>([]);
	const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
	const [aiPrompt, setAiPrompt] = useState('');
	const [isGenerating, setIsGenerating] = useState(false);
	const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
	const [generationStatus, setGenerationStatus] = useState<{ stage: string; detail?: string } | null>(null);
	const [generatingPrompt, setGeneratingPrompt] = useState<string | null>(null);
	const [quizToDelete, setQuizToDelete] = useState<string | null>(null);
	const addSecret = useHostStore((s) => s.addSecret);

	const fetchQuizzes = async () => {
		setIsLoading(true);
		try {
			const [predefinedRes, customRes] = await Promise.all([fetch('/api/quizzes'), fetch('/api/quizzes/custom')]);
			const predefinedResult = (await predefinedRes.json()) as ApiResponse<QuizTopic[]>;
			const customResult = (await customRes.json()) as ApiResponse<Quiz[]>;
			if (predefinedResult.success && predefinedResult.data) {
				setPredefinedQuizzes(predefinedResult.data);
			}
			if (customResult.success && customResult.data) {
				setCustomQuizzes(customResult.data);
			}
		} catch (error) {
			console.error(error);
			toast.error('Could not load quizzes. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchQuizzes();
	}, []);

	const handleStartGame = async () => {
		if (!selectedQuizId) {
			toast.error('Please select a quiz to start.');
			return;
		}
		setIsGameStarting(true);
		try {
			const response = await fetch('/api/games', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ quizId: selectedQuizId }),
			});
			const result = (await response.json()) as ApiResponse<GameState>;
			if (result.success && result.data) {
				if ('error' in result.data) {
					throw new Error((result.data as any).error);
				}
				if (result.data.id && result.data.hostSecret) {
					addSecret(result.data.id, result.data.hostSecret);
					toast.success('New game created!');
					navigate(`/host/${result.data.id}`);
				} else {
					throw new Error('Game created, but missing ID or secret.');
				}
			} else {
				throw new Error(result.error || 'Failed to create game');
			}
		} catch (error: any) {
			console.error(error);
			toast.error(error.message || 'Could not start a new game. Please try again.');
			setIsGameStarting(false);
		}
	};

	const handleDeleteQuiz = async () => {
		if (!quizToDelete) return;
		try {
			const res = await fetch(`/api/quizzes/custom/${quizToDelete}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to delete quiz');
			toast.success('Quiz deleted!');
			if (selectedQuizId === quizToDelete) setSelectedQuizId(null);
			fetchQuizzes();
		} catch (err) {
			toast.error('Could not delete quiz.');
		} finally {
			setQuizToDelete(null);
		}
	};

	const getStatusMessage = (status: { stage: string; detail?: string } | null): string => {
		if (!status) return 'Preparing...';
		switch (status.stage) {
			case 'researching':
				return `Researching ${status.detail || 'topic'}...`;
			case 'reading_docs':
				return `Reading documentation for ${status.detail || 'topic'}...`;
			case 'generating':
				return 'Generating quiz questions...';
			default:
				return 'Processing...';
		}
	};

	const handleGenerateAiQuiz = async () => {
		const result = aiPromptSchema.safeParse(aiPrompt);
		if (!result.success) {
			toast.error(z.prettifyError(result.error));
			return;
		}

		const prompt = aiPrompt.trim();
		setGeneratingPrompt(prompt);
		setIsGenerating(true);
		setGenerationStatus(null);
		setAiPrompt('');
		setIsAiDialogOpen(false);

		try {
			const response = await fetch('/api/quizzes/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, numQuestions: 5 }),
			});

			if (!response.ok || !response.body) {
				throw new Error('Failed to start quiz generation');
			}

			// Parse SSE stream
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				let currentEvent = '';
				for (const line of lines) {
					if (line.startsWith('event: ')) {
						currentEvent = line.slice(7);
					} else if (line.startsWith('data: ')) {
						const data = JSON.parse(line.slice(6));

						if (currentEvent === 'status') {
							setGenerationStatus(data);
						} else if (currentEvent === 'complete') {
							const apiResult = data as ApiResponse<Quiz>;
							if (apiResult.success && apiResult.data) {
								toast.success(`Quiz "${apiResult.data.title}" generated successfully!`);
								setSelectedQuizId(apiResult.data.id);
								fetchQuizzes();
							}
						} else if (currentEvent === 'error') {
							throw new Error(data.error || 'Failed to generate quiz');
						}
						currentEvent = '';
					}
				}
			}
		} catch (error: any) {
			console.error(error);
			toast.error(error.message || 'Could not generate quiz. Please try again.');
		} finally {
			setIsGenerating(false);
			setGenerationStatus(null);
			setGeneratingPrompt(null);
		}
	};

	return (
		<div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-4 overflow-hidden relative">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-100/50 via-amber-50/30 to-slate-50 opacity-50 pointer-events-none" />
			<div className="text-center space-y-8 relative z-10 animate-fade-in w-full max-w-4xl pb-24">
				<div className="flex justify-center">
					<div className="w-24 h-24 rounded-full bg-gradient-to-br from-quiz-orange to-quiz-gold flex items-center justify-center shadow-lg animate-float">
						<Sparkles className="w-12 h-12 text-white animate-pulse" />
					</div>
				</div>
				<h1 className="text-5xl md:text-7xl font-display font-bold text-balance leading-tight">
					Welcome to <span className="text-quiz-orange">Timoot</span>
				</h1>
				<p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto text-pretty">
					Select a quiz to begin the fun, or create your own!
				</p>
				{isLoading ? (
					<Loader2 className="mx-auto h-12 w-12 animate-spin text-quiz-orange" />
				) : (
					<div className="space-y-8">
						<section>
							<h2 className="text-2xl font-bold text-left mb-4">Featured Quizzes</h2>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								{predefinedQuizzes.map((quiz, index) => (
									<motion.div
										key={quiz.id}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: index * 0.1 }}
									>
										<Card
											onClick={() => setSelectedQuizId(quiz.id)}
											className={cn(
												'cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl',
												selectedQuizId === quiz.id && 'ring-4 ring-quiz-orange shadow-xl',
											)}
										>
											<CardHeader>
												<CardTitle className="flex items-center justify-between">
													{quiz.title}
													{selectedQuizId === quiz.id && <CheckCircle className="w-6 h-6 text-quiz-orange" />}
												</CardTitle>
											</CardHeader>
										</Card>
									</motion.div>
								))}
							</div>
						</section>
						<section>
							<h2 className="text-2xl font-bold text-left mb-4">Your Quizzes</h2>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								{customQuizzes.map((quiz, index) => (
									<motion.div
										key={quiz.id}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: (predefinedQuizzes.length + index) * 0.1 }}
									>
										<Card
											onClick={() => setSelectedQuizId(quiz.id)}
											className={cn(
												'cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl',
												selectedQuizId === quiz.id && 'ring-4 ring-quiz-orange shadow-xl',
											)}
										>
											<CardHeader>
												<CardTitle className="flex items-center justify-between">
													<span className="truncate pr-2">{quiz.title}</span>
													<div className="flex items-center shrink-0">
														{selectedQuizId === quiz.id && <CheckCircle className="w-6 h-6 text-quiz-orange mr-2" />}
														<Button
															variant="ghost"
															size="icon"
															onClick={(e) => {
																e.stopPropagation();
																navigate(`/edit/${quiz.id}`);
															}}
														>
															<Pencil className="w-4 h-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															onClick={(e) => {
																e.stopPropagation();
																setQuizToDelete(quiz.id);
															}}
															className="text-red-500 hover:text-red-700"
														>
															<Trash2 className="w-4 h-4" />
														</Button>
													</div>
												</CardTitle>
											</CardHeader>
										</Card>
									</motion.div>
								))}
								{isGenerating && (
									<motion.div
										key="generating"
										initial={{ opacity: 0, scale: 0.9 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ type: 'spring', stiffness: 300, damping: 25 }}
									>
										<Card className="rounded-2xl border-2 border-quiz-orange/30 bg-gradient-to-br from-quiz-orange/10 to-quiz-gold/10 min-h-[95px]">
											<CardHeader className="pb-2">
												<CardTitle className="flex items-center gap-2 text-quiz-orange">
													<Wand2 className="w-5 h-5 animate-pulse" />
													<span className="truncate">{generatingPrompt}</span>
												</CardTitle>
											</CardHeader>
											<div className="px-6 pb-4">
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<Loader2 className="h-4 w-4 animate-spin text-quiz-orange shrink-0" />
													<span className="truncate">{getStatusMessage(generationStatus)}</span>
												</div>
											</div>
										</Card>
									</motion.div>
								)}
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: (predefinedQuizzes.length + customQuizzes.length) * 0.1 }}
								>
									<Card
										onClick={() => navigate('/edit')}
										className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl border-dashed border-2 flex items-center justify-center h-full min-h-[95px]"
									>
										<div className="flex items-center text-muted-foreground">
											<PlusCircle className="w-6 h-6 mr-2" /> Create New Quiz
										</div>
									</Card>
								</motion.div>
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: (predefinedQuizzes.length + customQuizzes.length + 1) * 0.1 }}
								>
									<Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
										<DialogTrigger asChild>
											<Card className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl border-dashed border-2 border-quiz-orange/50 flex items-center justify-center h-full min-h-[95px] bg-gradient-to-br from-quiz-orange/5 to-quiz-gold/5">
												<div className="flex items-center text-quiz-orange font-medium">
													<Wand2 className="w-6 h-6 mr-2" /> Generate with AI
												</div>
											</Card>
										</DialogTrigger>
										<DialogContent className="sm:max-w-[425px]">
											<DialogHeader>
												<DialogTitle className="flex items-center gap-2">
													<Wand2 className="w-5 h-5 text-quiz-orange" />
													Generate Quiz with AI
												</DialogTitle>
												<DialogDescription>
													Describe the topic or theme for your quiz and AI will create engaging questions for you.
												</DialogDescription>
											</DialogHeader>
											<div className="grid gap-4 py-4">
												<div className="grid gap-2">
													<Label htmlFor="ai-prompt">Topic or Prompt</Label>
													<Input
														id="ai-prompt"
														placeholder="JavaScript basics, Famous artists, Holiday movies..."
														value={aiPrompt}
														onChange={(e) => setAiPrompt(e.target.value)}
														onKeyDown={(e) => e.key === 'Enter' && handleGenerateAiQuiz()}
														className="col-span-3"
														maxLength={LIMITS.AI_PROMPT_MAX}
													/>
													<p className="text-xs text-muted-foreground mt-1">
														{aiPrompt.length}/{LIMITS.AI_PROMPT_MAX} characters
													</p>
												</div>
											</div>
											<DialogFooter>
												<Button
													onClick={handleGenerateAiQuiz}
													disabled={aiPrompt.trim().length < LIMITS.AI_PROMPT_MIN}
													className="bg-quiz-orange hover:bg-quiz-orange/90"
												>
													<Wand2 className="mr-2 h-4 w-4" />
													Generate Quiz
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								</motion.div>
							</div>
						</section>
					</div>
				)}
				<div className="flex justify-center gap-4 pt-4">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="inline-block">
									<Button
										size="lg"
										onClick={handleStartGame}
										disabled={isGameStarting || !selectedQuizId}
										className="bg-quiz-orange hover:bg-quiz-orange/90 text-white px-12 py-8 text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95"
									>
										{isGameStarting ? <Loader2 className="mr-2 h-8 w-8 animate-spin" /> : 'Start Selected Quiz'}
									</Button>
								</div>
							</TooltipTrigger>
							{!selectedQuizId && (
								<TooltipContent>
									<p>Please select a quiz first!</p>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
				</div>
			</div>
			<footer className="absolute bottom-8 text-center text-muted-foreground/80">
				<p>Built with ❤️ at Cloudflare</p>
			</footer>

			{/* Delete Quiz Confirmation Dialog */}
			<AlertDialog open={!!quizToDelete} onOpenChange={(open) => !open && setQuizToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Quiz</AlertDialogTitle>
						<AlertDialogDescription>Are you sure you want to delete this quiz? This action cannot be undone.</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteQuiz} className="bg-red-500 hover:bg-red-600">
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Toaster richColors closeButton />
		</div>
	);
}
