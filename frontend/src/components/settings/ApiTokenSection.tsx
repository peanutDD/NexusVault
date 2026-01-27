import { memo, useCallback } from 'react';
import type { ApiToken } from '../../services/apiTokens';

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
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-4">API Token 管理</h2>
      <p className="text-gray-400 text-sm mb-4">
        API Token 用于程序化访问，可以替代 JWT Token 进行身份验证。
      </p>

      {/* 创建新 Token */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-white mb-3">创建新 Token</h3>
        <form onSubmit={onCreateToken} className="space-y-4">
          <div>
            <label htmlFor="new-token-name" className="block text-sm font-medium text-gray-300 mb-2">
              Token 名称
            </label>
            <input
              id="new-token-name"
              type="text"
              value={tokenForm.name}
              onChange={onTokenNameChange}
              placeholder="例如：我的脚本、CI/CD 等"
              required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label htmlFor="new-token-expires" className="block text-sm font-medium text-gray-300 mb-2">
              过期时间（天数，可选）
            </label>
            <input
              id="new-token-expires"
              type="number"
              value={tokenForm.expires}
              onChange={onTokenExpiresChange}
              min="1"
              placeholder="留空表示永不过期"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '创建中...' : '创建 Token'}
          </button>
        </form>

        {/* 显示新创建的 Token */}
        {tokenForm.showValue && tokenForm.value && (
          <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg">
            <p className="text-yellow-400 text-sm font-medium mb-2">
              ⚠️ 重要：请立即复制并保存此 Token，它只会显示一次！
            </p>
            <div className="flex items-center gap-2 mb-2">
              <code className="flex-1 px-3 py-2 bg-gray-900 rounded text-yellow-300 text-sm break-all">
                {tokenForm.value}
              </code>
              <button
                onClick={handleCopyClick}
                className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
              >
                复制
              </button>
            </div>
            <button
              onClick={onCloseTokenValue}
              className="text-yellow-400 text-sm hover:text-yellow-300"
            >
              我已保存，关闭
            </button>
          </div>
        )}
      </div>

      {/* Token 列表 */}
      <div>
        <h3 className="text-lg font-medium text-white mb-3">现有 Tokens</h3>
        {apiTokens.length === 0 ? (
          <p className="text-gray-400 text-sm">暂无 API Token</p>
        ) : (
          <div className="space-y-3">
            {apiTokens.map((token) => (
              <div
                key={token.id}
                className="p-4 bg-gray-700/50 rounded-lg border border-gray-600"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{token.name}</h4>
                    <div className="text-gray-400 text-sm mt-1 space-y-1">
                      <p>
                        创建时间:{' '}
                        {new Date(token.created_at).toLocaleString('zh-CN')}
                      </p>
                      {token.last_used_at && (
                        <p>
                          最后使用:{' '}
                          {new Date(token.last_used_at).toLocaleString('zh-CN')}
                        </p>
                      )}
                      {token.expires_at && (
                        <p>
                          过期时间:{' '}
                          {new Date(token.expires_at).toLocaleString('zh-CN')}
                          {new Date(token.expires_at) < new Date() && (
                            <span className="text-red-400 ml-2">(已过期)</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteToken(token.id)}
                    disabled={loading}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default ApiTokenSection;
