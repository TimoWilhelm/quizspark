import { cn } from '@/lib/utils';
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
interface PlayerAnswerScreenProps {
	onAnswer: (index: number) => void;
	submittedAnswer: number | null;
	optionIndices: number[];
}
export function PlayerAnswerScreen({ onAnswer, submittedAnswer, optionIndices }: PlayerAnswerScreenProps) {
	return (
		<div className="gap-4 w-full h-full grid grid-cols-2 grid-rows-2 animate-scale-in">
			{optionIndices.map((originalIndex) => (
				<button
					key={originalIndex}
					onClick={() => onAnswer(originalIndex)}
					disabled={submittedAnswer !== null}
					className={cn(
						'rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ease-in-out',
						shapeColors[originalIndex],
						submittedAnswer === null && 'hover:scale-105 active:scale-95',
						submittedAnswer !== null && originalIndex !== submittedAnswer && 'scale-0 opacity-0 pointer-events-none',
						submittedAnswer === originalIndex && 'col-span-2 row-span-2 ring-4 ring-white ring-offset-4 ring-offset-slate-800',
					)}
				>
					<svg viewBox="0 0 24 24" className="w-1/2 h-1/2 text-white fill-current">
						<path d={shapePaths[originalIndex]} />
					</svg>
				</button>
			))}
		</div>
	);
}
