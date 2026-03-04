import { Palette } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useThemeStore } from '../../store/themeStore';
import SettingsCard from './SettingsCard';

type ThemeOption = 'dark' | 'light' | 'purple';

const OPTIONS: Array<{
  value: ThemeOption;
  title: string;
  description: string;
}> = [
  { value: 'dark', title: 'Dark', description: 'Green dark theme.' },
  { value: 'light', title: 'Light', description: 'Use light theme.' },
  { value: 'purple', title: 'Purple', description: 'Classic purple theme.' },
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
              'bg-[var(--glass-bg-soft)] border-[var(--color-border-soft)] text-[var(--color-text-primary)]',
              'hover:bg-[var(--glass-bg-strong)] hover:border-[var(--color-border-medium)]',
              theme === opt.value &&
                'bg-[var(--glass-bg-strong)] border-[var(--cta-primary-border)] shadow-[var(--shadow-glass-card)]'
            )}
            aria-pressed={theme === opt.value}
          >
            <div className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide">
              {opt.title}
            </div>
            <div className="font-brand mt-1 text-[length:var(--settings-text-xs)] tracking-wide text-[var(--color-text-muted)]">
              {opt.description}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border-soft)] bg-[var(--glass-bg-soft)] p-4">
        <div className="font-brand text-[length:var(--settings-text-xs)] tracking-wide text-[var(--color-text-muted)]">
          Current
        </div>
        <div className="mt-1 text-[length:var(--settings-text-sm)] font-semibold text-[var(--color-text-primary)]">
          {effectiveTheme}
        </div>
      </div>
    </SettingsCard>
  );
}
