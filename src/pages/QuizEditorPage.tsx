import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PlusCircle, Trash2, Loader2, Save, ArrowLeft, ChevronUp, ChevronDown, Wand2, Zap } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import type { ApiResponse, Quiz, Question } from '@shared/types';
import { quizFormSchema, LIMITS, type QuizFormInput } from '@shared/validation';
import { Checkbox } from '@/components/ui/checkbox';

type QuizFormData = {
	title: string;
	questions: Question[];
};

type QuestionFormInput = QuizFormInput['questions'][number];
export function QuizEditorPage() {
	const { quizId } = useParams<{ quizId?: string }>();
	const navigate = useNavigate();
	const {
		register,
		control,
		handleSubmit,
		reset,
		getValues,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<QuizFormInput>({
		resolver: zodResolver(quizFormSchema),
		defaultValues: { title: '', questions: [] },
	});
	const { fields, append, remove, update, move } = useFieldArray({ control, name: 'questions' });
	const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
	useEffect(() => {
		if (quizId) {
			const fetchQuiz = async () => {
				try {
					const response = await fetch(`/api/quizzes/custom/${quizId}`);
					const result = (await response.json()) as ApiResponse<Quiz>;
					if (result.success && result.data) {
						const formData: QuizFormInput = {
							...result.data,
							questions: result.data.questions.map((q) => ({
								...q,
								correctAnswerIndex: String(q.correctAnswerIndex),
							})),
						};
						reset(formData);
					} else {
						throw new Error(result.error || 'Failed to fetch quiz');
					}
				} catch (error) {
					toast.error('Could not load quiz for editing.');
					navigate('/edit');
				}
			};
			fetchQuiz();
		} else {
			reset({ title: '', questions: [{ text: '', options: ['', ''], correctAnswerIndex: '0', isDoublePoints: false }] });
		}
	}, [quizId, reset, navigate]);
	const onSubmit: SubmitHandler<QuizFormInput> = async (data) => {
		try {
			const processedData: QuizFormData = {
				...data,
				questions: data.questions.map((q) => ({
					text: q.text,
					options: q.options,
					correctAnswerIndex: parseInt(q.correctAnswerIndex, 10),
					isDoublePoints: q.isDoublePoints,
				})),
			};
			const url = quizId ? `/api/quizzes/custom/${quizId}` : '/api/quizzes/custom';
			const method = quizId ? 'PUT' : 'POST';
			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...processedData, id: quizId }),
			});
			const result = (await response.json()) as ApiResponse<Quiz>;
			if (!response.ok || !result.success) {
				throw new Error(result.error || 'Failed to save quiz');
			}
			toast.success(`Quiz "${result.data?.title}" saved successfully!`);
			navigate('/');
		} catch (error) {
			if (error instanceof Error) {
				toast.error(error.message);
			} else {
				toast.error(String(error));
			}
		}
	};
	const addQuestion = () => append({ text: '', options: ['', ''], correctAnswerIndex: '0', isDoublePoints: false });

	const generateQuestion = async () => {
		const title = getValues('title');
		if (!title.trim()) {
			toast.error('Please enter a quiz title first');
			return;
		}

		const currentQuestions = getValues('questions');
		if (currentQuestions.length >= LIMITS.QUESTIONS_MAX) {
			toast.error(`Cannot add more than ${LIMITS.QUESTIONS_MAX} questions`);
			return;
		}

		setIsGeneratingQuestion(true);
		try {
			const response = await fetch('/api/quizzes/generate-question', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					existingQuestions: currentQuestions.map((q) => ({
						text: q.text,
						options: q.options,
						correctAnswerIndex: Number(q.correctAnswerIndex),
					})),
				}),
			});

			const result = (await response.json()) as ApiResponse<Question>;
			if (!response.ok || !result.success || !result.data) {
				throw new Error(result.error || 'Failed to generate question');
			}

			append({
				text: result.data.text,
				options: result.data.options,
				correctAnswerIndex: String(result.data.correctAnswerIndex),
				isDoublePoints: false,
			});
			toast.success('Question generated!');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to generate question');
		} finally {
			setIsGeneratingQuestion(false);
		}
	};
	const addOption = (qIndex: number) => {
		const currentQuestion = getValues(`questions.${qIndex}`);
		if (currentQuestion.options.length < LIMITS.OPTIONS_MAX) {
			update(qIndex, {
				...currentQuestion,
				options: [...currentQuestion.options, ''],
			});
		}
	};
	const removeOption = (qIndex: number, oIndex: number) => {
		const currentQuestion = getValues(`questions.${qIndex}`);
		if (currentQuestion.options.length > LIMITS.OPTIONS_MIN) {
			const newOptions = currentQuestion.options.filter((_, i) => i !== oIndex);
			const currentCorrect = parseInt(currentQuestion.correctAnswerIndex, 10);
			const newCorrect =
				currentCorrect === oIndex
					? 0 // If the deleted option was correct, default to the first option
					: currentCorrect > oIndex
						? currentCorrect - 1 // If a preceding option was deleted, shift index down
						: currentCorrect;
			update(qIndex, {
				...currentQuestion,
				options: newOptions,
				correctAnswerIndex: String(newCorrect),
			});
		}
	};
	const moveOption = (qIndex: number, oIndex: number, direction: 'up' | 'down') => {
		const currentQuestion = getValues(`questions.${qIndex}`);
		const newIndex = direction === 'up' ? oIndex - 1 : oIndex + 1;
		if (newIndex < 0 || newIndex >= currentQuestion.options.length) return;

		const newOptions = [...currentQuestion.options];
		[newOptions[oIndex], newOptions[newIndex]] = [newOptions[newIndex], newOptions[oIndex]];

		// Update correctAnswerIndex if the correct answer was moved
		const currentCorrect = parseInt(currentQuestion.correctAnswerIndex, 10);
		let newCorrect = currentCorrect;
		if (currentCorrect === oIndex) {
			newCorrect = newIndex;
		} else if (currentCorrect === newIndex) {
			newCorrect = oIndex;
		}

		update(qIndex, {
			...currentQuestion,
			options: newOptions,
			correctAnswerIndex: String(newCorrect),
		});
	};
	return (
		<div className="min-h-screen bg-slate-50">
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
					<div className="flex justify-between items-center">
						<div className="flex items-center gap-4">
							<Link to="/">
								<Button type="button" variant="outline" size="icon">
									<ArrowLeft className="h-5 w-5" />
								</Button>
							</Link>
							<h1 className="text-2xl sm:text-4xl font-display font-bold">{quizId ? 'Edit Quiz' : 'Create a New Quiz'}</h1>
						</div>
						<Button type="submit" disabled={isSubmitting} size="lg" className="bg-quiz-orange hover:bg-quiz-orange/90">
							{isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
							Save Quiz
						</Button>
					</div>
					<Card className="rounded-2xl shadow-lg">
						<CardHeader>
							<CardTitle>Quiz Details</CardTitle>
						</CardHeader>
						<CardContent>
							<Label htmlFor="title">Quiz Title</Label>
							<div className="relative">
								<Input
									id="title"
									{...register('title')}
									placeholder="e.g., 'Fun Facts Friday'"
									className="text-lg pr-16"
									maxLength={LIMITS.QUIZ_TITLE_MAX}
								/>
								<span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
									{watch('title')?.length || 0}/{LIMITS.QUIZ_TITLE_MAX}
								</span>
							</div>
							{errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
						</CardContent>
					</Card>
					{fields.map((field, qIndex) => (
						<Card key={field.id} className="rounded-2xl shadow-lg">
							<CardHeader className="flex flex-row items-center justify-between">
								<CardTitle>Question {qIndex + 1}</CardTitle>
								<div className="flex items-center gap-2">
									<Controller
										control={control}
										name={`questions.${qIndex}.isDoublePoints`}
										render={({ field }) => (
											<button
												type="button"
												onClick={() => field.onChange(!field.value)}
												className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
													field.value
														? 'bg-gradient-to-r from-quiz-orange to-amber-500 text-white shadow-md'
														: 'bg-muted text-muted-foreground hover:bg-muted/80'
												}`}
											>
												<Zap className={`h-4 w-4 ${field.value ? 'fill-current' : ''}`} />
												2× Points
											</button>
										)}
									/>
									<div className="flex items-center gap-1 border-l pl-2 ml-1">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => move(qIndex, qIndex - 1)}
											disabled={qIndex === 0}
											className="text-muted-foreground"
										>
											<ChevronUp className="h-5 w-5" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => move(qIndex, qIndex + 1)}
											disabled={qIndex === fields.length - 1}
											className="text-muted-foreground"
										>
											<ChevronDown className="h-5 w-5" />
										</Button>
										<AlertDialog>
											<AlertDialogTrigger asChild>
												<Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
													<Trash2 />
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>Delete Question {qIndex + 1}?</AlertDialogTitle>
													<AlertDialogDescription>This will permanently remove this question and all its options.</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Cancel</AlertDialogCancel>
													<AlertDialogAction onClick={() => remove(qIndex)} className="bg-red-500 hover:bg-red-600">
														Delete
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<Label>Question Text</Label>
									<div className="relative">
										<Input
											{...register(`questions.${qIndex}.text`)}
											placeholder="What is...?"
											maxLength={LIMITS.QUESTION_TEXT_MAX}
											className="pr-16"
										/>
										<span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
											{watch(`questions.${qIndex}.text`)?.length || 0}/{LIMITS.QUESTION_TEXT_MAX}
										</span>
									</div>
									{errors.questions?.[qIndex]?.text && (
										<p className="text-red-500 text-sm mt-1">{errors.questions[qIndex]?.text?.message}</p>
									)}
								</div>
								<div>
									<Label>Answers</Label>
									<Controller
										control={control}
										name={`questions.${qIndex}.correctAnswerIndex`}
										render={({ field: { onChange, value } }) => (
											<RadioGroup onValueChange={onChange} value={String(value)} className="space-y-2 mt-2">
												{getValues(`questions.${qIndex}.options`).map((_, oIndex) => (
													<div key={`${field.id}-option-${oIndex}`} className="flex items-center gap-2">
														<div className="flex flex-col">
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="h-5 w-5 text-muted-foreground"
																onClick={() => moveOption(qIndex, oIndex, 'up')}
																disabled={oIndex === 0}
															>
																<ChevronUp className="h-3 w-3" />
															</Button>
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="h-5 w-5 text-muted-foreground"
																onClick={() => moveOption(qIndex, oIndex, 'down')}
																disabled={oIndex === getValues(`questions.${qIndex}.options`).length - 1}
															>
																<ChevronDown className="h-3 w-3" />
															</Button>
														</div>
														<RadioGroupItem value={String(oIndex)} id={`q${qIndex}o${oIndex}`} />
														<div className="flex-grow relative">
															<Input
																{...register(`questions.${qIndex}.options.${oIndex}`)}
																placeholder={`Option ${oIndex + 1}`}
																maxLength={LIMITS.OPTION_TEXT_MAX}
																className="pr-14"
															/>
															<span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
																{watch(`questions.${qIndex}.options.${oIndex}`)?.length || 0}/{LIMITS.OPTION_TEXT_MAX}
															</span>
														</div>
														{getValues(`questions.${qIndex}.options`).length > LIMITS.OPTIONS_MIN && (
															<Button
																type="button"
																variant="ghost"
																size="icon"
																onClick={() => removeOption(qIndex, oIndex)}
																className="text-muted-foreground hover:text-destructive"
															>
																<Trash2 className="w-4 h-4" />
															</Button>
														)}
													</div>
												))}
											</RadioGroup>
										)}
									/>
									{errors.questions?.[qIndex]?.options && <p className="text-red-500 text-sm mt-1">Each option must have text.</p>}
									{errors.questions?.[qIndex]?.correctAnswerIndex && (
										<p className="text-red-500 text-sm mt-1">{errors.questions[qIndex]?.correctAnswerIndex?.message}</p>
									)}
								</div>
								{getValues(`questions.${qIndex}.options`).length < LIMITS.OPTIONS_MAX && (
									<Button type="button" variant="outline" onClick={() => addOption(qIndex)}>
										<PlusCircle className="mr-2 h-4 w-4" /> Add Option
									</Button>
								)}
							</CardContent>
						</Card>
					))}
					<div className="flex gap-3">
						<Button type="button" onClick={addQuestion} variant="secondary" size="lg" className="flex-1">
							<PlusCircle className="mr-2 h-5 w-5" /> Add Question
						</Button>
						<Button
							type="button"
							onClick={generateQuestion}
							disabled={isGeneratingQuestion}
							variant="outline"
							size="lg"
							className="flex-1 border-quiz-orange/50 text-quiz-orange hover:bg-quiz-orange/10 hover:text-quiz-orange"
						>
							{isGeneratingQuestion ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
							Generate with AI
						</Button>
					</div>
				</form>
			</div>
			<Toaster richColors />
		</div>
	);
}
