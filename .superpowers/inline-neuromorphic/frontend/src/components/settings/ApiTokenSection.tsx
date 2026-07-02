import { memo, useCallback, useState, useMemo } from "react";
import { Key, Copy, Pencil, Save, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "../../utils/cn";
import type { ApiToken } from "../../services/apiTokens";
import ErrorMessage from "../common/feedback/ErrorMessage";
import ConfirmDialog from "../common/dialog/ConfirmDialog";
import SettingsCard from "./SettingsCard";
import {
  settingsErrorClass,
  settingsInputClass,
  settingsLabelClass,
  settingsPanelClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
} from "./settingsUi";
import {
  useApiTokens,
  useCreateApiToken,
  useDeleteApiToken,
  useUpdateApiToken,
} from "../../hooks/useApiTokens";
import { useClipboard } from "../../hooks/useClipboard";
import { getErrorMessage } from "../../utils/error";

interface TokenFormValues {
  name: string;
  expires: number | "";
  webdavEnabled: boolean;
  webdavReadOnly: boolean;
  webdavRootFolderId: string;
}

const webDavOptionCardClass =
  "neu-inset group relative grid cursor-pointer grid-cols-[clamp(2.1rem,4vw,2.4rem)_minmax(0,1fr)] gap-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.7rem,1.6vw,0.875rem)] border-0 px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.68rem,1.5vw,0.85rem)] text-[var(--settings-panel-value)] transition-[box-shadow,color]";

const webDavOptionIndicatorClass =
  "neu-inset settings-color-checkbox-indicator mt-[clamp(0.1rem,0.25vw,0.15rem)] flex h-[clamp(1.7rem,3.2vw,1.9rem)] w-[clamp(1.7rem,3.2vw,1.9rem)] items-center justify-center rounded-[clamp(0.55rem,1.2vw,0.65rem)] border-0 text-transparent transition-[box-shadow,color] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--settings-form-input-ring)]";

const ApiTokenSection = memo(function ApiTokenSection() {
  const { data: apiTokens = [], isLoading: tokensLoading } = useApiTokens();
  const createTokenMutation = useCreateApiToken();
  const deleteTokenMutation = useDeleteApiToken();
  const updateTokenMutation = useUpdateApiToken();
  const { copy: copyToClipboard } = useClipboard();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(
    null,
  );
  const [showCreatedTokenValue, setShowCreatedTokenValue] = useState(false);
  const [pendingDeleteToken, setPendingDeleteToken] = useState<ApiToken | null>(
    null,
  );
  const [editingToken, setEditingToken] = useState<ApiToken | null>(null);
  const [editTokenName, setEditTokenName] = useState("");
  const [editWebDavEnabled, setEditWebDavEnabled] = useState(true);
  const [editWebDavReadOnly, setEditWebDavReadOnly] = useState(false);
  const [editWebDavRootFolderId, setEditWebDavRootFolderId] = useState("");
  const [tokenListExpanded, setTokenListExpanded] = useState(false);
  const hasCollapsedTokens = apiTokens.length > 5;
  const visibleTokens =
    hasCollapsedTokens && !tokenListExpanded
      ? apiTokens.slice(0, 5)
      : apiTokens;

  const tokenSchema = useMemo(() => {
    return z.object({
      name: z.string().trim().min(1, "Please enter a token name"),
      expires: z.union([
        z.literal(""),
        z.number().int().min(1, "Expires must be at least 1 day"),
      ]),
      webdavEnabled: z.boolean(),
      webdavReadOnly: z.boolean(),
      webdavRootFolderId: z
        .string()
        .trim()
        .refine(
          (value) =>
            value === "" ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              value,
            ),
          "Root folder must be a folder UUID",
        ),
    });
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TokenFormValues>({
    resolver: zodResolver(tokenSchema),
    defaultValues: {
      name: "",
      expires: "",
      webdavEnabled: true,
      webdavReadOnly: false,
      webdavRootFolderId: "",
    },
    mode: "onBlur",
  });

  const handleCreateToken = useCallback(
    (data: TokenFormValues) => {
      setError(null);
      setSuccess(null);
      createTokenMutation.mutate(
        {
          name: data.name.trim(),
          expires_in_days:
            data.expires === "" ? undefined : Number(data.expires),
          webdav_enabled: data.webdavEnabled,
          webdav_read_only: data.webdavReadOnly,
          webdav_root_folder_id:
            data.webdavRootFolderId.trim() === ""
              ? null
              : data.webdavRootFolderId.trim(),
        },
        {
          onSuccess: (response) => {
            setCreatedTokenValue(response.token.token);
            setShowCreatedTokenValue(true);
            reset();
            setSuccess(
              "API Token created. Copy and save it now — it will only be shown once.",
            );
          },
          onError: (err) => {
            setError(getErrorMessage(err, "Failed to create API Token"));
          },
        },
      );
    },
    [createTokenMutation, reset],
  );

  const handleDeleteToken = useCallback(async () => {
    if (!pendingDeleteToken) return;
    deleteTokenMutation.mutate(pendingDeleteToken.id, {
      onSuccess: () => {
        setSuccess("API Token deleted");
        setPendingDeleteToken(null);
      },
      onError: (err) => {
        setError(getErrorMessage(err, "Failed to delete API Token"));
      },
    });
  }, [deleteTokenMutation, pendingDeleteToken]);

  const beginEditToken = useCallback((token: ApiToken) => {
    setEditingToken(token);
    setEditTokenName(token.name);
    setEditWebDavEnabled(token.webdav_enabled);
    setEditWebDavReadOnly(token.webdav_read_only);
    setEditWebDavRootFolderId(token.webdav_root_folder_id ?? "");
    setError(null);
    setSuccess(null);
  }, []);

  const cancelEditToken = useCallback(() => {
    setEditingToken(null);
  }, []);

  const saveEditToken = useCallback(() => {
    if (!editingToken) return;
    setError(null);
    setSuccess(null);
    updateTokenMutation.mutate(
      {
        tokenId: editingToken.id,
        data: {
          name: editTokenName.trim(),
          webdav_enabled: editWebDavEnabled,
          webdav_read_only: editWebDavReadOnly,
          webdav_root_folder_id: editWebDavRootFolderId.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setSuccess("API Token updated");
          setEditingToken(null);
        },
        onError: (err) => {
          setError(getErrorMessage(err, "Failed to update API Token"));
        },
      },
    );
  }, [
    editTokenName,
    editWebDavEnabled,
    editWebDavReadOnly,
    editWebDavRootFolderId,
    editingToken,
    updateTokenMutation,
  ]);

  const handleCopyClick = useCallback(async () => {
    if (createdTokenValue) {
      const ok = await copyToClipboard(createdTokenValue);
      if (ok) {
        setSuccess("Token copied to clipboard");
      } else {
        setError("Copy failed. Please select the token and copy manually.");
      }
    }
  }, [createdTokenValue, copyToClipboard]);

  const handleCloseError = useCallback(() => setError(null), []);
  const handleCloseSuccess = useCallback(() => setSuccess(null), []);
  const handleCloseTokenValue = useCallback(() => {
    setShowCreatedTokenValue(false);
    setCreatedTokenValue(null);
  }, []);

  const loading =
    createTokenMutation.isPending ||
    deleteTokenMutation.isPending ||
    updateTokenMutation.isPending;

  return (
    <SettingsCard
      id="api-tokens"
      title="API Tokens"
      description="For programmatic access. New tokens are shown only once — save them immediately."
      icon={
        <Key
          className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]"
          aria-hidden="true"
          data-oid="o0-sgaf"
        />
      }
      data-oid=".havazj"
    >
      {error && (
        <ErrorMessage
          message={error}
          onClose={handleCloseError}
          type="error"
          autoDismissMs={5000}
          className="mb-[clamp(0.78rem,1.8vw,1rem)] [&_p]:text-[length:var(--settings-text-sm)]"
          data-oid="qjw3d7d"
        />
      )}
      {success && (
        <ErrorMessage
          message={success}
          onClose={handleCloseSuccess}
          type="info"
          autoDismissMs={3000}
          className="mb-[clamp(0.78rem,1.8vw,1rem)] [&_p]:text-[length:var(--settings-text-sm)]"
          data-oid="yvujd5y"
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteToken)}
        appearance="glass"
        variant="danger"
        icon={
          <Trash2
            className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]"
            data-oid="a:j1bu3"
          />
        }
        iconBgClass="neu-inset"
        iconColorClass="text-[var(--settings-danger-icon-text)]"
        title="Delete API Token"
        message={
          pendingDeleteToken ? (
            <>
              Delete this token? This action cannot be undone.
              {"\n"}
              Token: {pendingDeleteToken.name}
            </>
          ) : null
        }
        confirmText="Delete"
        cancelText="Cancel"
        loading={deleteTokenMutation.isPending}
        onConfirm={handleDeleteToken}
        onCancel={() => setPendingDeleteToken(null)}
        data-oid="w:9o6xk"
      />

      <div className="mb-[clamp(1.25rem,2.7vw,1.5rem)]" data-oid="5zclh.n">
        <div
          className="mb-[clamp(0.585rem,1.35vw,0.75rem)] flex flex-col gap-[clamp(0.195rem,0.45vw,0.25rem)] sm:flex-row sm:items-center sm:justify-between sm:gap-[clamp(0.585rem,1.35vw,0.75rem)]"
          data-oid="_4sfcnc"
        >
          <h3
            className="min-w-0 font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-section-title)]"
            data-oid=".j4zxhs"
          >
            Create new token
          </h3>
          <span
            className="min-w-0 font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-section-subtitle)]"
            data-oid="92qic3q"
          >
            Use separate tokens for different purposes
          </span>
        </div>
        <form
          onSubmit={handleSubmit(handleCreateToken)}
          noValidate
          className="grid gap-[clamp(0.78rem,1.8vw,1rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.42fr)]"
          data-oid="l01z3qa"
        >
          <div data-oid="gier:.r">
            <label
              htmlFor="new-token-name"
              className={settingsLabelClass()}
              data-oid="k-qxt_h"
            >
              Token name
            </label>
            <input
              id="new-token-name"
              type="text"
              {...register("name")}
              placeholder="e.g. My script, CI/CD"
              required
              className={settingsInputClass(Boolean(errors.name))}
              data-oid="e_5:s9m"
            />
            {errors.name && (
              <p className={settingsErrorClass()}>{errors.name.message}</p>
            )}
          </div>
          <div data-oid="332s4jl">
            <label
              htmlFor="new-token-expires"
              className={settingsLabelClass()}
              data-oid="573ccvh"
            >
              Expires in (days, optional)
            </label>
            <input
              id="new-token-expires"
              type="number"
              {...register("expires", { valueAsNumber: true })}
              min="1"
              placeholder="Leave empty for never"
              className={settingsInputClass(Boolean(errors.expires))}
              data-oid="aziv6r_"
            />
            {errors.expires && (
              <p className={settingsErrorClass()}>{errors.expires.message}</p>
            )}
          </div>
          <div className="grid gap-[clamp(0.585rem,1.35vw,0.75rem)] sm:grid-cols-2 lg:col-span-2">
            <label
              data-testid="webdav-enabled-option"
              className={webDavOptionCardClass}
            >
              <input
                type="checkbox"
                {...register("webdavEnabled")}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={webDavOptionIndicatorClass} />
              <span className="min-w-0">
                <span className="font-brand block text-[length:var(--settings-text-sm)] font-semibold tracking-wide">
                  Enable WebDAV
                </span>
                <span className="font-brand mt-[clamp(0.195rem,0.45vw,0.25rem)] block text-[length:var(--settings-text-xs)] leading-relaxed tracking-wide text-[var(--settings-panel-muted)]">
                  Allow this token to connect through the WebDAV endpoint.
                </span>
              </span>
            </label>
            <label
              data-testid="webdav-readonly-option"
              className={webDavOptionCardClass}
            >
              <input
                type="checkbox"
                {...register("webdavReadOnly")}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={webDavOptionIndicatorClass} />
              <span className="min-w-0">
                <span className="font-brand block text-[length:var(--settings-text-sm)] font-semibold tracking-wide">
                  WebDAV read-only
                </span>
                <span className="font-brand mt-[clamp(0.195rem,0.45vw,0.25rem)] block text-[length:var(--settings-text-xs)] leading-relaxed tracking-wide text-[var(--settings-panel-muted)]">
                  Limit WebDAV clients to download and browse operations.
                </span>
              </span>
            </label>
          </div>
          <div className="lg:col-span-2">
            <label
              htmlFor="new-token-webdav-root"
              className={settingsLabelClass()}
            >
              WebDAV root folder ID (optional)
            </label>
            <input
              id="new-token-webdav-root"
              type="text"
              {...register("webdavRootFolderId")}
              placeholder="Leave empty for full account"
              className={settingsInputClass(Boolean(errors.webdavRootFolderId))}
            />
            {errors.webdavRootFolderId && (
              <p className={settingsErrorClass()}>
                {errors.webdavRootFolderId.message}
              </p>
            )}
          </div>
          <div className="flex justify-end border-t border-[var(--settings-panel-border)] pt-[clamp(0.78rem,1.8vw,1rem)] lg:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className={settingsPrimaryButtonClass("w-full md:w-auto")}
              data-oid="qabeet7"
            >
              {createTokenMutation.isPending ? "Creating..." : "Create token"}
            </button>
          </div>
        </form>

        {/* 显示新创建的 Token */}
        {showCreatedTokenValue && createdTokenValue && (
          <div
            className="neu-inset mt-[clamp(0.78rem,1.8vw,1rem)] rounded-[clamp(0.6rem,1.4vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]"
            data-oid="denb39z"
          >
            <div
              className="flex items-start justify-between gap-[clamp(0.585rem,1.35vw,0.75rem)]"
              data-oid="lv6krqe"
            >
              <div data-oid="-11mmv5">
                <p
                  className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-warning-panel-text)]"
                  data-oid="wazeb93"
                >
                  Important: Copy and save now — this token will only be shown
                  once
                </p>
                <p
                  className="font-brand mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-warning-panel-muted)]"
                  data-oid=".:7lh-q"
                >
                  Save to a password manager or CI secret
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseTokenValue}
                className="neu-raised-sm inline-flex items-center justify-center rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 p-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--settings-warning-close-text)] transition-[box-shadow,color] active:shadow-[var(--neu-pressed-shadow)]"
                aria-label="Close token display"
                data-oid="ao3wc_v"
              >
                <X
                  className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]"
                  aria-hidden="true"
                  data-oid="-0byacd"
                />
              </button>
            </div>
            <div
              className="mt-[clamp(0.585rem,1.35vw,0.75rem)] flex flex-col gap-[clamp(0.39rem,0.9vw,0.5rem)] sm:flex-row sm:items-center"
              data-oid="7u87js0"
            >
              <code
                className="neu-inset flex-1 rounded-[clamp(0.6rem,1.4vw,0.75rem)] border-0 px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-warning-code-text)] break-all"
                data-oid="o78yn83"
              >
                {createdTokenValue}
              </code>
              <button
                type="button"
                onClick={handleCopyClick}
                className={cn(
                  "neu-raised-sm inline-flex items-center justify-center gap-[clamp(0.39rem,0.9vw,0.5rem)] rounded-[clamp(0.6rem,1.4vw,0.75rem)] border-0 px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-warning-action-text)] transition-[box-shadow,color] active:shadow-[var(--neu-pressed-shadow)]",
                )}
                data-oid="p9.y1yc"
              >
                <Copy
                  className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]"
                  aria-hidden="true"
                  data-oid="n:oyem_"
                />
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Token 列表 */}
      <div data-oid="2dmiy18">
        <h3
          className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-section-title)] mb-[clamp(0.585rem,1.35vw,0.75rem)]"
          data-oid=":l5kjxh"
        >
          Existing tokens
        </h3>
        {tokensLoading ? (
          <div className={settingsPanelClass()}>
            <p className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-panel-muted)]">
              Loading tokens...
            </p>
          </div>
        ) : apiTokens.length === 0 ? (
          <div
            className={settingsPanelClass("border-dashed")}
            data-oid="g_46r9y"
          >
            <p className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-panel-muted)]">
              No API tokens yet
            </p>
          </div>
        ) : (
          <div>
            {hasCollapsedTokens && (
              <div
                data-testid="existing-token-collapse-row"
                className="mb-[clamp(0.585rem,1.35vw,0.75rem)] flex flex-row items-center justify-between gap-[clamp(0.39rem,0.9vw,0.5rem)]"
              >
                <p
                  data-testid="existing-token-collapse-summary"
                  className="font-brand min-w-0 truncate text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-section-subtitle)]"
                >
                  {tokenListExpanded
                    ? `Showing all ${apiTokens.length} tokens`
                    : `Showing 5 of ${apiTokens.length} tokens`}
                </p>
                <button
                  type="button"
                  className={settingsSecondaryButtonClass(
                    "existingTokenNeuButton w-fit shrink-0 rounded-[clamp(0.55rem,1.2vw,0.65rem)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.2925rem,0.7vw,0.375rem)] text-[length:var(--settings-text-xs)] tracking-wide",
                  )}
                  onClick={() => setTokenListExpanded((expanded) => !expanded)}
                >
                  {tokenListExpanded
                    ? "Show less"
                    : `Show all ${apiTokens.length} tokens`}
                </button>
              </div>
            )}
            <div
              data-testid="existing-token-list-frame"
              className={settingsPanelClass(
                "existingTokenInsetFrame max-h-[clamp(22rem,55dvh,34rem)] overflow-y-auto rounded-[clamp(0.8rem,1.8vw,1rem)] p-[clamp(0.585rem,1.35vw,0.75rem)]",
              )}
            >
              <div
                className="space-y-[clamp(0.585rem,1.35vw,0.75rem)]"
                data-oid="aqr55vy"
              >
                {visibleTokens.map((token) => (
                  <div
                    key={token.id}
                    className={cn(
                      settingsPanelClass(),
                      "existingTokenInsetRow overflow-hidden transition-[background,box-shadow,filter] hover:[filter:brightness(1.03)]",
                    )}
                    data-testid={`existing-token-row-${token.id}`}
                    data-oid="r:tjzmm"
                  >
                    <div
                      data-testid={`existing-token-main-row-${token.id}`}
                      className="flex flex-col items-stretch justify-between gap-[clamp(0.585rem,1.35vw,0.75rem)] sm:flex-row sm:items-start"
                      data-oid="uit:r1:"
                    >
                      <div className="min-w-0 flex-1" data-oid="ec9rooh">
                        <div
                          className="flex items-center gap-[clamp(0.39rem,0.9vw,0.5rem)]"
                          data-oid="oou06jt"
                        >
                          <h4
                            className="truncate text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-panel-value)]"
                            data-oid="ga42q36"
                          >
                            {token.name}
                          </h4>
                          {token.expires_at &&
                            new Date(token.expires_at) < new Date() && (
                              <span
                                className="neu-raised-sm font-brand rounded-full border-0 px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.0975rem,0.3vw,0.125rem)] text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-[var(--settings-expired-text)]"
                                data-oid="f6orwcm"
                              >
                                Expired
                              </span>
                            )}
                        </div>
                        <div
                          data-testid={`existing-token-meta-grid-${token.id}`}
                          className="mt-[clamp(0.39rem,0.9vw,0.5rem)] grid grid-cols-1 gap-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-panel-muted)] sm:grid-cols-2"
                          data-oid="zanp7p:"
                        >
                          <p
                            className="font-brand font-normal tracking-wide"
                            data-oid="bln6ddu"
                          >
                            Created:{" "}
                            {new Date(token.created_at).toLocaleString()}
                          </p>
                          {token.last_used_at ? (
                            <p
                              className="font-brand font-normal tracking-wide"
                              data-oid="keu..s7"
                            >
                              Last used:{" "}
                              {new Date(token.last_used_at).toLocaleString()}
                            </p>
                          ) : (
                            <p
                              className="font-brand font-normal tracking-wide"
                              data-oid="j4m-3vs"
                            >
                              Last used: -
                            </p>
                          )}
                          <p
                            className="font-brand sm:col-span-2 font-normal tracking-wide"
                            data-oid="_yyzdgl"
                          >
                            Expires:
                            {token.expires_at ? (
                              <>
                                {" "}
                                {new Date(token.expires_at).toLocaleString()}
                              </>
                            ) : (
                              " Never"
                            )}
                          </p>
                          <p className="font-brand font-normal tracking-wide">
                            WebDAV:{" "}
                            {token.webdav_enabled ? "Enabled" : "Disabled"}
                          </p>
                          <p className="font-brand font-normal tracking-wide">
                            Mode:{" "}
                            {token.webdav_read_only
                              ? "Read-only"
                              : "Read/write"}
                          </p>
                          <p className="font-brand sm:col-span-2 font-normal tracking-wide">
                            Root:{" "}
                            {token.webdav_root_folder_id ?? "Full account"}
                          </p>
                        </div>
                      </div>
                      <div className="flex w-full flex-col gap-[clamp(0.39rem,0.9vw,0.5rem)] sm:w-auto sm:flex-row">
                        <button
                          type="button"
                          onClick={() => beginEditToken(token)}
                          disabled={loading}
                          aria-label={`Edit ${token.name}`}
                          className={cn(
                            "existingTokenFlatAction existingTokenFlatAction--edit inline-flex w-full items-center justify-center gap-[clamp(0.28rem,0.7vw,0.38rem)] rounded-full px-[clamp(0.58rem,1.35vw,0.74rem)] py-[clamp(0.3rem,0.78vw,0.4rem)] text-[length:var(--settings-text-xs)] font-semibold sm:w-auto",
                            "transition-[background,color,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-60",
                          )}
                        >
                          <Pencil
                            className="h-[clamp(0.68rem,1.55vw,0.82rem)] w-[clamp(0.68rem,1.55vw,0.82rem)]"
                            aria-hidden="true"
                          />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteToken(token)}
                          disabled={loading}
                          aria-label={`Delete ${token.name}`}
                          className={cn(
                            "existingTokenFlatAction existingTokenFlatAction--delete inline-flex w-full items-center justify-center gap-[clamp(0.28rem,0.7vw,0.38rem)] rounded-full px-[clamp(0.58rem,1.35vw,0.74rem)] py-[clamp(0.3rem,0.78vw,0.4rem)] text-[length:var(--settings-text-xs)] font-semibold sm:w-auto",
                            "transition-[background,color,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-60",
                          )}
                          data-oid="novnj:6"
                        >
                          <Trash2
                            className="h-[clamp(0.68rem,1.55vw,0.82rem)] w-[clamp(0.68rem,1.55vw,0.82rem)]"
                            aria-hidden="true"
                            data-oid="8uqj4qt"
                          />
                          Delete
                        </button>
                      </div>
                    </div>
                    {editingToken?.id === token.id && (
                      <div className="neu-inset mt-[clamp(0.78rem,1.8vw,1rem)] rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]">
                        <div className="grid gap-[clamp(0.78rem,1.8vw,1rem)] lg:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`edit-token-name-${token.id}`}
                              className={settingsLabelClass()}
                            >
                              Edit token name
                            </label>
                            <input
                              id={`edit-token-name-${token.id}`}
                              value={editTokenName}
                              onChange={(event) =>
                                setEditTokenName(event.target.value)
                              }
                              className={settingsInputClass(false)}
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`edit-token-root-${token.id}`}
                              className={settingsLabelClass()}
                            >
                              Edit WebDAV root folder ID
                            </label>
                            <input
                              id={`edit-token-root-${token.id}`}
                              value={editWebDavRootFolderId}
                              onChange={(event) =>
                                setEditWebDavRootFolderId(event.target.value)
                              }
                              placeholder="Full account"
                              className={settingsInputClass(false)}
                            />
                          </div>
                          <label className={webDavOptionCardClass}>
                            <input
                              type="checkbox"
                              checked={editWebDavEnabled}
                              onChange={(event) =>
                                setEditWebDavEnabled(event.target.checked)
                              }
                              className="peer sr-only"
                            />
                            <span
                              aria-hidden="true"
                              className={webDavOptionIndicatorClass}
                            />
                            <span>
                              <span className="block text-[length:var(--settings-text-sm)] font-semibold">
                                Edit WebDAV enabled
                              </span>
                            </span>
                          </label>
                          <label className={webDavOptionCardClass}>
                            <input
                              type="checkbox"
                              checked={editWebDavReadOnly}
                              onChange={(event) =>
                                setEditWebDavReadOnly(event.target.checked)
                              }
                              className="peer sr-only"
                            />
                            <span
                              aria-hidden="true"
                              className={webDavOptionIndicatorClass}
                            />
                            <span>
                              <span className="block text-[length:var(--settings-text-sm)] font-semibold">
                                Edit WebDAV read-only
                              </span>
                            </span>
                          </label>
                        </div>
                        <div className="mt-[clamp(0.78rem,1.8vw,1rem)] flex flex-col gap-[clamp(0.39rem,0.9vw,0.5rem)] sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={cancelEditToken}
                            className={settingsSecondaryButtonClass(
                              "inline-flex items-center justify-center",
                            )}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveEditToken}
                            disabled={loading}
                            className={settingsPrimaryButtonClass(
                              "inline-flex items-center justify-center gap-[clamp(0.39rem,0.9vw,0.5rem)]",
                            )}
                          >
                            <Save
                              className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]"
                              aria-hidden="true"
                            />
                            Save token changes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  );
});

export default ApiTokenSection;
