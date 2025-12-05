import React from 'react';
import { motion } from 'framer-motion';

const shapeColors = [
	'bg-quiz-red', // Triangle
	'bg-quiz-blue', // Diamond
	'bg-quiz-yellow', // Circle
	'bg-quiz-pink', // Square
];
const shapePaths = [
	'M12 2L2 22h20L12 2z', // Triangle
	'M12 2l10 10-10 10-10-10L12 2z', // Diamond
	'M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z', // Circle
	'M2 2h20v20H2V2z', // Square
];

interface HostQuestionProps {
	onNext: () => void;
	questionText: string;
	options: string[];
	questionIndex: number;
	totalQuestions: number;
	startTime: number;
	timeLimitMs: number;
	answeredCount: number;
	totalPlayers: number;
}

export function HostQuestion({
	onNext,
	questionText,
	options,
	questionIndex,
	totalQuestions,
	startTime,
	timeLimitMs,
	answeredCount,
	totalPlayers,
}: HostQuestionProps) {
	const timeLimitSec = timeLimitMs / 1000;
	const [timeLeft, setTimeLeft] = React.useState(timeLimitSec);

	React.useEffect(() => {
		const timer = setInterval(() => {
			const elapsed = (Date.now() - startTime) / 1000;
			const remaining = Math.max(0, timeLimitSec - elapsed);
			setTimeLeft(Math.ceil(remaining));
			if (remaining <= 0) {
				clearInterval(timer);
				onNext();
			}
		}, 250);
		return () => clearInterval(timer);
	}, [startTime, timeLimitSec, onNext]);
	return (
		<div className="flex-grow flex flex-col p-4 sm:p-8">
			<div className="flex justify-between items-center mb-4">
				<div className="flex flex-col">
					<span className="text-xl sm:text-2xl font-bold">
						Question {questionIndex + 1}/{totalQuestions}
					</span>
					<span className="text-sm text-muted-foreground">
						{answeredCount}/{totalPlayers} answered
					</span>
				</div>
				<motion.div
					key={timeLeft}
					initial={{ scale: 1.2, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ type: 'spring', stiffness: 500, damping: 30 }}
					className="text-4xl sm:text-5xl font-bold bg-white rounded-full w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shadow-lg"
				>
					{timeLeft}
				</motion.div>
			</div>
			<div className="flex-grow center bg-white rounded-2xl shadow-lg p-4 sm:p-8 mb-4 sm:mb-8">
				<h2 className="text-3xl sm:text-5xl font-bold text-center">{questionText}</h2>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
				{options.map((option, i) => (
					<motion.div
						key={i}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: i * 0.1 }}
						className={`flex items-center p-4 sm:p-6 rounded-2xl text-white font-bold text-xl sm:text-3xl shadow-md ${shapeColors[i]}`}
					>
						<svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-12 sm:h-12 mr-4 fill-current">
							<path d={shapePaths[i]} />
						</svg>
						{option}
					</motion.div>
				))}
			</div>
		</div>
	);
}
