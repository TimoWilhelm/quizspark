import { useMotionValue, useTransform, animate, motion } from 'framer-motion';
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
