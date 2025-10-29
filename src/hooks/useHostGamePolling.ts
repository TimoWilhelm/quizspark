import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/lib/game-store';
import { useHostStore } from '@/lib/host-store';
import type { ApiResponse, GameState } from '@shared/types';
export function useHostGamePolling(gameId: string) {
  const setGameState = useGameStore(s => s.setGameState);
  const getSecret = useHostStore(s => s.getSecret);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const hostSecret = getSecret(gameId);
    const fetchState = async () => {
      if (!gameId || gameId === 'null' || gameId === 'undefined') {
        setError('No game ID provided.');
        setIsLoading(false);
        return;
      }
      if (!hostSecret) {
        setError('Access Denied. No host secret found.');
        setIsLoading(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      try {
        const response = await fetch(`/api/games/${gameId}/host`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostSecret }),
        });
        if (response.status === 403) {
          throw new Error('Access Denied. Invalid host secret.');
        }
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
    fetchState(); // Initial fetch
    intervalRef.current = setInterval(fetchState, 1500);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [gameId, setGameState, getSecret]);
  return { isLoading, error };
}