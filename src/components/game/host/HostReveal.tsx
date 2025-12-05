import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

interface HostRevealProps {
	onNext: () => void;
	questionText: string;
	options: string[];
	correctAnswerIndex: number;
	answerCounts: number[];
}

export function HostReveal({ onNext, questionText, options, correctAnswerIndex, answerCounts }: HostRevealProps) {
	const totalAnswers = answerCounts.reduce((a, b) => a + b, 0);
	return (
		<div className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 space-y-6">
			<h2 className="text-3xl sm:text-5xl font-bold text-center mb-4">{questionText}</h2>
			<div className="w-full max-w-4xl space-y-4">
				{options.map((option, i) => {
					const isCorrect = i === correctAnswerIndex;
					const count = answerCounts[i];
					const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
					return (
						<motion.div
							key={i}
							initial={{ opacity: 0, x: -50 }}
							animate={{
								opacity: 1,
								x: 0,
								scale: isCorrect ? [1, 1.03, 1] : 1,
							}}
							transition={{
								delay: i * 0.2,
								...(isCorrect && {
									scale: {
										repeat: Infinity,
										duration: 1.5,
										ease: 'easeInOut',
									},
								}),
							}}
							className={`p-4 rounded-lg shadow-md relative overflow-hidden ${isCorrect ? 'bg-green-100 border-2 border-green-500' : 'bg-white'}`}
						>
							<motion.div
								className="absolute top-0 left-0 h-full bg-green-300/50"
								initial={{ width: 0 }}
								animate={{ width: `${percentage}%` }}
								transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
							/>
							<div className="relative flex justify-between items-center font-bold text-lg sm:text-2xl">
								<span className="flex items-center">
									{option}
									{isCorrect && <CheckCircle className="w-6 h-6 text-green-600 ml-2" />}
								</span>
								<span>{count}</span>
							</div>
						</motion.div>
					);
				})}
			</div>
			<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
				<Button onClick={onNext} size="lg" className="bg-quiz-blue text-white text-2xl font-bold px-12 py-8 rounded-2xl">
					Next
				</Button>
			</motion.div>
		</div>
	);
}
