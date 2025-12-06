import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { nicknameSchema, LIMITS } from '@shared/validation';

const formSchema = z.object({
	nickname: nicknameSchema,
});

type FormData = z.infer<typeof formSchema>;
interface PlayerNicknameFormProps {
	onJoin: (nickname: string) => void;
	isLoading: boolean;
}
export function PlayerNicknameForm({ onJoin, isLoading }: PlayerNicknameFormProps) {
	const {
		register,
		handleSubmit,
		watch,
		formState: { errors, isValid },
	} = useForm<FormData>({
		resolver: zodResolver(formSchema),
		mode: 'onChange',
		defaultValues: { nickname: '' },
	});

	const nickname = watch('nickname');

	const onSubmit = (data: FormData) => {
		onJoin(data.nickname);
	};
	return (
		<div className="min-h-screen w-full flex items-center justify-center bg-slate-800 p-4">
			<Card className="w-full max-w-md shadow-2xl rounded-2xl animate-scale-in bg-slate-700 border-slate-600">
				<CardHeader className="text-center">
					<CardTitle className="text-4xl font-display text-white">Enter a Nickname</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
						<div>
							<Input
								{...register('nickname')}
								placeholder="Your cool name"
								className="text-center text-2xl h-16 bg-slate-600 border-slate-500 text-white placeholder:text-slate-400"
								disabled={isLoading}
								maxLength={LIMITS.NICKNAME_MAX}
								autoComplete="off"
							/>
							{errors.nickname && <p className="text-red-400 text-sm mt-2 text-center">{errors.nickname.message}</p>}
						</div>
						<Button
							type="submit"
							className="w-full text-xl py-6 rounded-xl bg-quiz-orange hover:bg-quiz-orange/90"
							size="lg"
							disabled={isLoading || !isValid || !nickname?.trim()}
						>
							{isLoading ? 'Joining...' : 'Join Game'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
