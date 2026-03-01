import { memo, useCallback } from 'react';
import { Key, Copy, Trash2, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ApiToken } from '../../services/apiTokens';
import ErrorMessage from '../common/feedback/ErrorMessage';
import SettingsCard from './SettingsCard';

interface TokenForm {
  name: string;
  expires: number | '';
  value: string | null;
  showValue: boolean;
}

interface ApiTokenSectionProps {
  apiTokens: ApiToken[];
  tokenForm: TokenForm;
  loading: boolean;
  error?: string | null;
  success?: string | null;
  onCloseError?: () => void;
  onCloseSuccess?: () => void;
  onTokenNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTokenExpiresChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreateToken: (e: React.FormEvent) => void;
  onDeleteToken: (tokenId: string) => void;
  onCopyToken: (token: string) => Promise<void>;
  onCloseTokenValue: () => void;
}

const ApiTokenSection = memo(function ApiTokenSection({
  apiTokens,
  tokenForm,
  loading,
  error,
  success,
  onCloseError,
  onCloseSuccess,
  onTokenNameChange,
  onTokenExpiresChange,
  onCreateToken,
  onDeleteToken,
  onCopyToken,
  onCloseTokenValue,
}: ApiTokenSectionProps) {
  const handleCopyClick = useCallback(() => {
    if (tokenForm.value) {
      onCopyToken(tokenForm.value);
    }
  }, [tokenForm.value, onCopyToken]);

  return (
    <SettingsCard
      id="api-tokens"
      title="API Tokens"
      description="For programmatic access. New tokens are shown only once — save them immediately."
      icon={<Key className="h-5 w-5" aria-hidden="true" />}
    >
      {error && (
        <ErrorMessage
          message={error}
          onClose={onCloseError}
          type="error"
          autoDismissMs={5000}
          className="mb-4"
        />
      )}
      {success && (
        <ErrorMessage
          message={success}
          onClose={onCloseSuccess}
          type="info"
          autoDismissMs={3000}
          className="mb-4"
        />
      )}

      <div className="mb-6">
        <div className="mb-3 flex flex-nowrap items-center justify-between gap-3">
          <h3 className="min-w-0 font-brand text-[clamp(0.8rem,2.4vw,0.95rem)] font-semibold tracking-wide text-slate-200 whitespace-nowrap">
            Create new token
          </h3>
          <span className="min-w-0 font-brand text-[clamp(0.65rem,2.1vw,0.75rem)] font-normal tracking-wide text-slate-500 whitespace-nowrap truncate">
            Use separate tokens for different purposes
          </span>
        </div>
        <form onSubmit={onCreateToken} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="new-token-name"
              className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-slate-200 mb-2"
            >
              Token name
            </label>
            <input
              id="new-token-name"
              type="text"
              value={tokenForm.name}
              onChange={onTokenNameChange}
              placeholder="e.g. My script, CI/CD"
              required
              className={cn(
                'w-full rounded-xl px-4 py-2.5',
                'bg-slate-950/40 border border-emerald-300/15',
                'text-slate-100 placeholder:text-slate-500',
                'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
              )}
            />
          </div>
          <div>
            <label
              htmlFor="new-token-expires"
              className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-slate-200 mb-2"
            >
              Expires in (days, optional)
            </label>
            <input
              id="new-token-expires"
              type="number"
              value={tokenForm.expires}
              onChange={onTokenExpiresChange}
              min="1"
              placeholder="Leave empty for never"
              className={cn(
                'w-full rounded-xl px-4 py-2.5',
                'bg-slate-950/40 border border-emerald-300/15',
                'text-slate-100 placeholder:text-slate-500',
                'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
              )}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'font-brand sm:col-span-2 w-full rounded-xl px-4 py-2.5 font-semibold tracking-wide',
              'bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 text-slate-950',
              'hover:from-emerald-500 hover:to-cyan-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {loading ? 'Creating...' : 'Create token'}
          </button>
        </form>

        {/* 显示新创建的 Token */}
        {tokenForm.showValue && tokenForm.value && (
          <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-amber-200">
                  Important: Copy and save now — this token will only be shown once
                </p>
                <p className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-amber-200/80">
                  Save to a password manager or CI secret
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseTokenValue}
                className="inline-flex items-center justify-center rounded-lg border border-amber-300/25 bg-slate-950/20 p-2 text-amber-100 hover:bg-slate-950/30"
                aria-label="Close token display"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 rounded-xl border border-amber-300/20 bg-slate-950/50 px-3 py-2 text-[length:var(--settings-text-xs)] text-amber-100 break-all">
                {tokenForm.value}
              </code>
              <button
                type="button"
                onClick={handleCopyClick}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[length:var(--settings-text-sm)] font-semibold',
                  'bg-amber-400/90 text-slate-950 hover:bg-amber-400'
                )}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Token 列表 */}
      <div>
        <h3 className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-slate-200 mb-3">
          Existing tokens
        </h3>
        {apiTokens.length === 0 ? (
          <p className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-slate-400">No API tokens yet</p>
        ) : (
          <div className="space-y-3">
            {apiTokens.map((token) => (
              <div
                key={token.id}
                className={cn(
                  'rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4',
                  'hover:border-emerald-300/20 transition-colors'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-[length:var(--settings-text-sm)] font-semibold text-slate-100">
                        {token.name}
                      </h4>
                      {token.expires_at && new Date(token.expires_at) < new Date() && (
                        <span className="font-brand rounded-full border border-rose-300/25 bg-rose-500/10 px-2 py-0.5 text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-rose-200">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 text-[length:var(--settings-text-xs)] text-slate-400 sm:grid-cols-2">
                      <p className="font-brand font-normal tracking-wide">
                        Created: {new Date(token.created_at).toLocaleString()}
                      </p>
                      {token.last_used_at ? (
                        <p className="font-brand font-normal tracking-wide">
                          Last used: {new Date(token.last_used_at).toLocaleString()}
                        </p>
                      ) : (
                        <p className="font-brand font-normal tracking-wide">Last used: -</p>
                      )}
                      <p className="font-brand sm:col-span-2 font-normal tracking-wide">
                        Expires:
                        {token.expires_at ? (
                          <> {new Date(token.expires_at).toLocaleString()}</>
                        ) : (
                          ' Never'
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteToken(token.id)}
                    disabled={loading}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[length:var(--settings-text-sm)] font-semibold',
                      'border border-rose-300/20 bg-rose-500/10 text-rose-200',
                      'hover:bg-rose-500/15 hover:border-rose-300/30',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsCard>
  );
});

export default ApiTokenSection;
