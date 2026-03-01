//! # Theme Store
//!
//! 管理应用主题（深色/浅色模式）的状态和持久化。

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * 获取系统主题偏好
 */
/**
 * 应用主题到 DOM
 */
function applyTheme() {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  root.classList.add('dark');
}


export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => {
      // 初始化时应用主题
      const initialTheme = 'dark' as const;
      applyTheme();

      return {
        theme: 'dark',
        effectiveTheme: initialTheme,
        setTheme: (theme: Theme) => {
          void theme;
          applyTheme();
          set({ theme: 'dark', effectiveTheme: 'dark' });
        },
        toggleTheme: () => {
          applyTheme();
          set({ theme: 'dark', effectiveTheme: 'dark' });
        },
      };
    },
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme();
          state.theme = 'dark';
          state.effectiveTheme = 'dark';
        }
      },
    }
  )
);
