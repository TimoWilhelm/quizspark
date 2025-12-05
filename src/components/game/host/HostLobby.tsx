import { Users } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCode } from '@/components/game/QRCode';

interface HostLobbyProps {
	onStart: () => void;
	players: { id: string; name: string }[];
	gameId: string;
}

export function HostLobby({ onStart, players, gameId }: HostLobbyProps) {
	const joinUrl = `${window.location.origin}/play?gameId=${gameId}`;
	return (
		<div className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 space-y-6">
			<motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-bold text-center">
				Join the Game!
			</motion.h1>
			<div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full">
				<motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
					<Card className="p-4 sm:p-6 text-center shadow-lg rounded-2xl">
						<CardHeader className="p-2 sm:p-4">
							<CardTitle>Scan to Join</CardTitle>
						</CardHeader>
						<CardContent className="p-0">
							<QRCode value={joinUrl} size={256} />
							<p className="mt-4 text-xs sm:text-sm text-muted-foreground break-all">{joinUrl}</p>
						</CardContent>
					</Card>
				</motion.div>
			</div>
			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="w-full max-w-4xl">
				<Card className="rounded-2xl">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users /> Players ({players.length})
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-3 p-4 min-h-[60px]">
						<AnimatePresence>
							{players.map((p) => (
								<motion.div
									key={p.id}
									initial={{ opacity: 0, scale: 0.5 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.5 }}
									layout
									className="bg-quiz-pink text-white font-bold py-2 px-4 rounded-lg shadow"
								>
									{p.name}
								</motion.div>
							))}
						</AnimatePresence>
					</CardContent>
				</Card>
			</motion.div>
			<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
				<Button
					onClick={onStart}
					size="lg"
					className="bg-quiz-blue text-white text-2xl font-bold px-12 py-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95"
					disabled={players.length < 1}
				>
					Start Game
				</Button>
			</motion.div>
		</div>
	);
}
