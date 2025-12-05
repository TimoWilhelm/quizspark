import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Colorblind-safe palette - vibrant yet readable
const shapeColors = [
	'bg-[#F59E0B]', // Triangle - Golden Amber
	'bg-[#3B82F6]', // Diamond - Sky Blue
	'bg-[#14B8A6]', // Circle - Cyan Teal
	'bg-[#EC4899]', // Square - Hot Pink
];
const shapePaths = [
	'M12 2L2 22h20L12 2z', // Triangle
	'M12 2l10 10-10 10-10-10L12 2z', // Diamond
	'M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z', // Circle
	'M2 2h20v20H2V2z', // Square
];

interface CountdownTimerProps {
	timeLeft: number;
	totalTime: number;
}

function CountdownTimer({ timeLeft, totalTime }: CountdownTimerProps) {
	const progress = timeLeft / totalTime;
	const isUrgent = timeLeft <= 5;
	const isCritical = timeLeft <= 3;

	// Circle properties
	const size = 120;
	const strokeWidth = 8;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = circumference * (1 - progress);

	// Color transitions based on time remaining
	const getColor = () => {
		if (timeLeft <= 3) return { stroke: '#dc2626', text: 'text-red-600', glow: 'rgba(220, 38, 38, 0.5)' };
		if (timeLeft <= 5) return { stroke: '#f59e0b', text: 'text-amber-500', glow: 'rgba(245, 158, 11, 0.4)' };
		if (timeLeft <= 10) return { stroke: '#eab308', text: 'text-yellow-500', glow: 'rgba(234, 179, 8, 0.3)' };
		return { stroke: '#22c55e', text: 'text-green-500', glow: 'rgba(34, 197, 94, 0.3)' };
	};

	const colors = getColor();

	return (
		<motion.div
			className="relative"
			animate={
				isCritical
					? {
							scale: [1, 1.05, 1],
							rotate: [-1, 1, -1],
						}
					: isUrgent
						? { scale: [1, 1.02, 1] }
						: {}
			}
			transition={
				isCritical
					? { duration: 0.3, repeat: Infinity, ease: 'easeInOut' }
					: isUrgent
						? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
						: {}
			}
		>
			{/* Glow effect for urgency */}
			<AnimatePresence>
				{isUrgent && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: [0.5, 1, 0.5] }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
						className="absolute inset-0 rounded-full"
						style={{
							boxShadow: `0 0 ${isCritical ? '40px' : '25px'} ${colors.glow}`,
						}}
					/>
				)}
			</AnimatePresence>

			{/* Background circle container */}
			<div className="relative bg-white rounded-full shadow-lg flex items-center justify-center" style={{ width: size, height: size }}>
				{/* SVG Progress Ring */}
				<svg className="absolute inset-0 -rotate-90" width={size} height={size}>
					{/* Background track */}
					<circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
					{/* Progress arc */}
					<motion.circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke={colors.stroke}
						strokeWidth={strokeWidth}
						strokeLinecap="round"
						strokeDasharray={circumference}
						initial={{ strokeDashoffset: 0 }}
						animate={{ strokeDashoffset }}
						transition={{ duration: 0.25, ease: 'linear' }}
					/>
				</svg>

				{/* Timer number */}
				<AnimatePresence mode="wait">
					<motion.span
						key={timeLeft}
						initial={{ scale: 1.4, opacity: 0, y: -10 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.8, opacity: 0, y: 10 }}
						transition={{ type: 'spring', stiffness: 500, damping: 30 }}
						className={`text-4xl sm:text-5xl font-bold tabular-nums ${colors.text} transition-colors duration-300`}
					>
						{timeLeft}
					</motion.span>
				</AnimatePresence>
			</div>

			{/* Pulse rings for critical time */}
			<AnimatePresence>
				{isCritical && (
					<>
						<motion.div
							initial={{ scale: 1, opacity: 0.6 }}
							animate={{ scale: 1.5, opacity: 0 }}
							transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
							className="absolute inset-0 rounded-full border-2 border-red-500"
						/>
						<motion.div
							initial={{ scale: 1, opacity: 0.4 }}
							animate={{ scale: 1.8, opacity: 0 }}
							transition={{ duration: 1, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
							className="absolute inset-0 rounded-full border-2 border-red-400"
						/>
					</>
				)}
			</AnimatePresence>
		</motion.div>
	);
}

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
			const elapsedMs = Date.now() - startTime;
			const elapsedSeconds = Math.floor(elapsedMs / 1000);
			const remaining = Math.max(0, timeLimitSec - elapsedSeconds);
			setTimeLeft(remaining);
			if (elapsedMs >= timeLimitMs) {
				clearInterval(timer);
				onNext();
			}
		}, 100);
		return () => clearInterval(timer);
	}, [startTime, timeLimitSec, timeLimitMs, onNext]);
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
				<CountdownTimer timeLeft={timeLeft} totalTime={timeLimitSec} />
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
