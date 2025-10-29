import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GameState } from '@shared/types';
interface GameStoreState {
  gameState: GameState | null;
  gamePin: string | null;
  playerId: string | null;
  setGameState: (state: GameState) => void;
  setGamePin: (pin: string) => void;
  setPlayerId: (id: string) => void;
}
export const useGameStore = create<GameStoreState>()(
  persist(
    (set) => ({
      gameState: null,
      gamePin: null,
      playerId: null,
      setGameState: (state) => set({ gameState: state }),
      setGamePin: (pin) => set({ gamePin: pin }),
      setPlayerId: (id) => set({ playerId: id }),
    }),
    {
      name: 'quizspark-storage',
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage
    }
  )
);