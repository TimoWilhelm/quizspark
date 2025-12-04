import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
interface HostStoreState {
	secrets: Record<string, string>; // gameId -> hostSecret
	addSecret: (gameId: string, secret: string) => void;
	getSecret: (gameId: string) => string | undefined;
}
export const useHostStore = create<HostStoreState>()(
	persist(
		(set, get) => ({
			secrets: {},
			addSecret: (gameId, secret) =>
				set((state) => ({
					secrets: { ...state.secrets, [gameId]: secret },
				})),
			getSecret: (gameId) => get().secrets[gameId],
		}),
		{
			name: 'timoot-host-storage',
			storage: createJSONStorage(() => localStorage), // Use localStorage for host persistence
		},
	),
);
