import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
interface PlayerNicknameFormProps {
	onJoin: (nickname: string) => void;
	isLoading: boolean;
}
export function PlayerNicknameForm({ onJoin, isLoading }: PlayerNicknameFormProps) {
	const [nickname, setNickname] = useState('');
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (nickname.trim()) {
			onJoin(nickname.trim());
		}
	};
	return (
		<div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
			<Card className="w-full max-w-md shadow-2xl rounded-2xl animate-scale-in">
				<CardHeader className="text-center">
					<CardTitle className="text-4xl font-display">Enter a Nickname</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<Input
							placeholder="Your cool name"
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							className="text-center text-2xl h-16"
							disabled={isLoading}
						/>
						<Button
							type="submit"
							className="w-full text-xl py-6 rounded-xl bg-quiz-blue hover:bg-quiz-blue/90"
							size="lg"
							disabled={isLoading || !nickname.trim()}
						>
							{isLoading ? 'Joining...' : 'Join Game'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
