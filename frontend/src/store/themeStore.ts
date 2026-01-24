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
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 应用主题到 DOM
 */
function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * 根据主题设置计算实际应用的主题
 */
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => {
      // 初始化时应用主题
      const initialTheme = resolveTheme('dark'); // 默认深色
      applyTheme(initialTheme);

      // 监听系统主题变化
      if (typeof window !== 'undefined') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
          const state = get();
          if (state.theme === 'system') {
            const newTheme = resolveTheme('system');
            applyTheme(newTheme);
            set({ effectiveTheme: newTheme });
          }
        };
        mediaQuery.addEventListener('change', handleChange);
      }

      return {
        theme: 'dark',
        effectiveTheme: initialTheme,
        setTheme: (theme: Theme) => {
          const resolved = resolveTheme(theme);
          applyTheme(resolved);
          set({ theme, effectiveTheme: resolved });
        },
        toggleTheme: () => {
          const state = get();
          const newTheme = state.effectiveTheme === 'dark' ? 'light' : 'dark';
          applyTheme(newTheme);
          set({ 
            theme: newTheme,
            effectiveTheme: newTheme 
          });
        },
      };
    },
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.theme);
          applyTheme(resolved);
          state.effectiveTheme = resolved;
        }
      },
    }
  )
);
