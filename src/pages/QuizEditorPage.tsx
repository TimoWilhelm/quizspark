import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Loader2, Save, ArrowLeft } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import type { ApiResponse, Quiz } from '@shared/types';
const questionSchema = z.object({
  text: z.string().min(1, 'Question text is required.'),
  options: z.array(z.string().min(1, 'Option text is required.')).min(2).max(4),
  correctAnswerIndex: z.coerce.number({
    required_error: "A correct answer must be selected.",
  }),
});
const quizSchema = z.object({
  title: z.string().min(1, 'Quiz title is required.'),
  questions: z.array(questionSchema).min(1, 'A quiz must have at least one question.'),
});
type QuizFormInput = z.input<typeof quizSchema>;
type QuizFormData = z.output<typeof quizSchema>;
export function QuizEditorPage() {
  const { quizId } = useParams<{ quizId?: string }>();
  const navigate = useNavigate();
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<QuizFormInput, any, QuizFormData>({
    resolver: zodResolver(quizSchema),
    defaultValues: { title: '', questions: [] },
  });
  const { fields, append, remove, update } = useFieldArray({ control, name: 'questions' });
  useEffect(() => {
    if (quizId) {
      const fetchQuiz = async () => {
        try {
          const response = await fetch(`/api/quizzes/custom/${quizId}`);
          const result = await response.json() as ApiResponse<Quiz>;
          if (result.success && result.data) {
            // Transform correctAnswerIndex to string for the form
            const formData: QuizFormInput = {
              ...result.data,
              questions: result.data.questions.map(q => ({
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
      // Start a new quiz with one empty question
      reset({ title: '', questions: [{ text: '', options: ['', ''], correctAnswerIndex: '0' }] });
    }
  }, [quizId, reset, navigate]);
  const onSubmit: SubmitHandler<QuizFormInput> = async (data) => {
    try {
      const url = quizId ? `/api/quizzes/custom/${quizId}` : '/api/quizzes/custom';
      const method = quizId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, id: quizId }),
      });
      const result = await response.json() as ApiResponse<Quiz>;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save quiz');
      }
      toast.success(`Quiz "${result.data?.title}" saved successfully!`);
      navigate('/');
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  const addQuestion = () => append({ text: '', options: ['', ''], correctAnswerIndex: '0' });
  const addOption = (qIndex: number) => {
    const currentOptions = fields[qIndex].options;
    if (currentOptions.length < 4) {
      update(qIndex, { ...fields[qIndex], options: [...currentOptions, ''] });
    }
  };
  const removeOption = (qIndex: number, oIndex: number) => {
    const currentOptions = fields[qIndex].options;
    if (currentOptions.length > 2) {
      const newOptions = currentOptions.filter((_, i) => i !== oIndex);
      const currentCorrect = parseInt(fields[qIndex].correctAnswerIndex!, 10);
      const newCorrect = currentCorrect >= oIndex ? Math.max(0, currentCorrect - 1) : currentCorrect;
      update(qIndex, { ...fields[qIndex], options: newOptions, correctAnswerIndex: String(newCorrect) });
    }
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
            <Button type="submit" disabled={isSubmitting} size="lg" className="bg-quiz-blue hover:bg-quiz-blue/90">
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
              <Input id="title" {...register('title')} placeholder="e.g., 'Fun Facts Friday'" className="text-lg" />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
            </CardContent>
          </Card>
          {fields.map((field, qIndex) => (
            <Card key={field.id} className="rounded-2xl shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Question {qIndex + 1}</CardTitle>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(qIndex)} className="text-red-500 hover:text-red-700">
                  <Trash2 />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Question Text</Label>
                  <Input {...register(`questions.${qIndex}.text`)} placeholder="What is...?" />
                  {errors.questions?.[qIndex]?.text && <p className="text-red-500 text-sm mt-1">{errors.questions[qIndex]?.text?.message}</p>}
                </div>
                <div>
                  <Label>Answers</Label>
                  <Controller
                    control={control}
                    name={`questions.${qIndex}.correctAnswerIndex`}
                    render={({ field: { onChange, value } }) => (
                      <RadioGroup onValueChange={onChange} value={String(value)} className="space-y-2 mt-2">
                        {field.options.map((_, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <RadioGroupItem value={String(oIndex)} id={`q${qIndex}o${oIndex}`} />
                            <Input {...register(`questions.${qIndex}.options.${oIndex}`)} placeholder={`Option ${oIndex + 1}`} className="flex-grow" />
                            {field.options.length > 2 && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(qIndex, oIndex)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  />
                  {errors.questions?.[qIndex]?.options && <p className="text-red-500 text-sm mt-1">Each option must have text.</p>}
                  {errors.questions?.[qIndex]?.correctAnswerIndex && <p className="text-red-500 text-sm mt-1">{errors.questions[qIndex]?.correctAnswerIndex?.message}</p>}
                </div>
                {field.options.length < 4 && (
                  <Button type="button" variant="outline" onClick={() => addOption(qIndex)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          <Button type="button" onClick={addQuestion} variant="secondary" size="lg" className="w-full">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Question
          </Button>
        </form>
      </div>
      <Toaster richColors />
    </div>
  );
}