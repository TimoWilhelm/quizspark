import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const shapeGradients = [
	'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)', // Triangle - Red
	'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)', // Diamond - Blue
	'linear-gradient(135deg, #facc15 0%, #eab308 50%, #ca8a04 100%)', // Circle - Yellow
	'linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)', // Square - Pink
];

const shapePaths = [
	'M12 2L2 22h20L12 2z', // Triangle
	'M12 2l10 10-10 10-10-10L12 2z', // Diamond
	'M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z', // Circle
	'M2 2h20v20H2V2z', // Square
];

const glowColors = ['#ef4444', '#3b82f6', '#facc15', '#ec4899'];

interface PlayerAnswerScreenProps {
	onAnswer: (index: number) => void;
	submittedAnswer: number | null;
	optionIndices: number[];
}

export function PlayerAnswerScreen({ onAnswer, submittedAnswer, optionIndices }: PlayerAnswerScreenProps) {
	const [showPulse, setShowPulse] = useState(false);

	// Trigger pulse animation after selection
	useEffect(() => {
		if (submittedAnswer !== null) {
			const timer = setTimeout(() => setShowPulse(true), 600);
			return () => clearTimeout(timer);
		}
		setShowPulse(false);
	}, [submittedAnswer]);

	// Calculate positions for 2x2 grid with rectangular buttons (wider horizontally)
	const getPosition = (displayIndex: number) => {
		const row = Math.floor(displayIndex / 2);
		const col = displayIndex % 2;
		return {
			top: `calc(${row * 50}% + 6px)`,
			left: `calc(${col * 50}% + 6px)`,
		};
	};

	return (
		<div className="w-[calc(100vw-2rem)] h-[calc(100vh-10rem)] max-w-2xl max-h-[500px] relative overflow-hidden">
			{/* Background glow effect when selected */}
			<AnimatePresence>
				{submittedAnswer !== null && (
					<motion.div
						initial={{ opacity: 0, scale: 0 }}
						animate={{ opacity: 0.4, scale: 3 }}
						transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
						className="absolute rounded-full blur-3xl pointer-events-none"
						style={{
							left: '25%',
							top: '25%',
							width: '50%',
							height: '50%',
							background: `radial-gradient(circle, ${glowColors[submittedAnswer]} 0%, transparent 70%)`,
						}}
					/>
				)}
			</AnimatePresence>

			{/* Answer buttons */}
			{optionIndices.map((originalIndex, displayIndex) => {
				const isSelected = submittedAnswer === originalIndex;
				const isOther = submittedAnswer !== null && !isSelected;
				const pos = getPosition(displayIndex);

				return (
					<motion.button
						key={originalIndex}
						onClick={() => submittedAnswer === null && onAnswer(originalIndex)}
						disabled={submittedAnswer !== null}
						initial={false}
						animate={
							isSelected
								? {
										opacity: 1,
										scale: 1,
										top: '10%',
										left: '10%',
										width: '80%',
										height: '80%',
										zIndex: 50,
										rotate: 0,
									}
								: isOther
									? {
											opacity: 0,
											scale: 0.3,
											rotate: displayIndex % 2 === 0 ? 20 : -20,
											zIndex: 1,
										}
									: {
											opacity: 1,
											scale: 1,
											top: pos.top,
											left: pos.left,
											width: 'calc(50% - 12px)',
											height: 'calc(50% - 12px)',
											zIndex: 1,
											rotate: 0,
										}
						}
						whileHover={
							submittedAnswer === null
								? {
										scale: 1.03,
										boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
									}
								: {}
						}
						whileTap={submittedAnswer === null ? { scale: 0.97 } : {}}
						transition={
							isSelected
								? {
										type: 'spring',
										stiffness: 180,
										damping: 22,
										mass: 1,
									}
								: isOther
									? {
											duration: 0.5,
											ease: [0.4, 0, 1, 1],
											delay: displayIndex * 0.03,
										}
									: {
											type: 'spring',
											stiffness: 300,
											damping: 25,
										}
						}
						className="absolute rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer"
						style={{
							top: pos.top,
							left: pos.left,
							width: 'calc(50% - 12px)',
							height: 'calc(50% - 12px)',
							background: shapeGradients[originalIndex],
							boxShadow: '0 10px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
						}}
					>
						{/* Inner glow */}
						<motion.div
							className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 rounded-2xl"
							animate={isSelected && showPulse ? { opacity: [0.1, 0.3, 0.1] } : {}}
							transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
						/>

						{/* Selection ring effect */}
						{isSelected && (
							<motion.div
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
								className="absolute inset-0 rounded-2xl ring-4 ring-white/50 ring-offset-4 ring-offset-transparent"
							/>
						)}

						{/* Pulsing rings for selected button */}
						{isSelected && showPulse && (
							<>
								<motion.div
									initial={{ opacity: 0.6, scale: 1 }}
									animate={{ opacity: 0, scale: 1.3 }}
									transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
									className="absolute inset-0 rounded-2xl border-2 border-white/40"
								/>
								<motion.div
									initial={{ opacity: 0.4, scale: 1 }}
									animate={{ opacity: 0, scale: 1.5 }}
									transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
									className="absolute inset-0 rounded-2xl border-2 border-white/30"
								/>
							</>
						)}

						{/* Shape icon */}
						<motion.svg
							viewBox="0 0 24 24"
							className="w-1/2 h-1/2 text-white fill-current drop-shadow-lg"
							animate={
								isSelected
									? {
											scale: [1, 1.1, 1],
											rotate: [0, 5, -5, 0],
										}
									: {}
							}
							transition={
								isSelected
									? {
											duration: 0.6,
											delay: 0.4,
											ease: 'easeInOut',
										}
									: {}
							}
						>
							<path d={shapePaths[originalIndex]} />
						</motion.svg>

						{/* Shimmer effect on hover */}
						{submittedAnswer === null && (
							<motion.div
								className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
								initial={{ x: '-200%' }}
								whileHover={{ x: '200%' }}
								transition={{ duration: 0.6 }}
							/>
						)}

						{/* Sparkle particles for selected */}
						{isSelected && showPulse && (
							<>
								{[...Array(6)].map((_, i) => (
									<motion.div
										key={i}
										className="absolute w-2 h-2 bg-white rounded-full"
										initial={{
											x: 0,
											y: 0,
											opacity: 1,
											scale: 0,
										}}
										animate={{
											x: Math.cos((i * Math.PI * 2) / 6) * 100,
											y: Math.sin((i * Math.PI * 2) / 6) * 100,
											opacity: [1, 0],
											scale: [0, 1, 0],
										}}
										transition={{
											duration: 1,
											delay: 0.6 + i * 0.1,
											ease: 'easeOut',
										}}
									/>
								))}
							</>
						)}
					</motion.button>
				);
			})}
		</div>
	);
}
