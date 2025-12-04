import { useCallback, useEffect, useRef } from 'react';
// This is a placeholder hook. In a real app, you would have sound files.
// We are building the logic to play them if they existed.
const sounds = {
	join: '/sounds/join.mp3',
	correct: '/sounds/correct.mp3',
	incorrect: '/sounds/incorrect.mp3',
	tick: '/sounds/tick.mp3',
	gameStart: '/sounds/game-start.mp3',
};
type SoundEvent = keyof typeof sounds;
export function useSound() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	useEffect(() => {
		// Pre-create the audio element to be reused.
		// This can help with performance and browser restrictions on audio playback.
		audioRef.current = new Audio();
		audioRef.current.volume = 0.5;
		return () => {
			// Cleanup
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
		};
	}, []);
	const playSound = useCallback((sound: SoundEvent) => {
		if (audioRef.current) {
			// In a real application, you would uncomment the following lines.
			// For this simulation, we will log to the console instead.
			// audioRef.current.src = sounds[sound];
			// audioRef.current.play().catch(error => {
			//   console.error(`Could not play sound: ${sound}`, error);
			// });
			console.log(`[SOUND] Playing sound: ${sound} at ${sounds[sound]}`);
		}
	}, []);
	return { playSound };
}
