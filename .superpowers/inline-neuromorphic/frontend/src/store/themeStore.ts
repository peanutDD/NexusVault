//! # Theme Store
//!
//! 管理应用主题（深色/浅色模式）的状态和持久化。

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  effectiveTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function readThemeValue(theme: unknown): Theme | null {
  return theme === 'light' || theme === 'dark' ? theme : null;
}

function isRemovedNeuromorphicTheme(theme: unknown): boolean {
  return theme === 'neuromorphic';
}

function normalizeTheme(theme: unknown): Theme {
  return readThemeValue(theme) ?? 'dark';
}

export function resolvePersistedTheme(
  state: Partial<Pick<ThemeState, 'theme' | 'effectiveTheme'>> | null | undefined,
): Theme {
  if (isRemovedNeuromorphicTheme(state?.effectiveTheme) || isRemovedNeuromorphicTheme(state?.theme)) {
    return 'dark';
  }
  return readThemeValue(state?.effectiveTheme) ?? readThemeValue(state?.theme) ?? 'dark';
}

function writePersistedThemeToStorage(theme: Theme) {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.localStorage.getItem('theme-storage');
    const stored = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      'theme-storage',
      JSON.stringify({
        ...stored,
        state: {
          ...((stored.state as Record<string, unknown> | undefined) ?? {}),
          theme,
          effectiveTheme: theme,
        },
      }),
    );
  } catch {
    window.localStorage.setItem(
      'theme-storage',
      JSON.stringify({ state: { theme, effectiveTheme: theme }, version: 0 }),
    );
  }
}

function normalizePersistedState(
  state: Partial<ThemeState> | null | undefined,
): Pick<ThemeState, 'theme' | 'effectiveTheme'> {
  const effectiveTheme = resolvePersistedTheme(state);
  return {
    theme: effectiveTheme,
    effectiveTheme,
  };
}

export function readPersistedThemeFromStorage(): Theme {
  if (typeof window === 'undefined') return 'dark';

  try {
    const raw = window.localStorage.getItem('theme-storage');
    if (!raw) return 'dark';
    const stored = JSON.parse(raw) as {
      state?: Partial<Pick<ThemeState, 'theme' | 'effectiveTheme'>>;
    };
    const theme = resolvePersistedTheme(stored.state);
    if (isRemovedNeuromorphicTheme(stored.state?.effectiveTheme) || isRemovedNeuromorphicTheme(stored.state?.theme)) {
      writePersistedThemeToStorage(theme);
    }
    return theme;
  } catch {
    return 'dark';
  }
}

function applyTheme(effectiveTheme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'purple', 'terminal', 'portfolio', 'neuromorphic', 'neuromorphic-style');
  root.setAttribute('data-theme', effectiveTheme);
  if (effectiveTheme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light', 'neuromorphic-style');
    return;
  }

  root.classList.add('dark', 'neuromorphic-style');
}
function resolveMacOSTitlebarColor(): string | [number, number, number] | null {
  if (typeof document === 'undefined') return null;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--macos-titlebar-bg')
    .trim();
  if (!value) return null;
  if (value.startsWith('#')) return value;
  const rgb = value.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return null;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

async function applyMacOSWindowBackground() {
  if (typeof window === 'undefined') return;
  const isMacOS = navigator.userAgent.includes('Mac OS X');
  if (!isMacOS) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const color = resolveMacOSTitlebarColor();
    if (!color) return;
    await getCurrentWindow().setBackgroundColor(color);
  } catch {
    return;
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => {
      // 初始化时必须同步读取持久化主题，避免覆盖 index.html 的预加载主题。
      const initialTheme: Theme = readPersistedThemeFromStorage();
      const initialEffectiveTheme: Theme = initialTheme;
      applyTheme(initialEffectiveTheme);
      void applyMacOSWindowBackground();

      return {
        theme: initialTheme,
        effectiveTheme: initialEffectiveTheme,
        setTheme: (_theme: Theme) => {
          const theme = normalizeTheme(_theme);
          const effectiveTheme: Theme = theme;
          applyTheme(effectiveTheme);
          void applyMacOSWindowBackground();
          set({ theme, effectiveTheme });
        },
        toggleTheme: () => {
          const current = get().effectiveTheme;
          const nextTheme: Theme = current === 'dark' ? 'light' : 'dark';
          const effectiveTheme: Theme = nextTheme;
          applyTheme(effectiveTheme);
          void applyMacOSWindowBackground();
          set({ theme: nextTheme, effectiveTheme });
        },
      };
    },
    {
      name: 'theme-storage',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ThemeState> | null;
        const normalized = normalizePersistedState(persisted);
        return {
          ...currentState,
          ...persisted,
          ...normalized,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const effectiveTheme = resolvePersistedTheme(state);
          applyTheme(effectiveTheme);
          void applyMacOSWindowBackground();
          state.theme = effectiveTheme;
          state.effectiveTheme = effectiveTheme;
        }
      },
    }
  )
);
