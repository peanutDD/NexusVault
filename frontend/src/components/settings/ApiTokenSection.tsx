import { memo, useCallback } from 'react';
import { Key, Copy, Trash2, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ApiToken } from '../../services/apiTokens';
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
  onTokenNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTokenExpiresChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreateToken: (e: React.FormEvent) => void;
  onDeleteToken: (tokenId: string) => void;
  onCopyToken: (token: string) => void;
  onCloseTokenValue: () => void;
}

const ApiTokenSection = memo(function ApiTokenSection({
  apiTokens,
  tokenForm,
  loading,
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
      description="用于程序化访问。新 Token 只会显示一次，请及时保存。"
      icon={<Key className="h-5 w-5" aria-hidden="true" />}
    >

      {/* 创建新 Token */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-200">
            创建新 Token
          </h3>
          <span className="text-xs text-slate-500">
            建议为不同用途创建不同 Token
          </span>
        </div>
        <form onSubmit={onCreateToken} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="new-token-name"
              className="block text-sm font-medium text-slate-200 mb-2"
            >
              Token 名称
            </label>
            <input
              id="new-token-name"
              type="text"
              value={tokenForm.name}
              onChange={onTokenNameChange}
              placeholder="例如：我的脚本、CI/CD 等"
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
              className="block text-sm font-medium text-slate-200 mb-2"
            >
              过期时间（天数，可选）
            </label>
            <input
              id="new-token-expires"
              type="number"
              value={tokenForm.expires}
              onChange={onTokenExpiresChange}
              min="1"
              placeholder="留空表示永不过期"
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
              'sm:col-span-2 w-full rounded-xl px-4 py-2.5 font-semibold tracking-wide',
              'bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 text-slate-950',
              'hover:from-emerald-500 hover:to-cyan-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {loading ? '创建中...' : '创建 Token'}
          </button>
        </form>

        {/* 显示新创建的 Token */}
        {tokenForm.showValue && tokenForm.value && (
          <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  重要：请立即复制并保存，此 Token 只会显示一次
                </p>
                <p className="mt-1 text-xs text-amber-200/80">
                  建议粘贴到密码管理器或 CI Secret
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseTokenValue}
                className="inline-flex items-center justify-center rounded-lg border border-amber-300/25 bg-slate-950/20 p-2 text-amber-100 hover:bg-slate-950/30"
                aria-label="关闭 Token 展示"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 rounded-xl border border-amber-300/20 bg-slate-950/50 px-3 py-2 text-xs text-amber-100 break-all">
                {tokenForm.value}
              </code>
              <button
                type="button"
                onClick={handleCopyClick}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold',
                  'bg-amber-400/90 text-slate-950 hover:bg-amber-400'
                )}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                复制
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Token 列表 */}
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-slate-200 mb-3">
          现有 Tokens
        </h3>
        {apiTokens.length === 0 ? (
          <p className="text-sm text-slate-400">暂无 API Token</p>
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
                      <h4 className="truncate text-sm font-semibold text-slate-100">
                        {token.name}
                      </h4>
                      {token.expires_at && new Date(token.expires_at) < new Date() && (
                        <span className="rounded-full border border-rose-300/25 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                          已过期
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                      <p>
                        创建：{new Date(token.created_at).toLocaleString('zh-CN')}
                      </p>
                      {token.last_used_at ? (
                        <p>
                          最后使用：{new Date(token.last_used_at).toLocaleString('zh-CN')}
                        </p>
                      ) : (
                        <p>最后使用：-</p>
                      )}
                      <p className="sm:col-span-2">
                        过期：
                        {token.expires_at ? (
                          <> {new Date(token.expires_at).toLocaleString('zh-CN')}</>
                        ) : (
                          ' 永不过期'
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteToken(token.id)}
                    disabled={loading}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                      'border border-rose-300/20 bg-rose-500/10 text-rose-200',
                      'hover:bg-rose-500/15 hover:border-rose-300/30',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    删除
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
