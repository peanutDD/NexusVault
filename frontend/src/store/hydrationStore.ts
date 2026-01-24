import { create } from 'zustand';

interface HydrationState {
  hydrated: boolean;
  setHydrated: () => void;
}

export const useHydrationStore = create<HydrationState>((set) => ({
  hydrated: false,
  setHydrated: () => set({ hydrated: true }),
}));
