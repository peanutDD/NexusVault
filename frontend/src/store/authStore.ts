import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { useHydrationStore } from './hydrationStore';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token });
      },
      clearAuth: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null });
      },
      isAuthenticated: () => {
        return get().token !== null && get().user !== null;
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => () => {
        useHydrationStore.getState().setHydrated();
      },
    }
  )
);
