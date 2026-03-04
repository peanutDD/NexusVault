import { memo, useCallback, useState } from 'react';
import { Key, Copy, Trash2, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ApiToken } from '../../services/apiTokens';
import ErrorMessage from '../common/feedback/ErrorMessage';
import ConfirmDialog from '../common/dialog/ConfirmDialog';
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
  onDeleteToken: (tokenId: string) => Promise<void>;
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
  const [pendingDeleteToken, setPendingDeleteToken] = useState<ApiToken | null>(null);
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
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
        />
      )}
      {success && (
        <ErrorMessage
          message={success}
          onClose={onCloseSuccess}
          type="info"
          autoDismissMs={3000}
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteToken)}
        appearance="glass"
        variant="danger"
        icon={<Trash2 className="h-5 w-5" />}
        iconBgClass="bg-[var(--settings-danger-icon-bg)]"
        iconColorClass="text-[var(--settings-danger-icon-text)]"
        title="Delete API Token"
        message={
          pendingDeleteToken ? (
            <>
              Delete this token? This action cannot be undone.
              {'\n'}
              Token: {pendingDeleteToken.name}
            </>
          ) : null
        }
        confirmText="Delete"
        cancelText="Cancel"
        loading={loading}
        onConfirm={async () => {
          if (!pendingDeleteToken) return;
          await onDeleteToken(pendingDeleteToken.id);
          setPendingDeleteToken(null);
        }}
        onCancel={() => setPendingDeleteToken(null)}
      />

      <div className="mb-6">
        <div className="mb-3 flex flex-nowrap items-center justify-between gap-3">
          <h3 className="min-w-0 font-brand text-[clamp(0.8rem,2.4vw,0.95rem)] font-semibold tracking-wide text-[var(--settings-section-title)] whitespace-nowrap">
            Create new token
          </h3>
          <span className="min-w-0 font-brand text-[clamp(0.65rem,2.1vw,0.75rem)] font-normal tracking-wide text-[var(--settings-section-subtitle)] whitespace-nowrap truncate">
            Use separate tokens for different purposes
          </span>
        </div>
        <form onSubmit={onCreateToken} noValidate className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="new-token-name"
              className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
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
                'bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]',
                'text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]'
              )}
            />
          </div>
          <div>
            <label
              htmlFor="new-token-expires"
              className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
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
                'bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]',
                'text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]'
              )}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'font-brand sm:col-span-2 w-full rounded-xl px-4 py-2.5 font-semibold tracking-wide',
              'bg-[var(--settings-action-bg)] text-[var(--settings-action-text)]',
              'hover:bg-[var(--settings-action-bg-hover)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {loading ? 'Creating...' : 'Create token'}
          </button>
        </form>

        {/* 显示新创建的 Token */}
        {tokenForm.showValue && tokenForm.value && (
          <div className="mt-4 rounded-xl border border-[var(--settings-warning-panel-border)] bg-[var(--settings-warning-panel-bg)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-warning-panel-text)]">
                  Important: Copy and save now — this token will only be shown once
                </p>
                <p className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-warning-panel-muted)]">
                  Save to a password manager or CI secret
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseTokenValue}
                className="inline-flex items-center justify-center rounded-lg border border-[var(--settings-warning-close-border)] bg-[var(--settings-warning-close-bg)] p-2 text-[var(--settings-warning-close-text)] hover:bg-[var(--settings-warning-close-bg-hover)]"
                aria-label="Close token display"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 rounded-xl border border-[var(--settings-warning-code-border)] bg-[var(--settings-warning-code-bg)] px-3 py-2 text-[length:var(--settings-text-xs)] text-[var(--settings-warning-code-text)] break-all">
                {tokenForm.value}
              </code>
              <button
                type="button"
                onClick={handleCopyClick}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[length:var(--settings-text-sm)] font-semibold',
                  'bg-[var(--settings-warning-action-bg)] text-[var(--settings-warning-action-text)] hover:bg-[var(--settings-warning-action-bg-hover)]'
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
        <h3 className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-section-title)] mb-3">
          Existing tokens
        </h3>
        {apiTokens.length === 0 ? (
          <p className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-panel-muted)]">No API tokens yet</p>
        ) : (
          <div className="space-y-3">
            {apiTokens.map((token) => (
              <div
                key={token.id}
                className={cn(
                  'rounded-xl border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-4',
                  'hover:border-[var(--settings-panel-border-hover)] transition-colors'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-panel-value)]">
                        {token.name}
                      </h4>
                      {token.expires_at && new Date(token.expires_at) < new Date() && (
                        <span className="font-brand rounded-full border border-[var(--settings-expired-border)] bg-[var(--settings-expired-bg)] px-2 py-0.5 text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-[var(--settings-expired-text)]">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 text-[length:var(--settings-text-xs)] text-[var(--settings-panel-muted)] sm:grid-cols-2">
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
                    onClick={() => setPendingDeleteToken(token)}
                    disabled={loading}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[length:var(--settings-text-sm)] font-semibold',
                      'border border-[var(--settings-danger-button-border)] bg-[var(--settings-danger-button-bg)] text-[var(--settings-danger-button-text)]',
                      'hover:bg-[var(--settings-danger-button-bg-hover)] hover:border-[var(--settings-danger-button-border-hover)]',
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
