import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, Pencil, Trash2, PlusCircle, Wand2, BookOpen, HelpCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import type { ApiResponse, GameState, Quiz } from '@shared/types';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { aiPromptSchema, LIMITS } from '@shared/validation';
import { motion } from 'framer-motion';
import { useHostStore } from '@/lib/host-store';

export function HomePage() {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(false);
	const [isGameStarting, setIsGameStarting] = useState(false);
	const [predefinedQuizzes, setPredefinedQuizzes] = useState<Quiz[]>([]);
	const [customQuizzes, setCustomQuizzes] = useState<Quiz[]>([]);
	const [startingQuizId, setStartingQuizId] = useState<string | null>(null);
	const [aiPrompt, setAiPrompt] = useState('');
	const [isGenerating, setIsGenerating] = useState(false);
	const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
	const [generationStatus, setGenerationStatus] = useState<{ stage: string; detail?: string } | null>(null);
	const [generatingPrompt, setGeneratingPrompt] = useState<string | null>(null);
	const [quizToDelete, setQuizToDelete] = useState<string | null>(null);
	const addSecret = useHostStore((s) => s.addSecret);
	const generatingCardRef = useRef<HTMLDivElement>(null);

	const fetchQuizzes = async () => {
		setIsLoading(true);
		try {
			const [predefinedRes, customRes] = await Promise.all([fetch('/api/quizzes'), fetch('/api/quizzes/custom')]);
			const predefinedResult = (await predefinedRes.json()) as ApiResponse<Quiz[]>;
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

	const handleStartGame = async (quizId: string) => {
		if (isGameStarting) return;
		setIsGameStarting(true);
		setStartingQuizId(quizId);
		try {
			const response = await fetch('/api/games', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ quizId }),
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
			setStartingQuizId(null);
		}
	};

	const handleDeleteQuiz = async () => {
		if (!quizToDelete) return;
		try {
			const res = await fetch(`/api/quizzes/custom/${quizToDelete}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to delete quiz');
			toast.success('Quiz deleted!');
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

		// Scroll to generating card after state updates
		setTimeout(() => {
			generatingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 100);

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
								setCustomQuizzes((prev) => [...prev, apiResult.data!]);
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
		<div className="min-h-screen w-full flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden relative">
			{/* Background gradient */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-100/50 via-amber-50/30 to-slate-50 opacity-50 pointer-events-none" />
			{/* Main content */}
			<main className="flex-1 relative z-10 px-4 py-8 md:py-12">
				<div className="max-w-6xl mx-auto space-y-12 animate-fade-in">
					{/* Hero Section */}
					<header className="text-center space-y-6">
						<div className="flex justify-center">
							<div className="w-20 h-20 md:w-28 md:h-28 rounded-3xl bg-gradient-to-br from-quiz-orange to-quiz-gold flex items-center justify-center shadow-xl shadow-quiz-orange/20 animate-float">
								<Sparkles className="w-10 h-10 md:w-14 md:h-14 text-white" />
							</div>
						</div>
						<div className="space-y-3">
							<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-balance leading-tight">
								Welcome to <span className="text-gradient">Timoot</span>
							</h1>
							<p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
								Select a quiz to begin the fun, or create your own!
							</p>
						</div>
					</header>
					{isLoading ? (
						<div className="flex items-center justify-center py-20">
							<Loader2 className="h-16 w-16 animate-spin text-quiz-orange" />
						</div>
					) : (
						<div className="space-y-12">
							{/* Featured Quizzes Section */}
							<section>
								<div className="flex items-center gap-3 mb-6">
									<div className="w-10 h-10 rounded-xl bg-quiz-orange/10 flex items-center justify-center">
										<Zap className="w-5 h-5 text-quiz-orange" />
									</div>
									<div>
										<h2 className="text-2xl font-bold">Featured Quizzes</h2>
										<p className="text-sm text-muted-foreground">Curated quizzes ready to play</p>
									</div>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
									{predefinedQuizzes.map((quiz, index) => (
										<motion.div
											key={quiz.id}
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: index * 0.08 }}
										>
											<Card
												onClick={() => handleStartGame(quiz.id)}
												className={cn(
													'group cursor-pointer transition-all duration-300 rounded-2xl border-2 h-full',
													'hover:shadow-xl hover:shadow-quiz-orange/10 hover:-translate-y-1',
													startingQuizId === quiz.id
														? 'border-quiz-orange bg-gradient-to-br from-quiz-orange/5 to-quiz-gold/5 shadow-lg shadow-quiz-orange/10'
														: 'border-transparent hover:border-quiz-orange/30',
												)}
											>
												<CardHeader className="pb-3">
													<div className="flex items-start justify-between">
														<CardTitle className="text-xl group-hover:text-quiz-orange transition-colors flex items-center gap-2">
															{quiz.title}
															{startingQuizId === quiz.id && <Loader2 className="w-4 h-4 animate-spin" />}
														</CardTitle>
													</div>
												</CardHeader>
												<CardContent className="pt-0">
													<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
														<HelpCircle className="w-4 h-4" />
														<span>{quiz.questions.length} questions</span>
													</div>
												</CardContent>
											</Card>
										</motion.div>
									))}
								</div>
							</section>
							{/* Your Quizzes Section */}
							<section>
								<div className="flex items-center gap-3 mb-6">
									<div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
										<BookOpen className="w-5 h-5 text-blue-500" />
									</div>
									<div>
										<h2 className="text-2xl font-bold">Your Quizzes</h2>
										<p className="text-sm text-muted-foreground">Custom quizzes you've created</p>
									</div>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
									{customQuizzes.map((quiz, index) => (
										<motion.div
											key={quiz.id}
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: index * 0.08 }}
										>
											<Card
												onClick={() => handleStartGame(quiz.id)}
												className={cn(
													'group cursor-pointer transition-all duration-300 rounded-2xl border-2 h-full flex flex-col',
													'hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1',
													startingQuizId === quiz.id
														? 'border-quiz-orange bg-gradient-to-br from-quiz-orange/5 to-quiz-gold/5 shadow-lg shadow-quiz-orange/10'
														: 'border-transparent hover:border-blue-500/30',
												)}
											>
												<CardHeader className="pb-3">
													<div className="flex items-start justify-between">
														<CardTitle className="text-xl group-hover:text-quiz-orange transition-colors line-clamp-2">
															{quiz.title}
														</CardTitle>
													</div>
												</CardHeader>
												<CardContent className="pt-0 flex-1 flex flex-col justify-between">
													<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
														<HelpCircle className="w-4 h-4" />
														<span>{quiz.questions.length} questions</span>
													</div>
													<div className="flex items-center justify-end gap-1 mt-2">
														{startingQuizId === quiz.id ? (
															<Loader2 className="w-4 h-4 animate-spin text-quiz-orange" />
														) : (
															<div className="flex items-center gap-1 opacity-0 group-hover-always:opacity-100 transition-opacity">
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7"
																	onClick={(e) => {
																		e.stopPropagation();
																		navigate(`/edit/${quiz.id}`);
																	}}
																>
																	<Pencil className="w-3.5 h-3.5" />
																</Button>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7 text-red-500 hover:text-red-700"
																	onClick={(e) => {
																		e.stopPropagation();
																		setQuizToDelete(quiz.id);
																	}}
																>
																	<Trash2 className="w-3.5 h-3.5" />
																</Button>
															</div>
														)}
													</div>
												</CardContent>
											</Card>
										</motion.div>
									))}
									{/* AI Generating Card */}
									{isGenerating && (
										<motion.div
											ref={generatingCardRef}
											key="generating"
											initial={{ opacity: 0, scale: 0.9 }}
											animate={{
												opacity: 1,
												scale: 1,
												boxShadow: ['0 0 0 0 rgba(251, 146, 60, 0)', '0 0 0 8px rgba(251, 146, 60, 0.3)', '0 0 0 0 rgba(251, 146, 60, 0)'],
											}}
											transition={{
												opacity: { duration: 0.3 },
												scale: { type: 'spring', stiffness: 300, damping: 25 },
												boxShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
											}}
											className="rounded-2xl"
										>
											<Card className="rounded-2xl border-2 border-quiz-orange/50 bg-gradient-to-br from-quiz-orange/5 to-quiz-gold/5 h-full">
												<CardHeader className="pb-3">
													<div className="flex items-start justify-between">
														<CardTitle className="text-xl text-quiz-orange line-clamp-2">{generatingPrompt}</CardTitle>
														<div className="w-10 h-10 rounded-xl bg-quiz-orange/10 flex items-center justify-center shrink-0">
															<Sparkles className="w-5 h-5 text-quiz-orange animate-pulse" />
														</div>
													</div>
												</CardHeader>
												<CardContent className="pt-0">
													<div className="flex items-center gap-2 text-sm text-muted-foreground">
														<Loader2 className="h-4 w-4 animate-spin text-quiz-orange shrink-0" />
														<span className="truncate">{getStatusMessage(generationStatus)}</span>
													</div>
												</CardContent>
											</Card>
										</motion.div>
									)}

									{/* Create New Quiz Card */}
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: (customQuizzes.length + 1) * 0.08 }}
									>
										<Card
											onClick={() => navigate('/edit')}
											className="group cursor-pointer transition-all duration-300 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 h-full"
										>
											<CardHeader className="pb-3">
												<div className="flex items-start justify-between">
													<CardTitle className="text-xl text-slate-500 group-hover:text-blue-600 transition-colors">
														Create New Quiz
													</CardTitle>
													<div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors shrink-0">
														<PlusCircle className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
													</div>
												</div>
											</CardHeader>
											<CardContent className="pt-0">
												<p className="text-sm text-muted-foreground">Build your own quiz from scratch</p>
											</CardContent>
										</Card>
									</motion.div>

									{/* Generate with AI Card */}
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: (customQuizzes.length + 2) * 0.08 }}
									>
										<Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
											<DialogTrigger asChild>
												<Card className="group cursor-pointer transition-all duration-300 rounded-2xl border-2 border-dashed border-quiz-orange/40 hover:border-quiz-orange hover:shadow-xl hover:shadow-quiz-orange/10 hover:-translate-y-1 h-full bg-gradient-to-br from-quiz-orange/5 to-quiz-gold/5">
													<CardHeader className="pb-3">
														<div className="flex items-start justify-between">
															<CardTitle className="text-xl text-quiz-orange">Generate with AI</CardTitle>
															<div className="w-10 h-10 rounded-xl bg-quiz-orange/10 group-hover:bg-quiz-orange/20 flex items-center justify-center transition-colors shrink-0">
																<Wand2 className="w-5 h-5 text-quiz-orange" />
															</div>
														</div>
													</CardHeader>
													<CardContent className="pt-0">
														<p className="text-sm text-muted-foreground">Let AI create questions for any topic</p>
													</CardContent>
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
				</div>
			</main>

			{/* Footer */}
			<footer className="relative z-10 py-6 text-center text-muted-foreground/80 border-t border-slate-200/50">
				<p className="text-sm">Built with ❤️ at Cloudflare</p>
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
