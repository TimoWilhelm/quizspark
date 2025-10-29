import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/lib/game-store';
import type { ApiResponse, GameState } from '@shared/types';
export function useGamePolling(gameId: string, enabled = true) {
  const setGameState = useGameStore(s => s.setGameState);
  const gameState = useGameStore(s => s.gameState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const fetchState = async () => {
      if (!gameId || gameId === 'null' || gameId === 'undefined') {
        setError('No game ID provided.');
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (!response.ok) {
          throw new Error(`Game not found or server error.`);
        }
        const result = await response.json() as ApiResponse<GameState>;
        if (result.success && result.data) {
          setGameState(result.data);
          setError(null);
        } else {
          throw new Error(result.error || 'Failed to fetch game state.');
        }
      } catch (err: any) {
        setError(err.message);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      } finally {
        setIsLoading(false);
      }
    };
    if (enabled) {
      fetchState(); // Initial fetch
      intervalRef.current = setInterval(fetchState, 1500);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [gameId, setGameState, enabled]);
  return { isLoading, error, gameState };
}