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
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveEffectiveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(effectiveTheme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (effectiveTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}


export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => {
      // 初始化时应用主题
      const initialTheme: Theme = 'system';
      const initialEffectiveTheme = resolveEffectiveTheme(initialTheme);
      applyTheme(initialEffectiveTheme);

      if (typeof window !== 'undefined') {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => {
          const { theme } = get();
          if (theme !== 'system') return;
          const effectiveTheme = resolveEffectiveTheme('system');
          applyTheme(effectiveTheme);
          set({ effectiveTheme });
        };
        mql.addEventListener?.('change', onChange);
        mql.addListener?.(onChange);
      }

      return {
        theme: initialTheme,
        effectiveTheme: initialEffectiveTheme,
        setTheme: (theme: Theme) => {
          const effectiveTheme = resolveEffectiveTheme(theme);
          applyTheme(effectiveTheme);
          set({ theme, effectiveTheme });
        },
        toggleTheme: () => {
          const nextTheme: Theme = get().effectiveTheme === 'dark' ? 'light' : 'dark';
          const effectiveTheme = resolveEffectiveTheme(nextTheme);
          applyTheme(effectiveTheme);
          set({ theme: nextTheme, effectiveTheme });
        },
      };
    },
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const effectiveTheme = resolveEffectiveTheme(state.theme);
          applyTheme(effectiveTheme);
          state.effectiveTheme = effectiveTheme;
        }
      },
    }
  )
);
