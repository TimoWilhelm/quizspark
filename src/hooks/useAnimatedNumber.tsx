import { useMotionValue, animate, MotionValue } from 'framer-motion';
import { useEffect } from 'react';

/**
 * Hook that returns an animated motion value
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
