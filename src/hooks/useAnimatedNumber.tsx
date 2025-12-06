import { useMotionValue, useTransform, animate, motion, MotionValue } from 'framer-motion';
import { useEffect } from 'react';

interface AnimatedNumberProps {
	value: number;
	className?: string;
	duration?: number;
}

/**
 * Animated number component that tweens between values using Framer Motion
 */
export function AnimatedNumber({ value, className, duration = 0.6 }: AnimatedNumberProps) {
	const motionValue = useMotionValue(value);
	const display = useTransform(motionValue, (current: number) => Math.round(current));

	useEffect(() => {
		const controls = animate(motionValue, value, {
			duration,
			ease: 'easeOut',
		});
		return () => controls.stop();
	}, [motionValue, value, duration]);

	return <motion.span className={className}>{display}</motion.span>;
}

/**
 * Hook version if you need just the animated value
 */
export function useAnimatedNumber(targetValue: number, duration = 0.6): MotionValue<number> {
	const motionValue = useMotionValue(targetValue);

	useEffect(() => {
		const controls = animate(motionValue, targetValue, {
			duration,
			ease: 'easeOut',
		});
		return () => controls.stop();
	}, [motionValue, targetValue, duration]);

	return motionValue;
}
