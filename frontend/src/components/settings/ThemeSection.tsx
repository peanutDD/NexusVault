import { Palette } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useThemeStore } from '../../store/themeStore';
import SettingsCard from './SettingsCard';

type ThemeOption = 'system' | 'dark' | 'light';

const OPTIONS: Array<{
  value: ThemeOption;
  title: string;
  description: string;
}> = [
  { value: 'system', title: 'System', description: 'Follow your OS setting.' },
  { value: 'dark', title: 'Dark', description: 'Use dark theme.' },
  { value: 'light', title: 'Light', description: 'Use light theme.' },
];

export default function ThemeSection() {
  const { theme, effectiveTheme, setTheme } = useThemeStore();

  return (
    <SettingsCard
      id="appearance"
      title="Appearance"
      description="Choose how the interface should look."
      icon={<Palette className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={cn(
              'rounded-xl border px-4 py-3 text-left transition-colors',
              'bg-slate-950/35 border-emerald-300/15 text-slate-200',
              'hover:bg-slate-900/45 hover:border-emerald-300/25',
              theme === opt.value && 'bg-emerald-500/15 border-emerald-300/35 text-slate-100'
            )}
            aria-pressed={theme === opt.value}
          >
            <div className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide">
              {opt.title}
            </div>
            <div className="font-brand mt-1 text-[length:var(--settings-text-xs)] tracking-wide text-slate-400">
              {opt.description}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
        <div className="font-brand text-[length:var(--settings-text-xs)] tracking-wide text-slate-500">
          Current
        </div>
        <div className="mt-1 text-[length:var(--settings-text-sm)] font-semibold text-slate-100">
          {theme === 'system' ? `System (${effectiveTheme})` : effectiveTheme}
        </div>
      </div>
    </SettingsCard>
  );
}
