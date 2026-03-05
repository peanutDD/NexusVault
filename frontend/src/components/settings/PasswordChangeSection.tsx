import { memo } from "react";
import { KeyRound } from "lucide-react";
import { cn } from "../../utils/cn";
import ErrorMessage from "../common/feedback/ErrorMessage";
import SettingsCard from "./SettingsCard";

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface PasswordChangeSectionProps {
  passwordForm: PasswordForm;
  loading: boolean;
  error?: string | null;
  success?: string | null;
  onCloseError?: () => void;
  onCloseSuccess?: () => void;
  fieldErrors?: {
    current_password?: string;
    new_password?: string;
    confirm_password?: string;
  };
  onCurrentPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirmPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const PasswordChangeSection = memo(function PasswordChangeSection({
  passwordForm,
  loading,
  error,
  success,
  onCloseError,
  onCloseSuccess,
  fieldErrors,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: PasswordChangeSectionProps) {
  return (
    <SettingsCard
      id="security"
      title="Security"
      description="Change your password periodically and avoid reusing it across services."
      icon={
        <KeyRound className="h-5 w-5" aria-hidden="true" data-oid="8hmxl4n" />
      }
      data-oid="ne71trr"
    >
      {error && (
        <ErrorMessage
          message={error}
          onClose={onCloseError}
          type="error"
          autoDismissMs={5000}
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
          data-oid="h9n6kem"
        />
      )}
      {success && (
        <ErrorMessage
          message={success}
          onClose={onCloseSuccess}
          type="info"
          autoDismissMs={3000}
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
          data-oid="s.:7sdp"
        />
      )}
      <form
        onSubmit={onSubmit}
        noValidate
        className="space-y-4"
        data-oid="be5kts_"
      >
        <div data-oid="0h03yxf">
          <label
            htmlFor="current-password"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
            data-oid="6.-il:2"
          >
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            value={passwordForm.current_password}
            onChange={onCurrentPasswordChange}
            required
            aria-invalid={Boolean(fieldErrors?.current_password)}
            aria-describedby={
              fieldErrors?.current_password
                ? "current-password-error"
                : undefined
            }
            className={cn(
              "w-full rounded-xl px-4 py-2.5",
              "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
              "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
            )}
            data-oid="8_-nvyf"
          />

          {fieldErrors?.current_password && (
            <p
              id="current-password-error"
              className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-error)]"
              data-oid="hvyxc0c"
            >
              {fieldErrors.current_password}
            </p>
          )}
        </div>
        <div data-oid="hp88ntt">
          <label
            htmlFor="new-password"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
            data-oid="ig:8b27"
          >
            New password
          </label>
          <input
            id="new-password"
            type="password"
            value={passwordForm.new_password}
            onChange={onNewPasswordChange}
            required
            minLength={8}
            maxLength={64}
            aria-invalid={Boolean(fieldErrors?.new_password)}
            aria-describedby={
              fieldErrors?.new_password ? "new-password-error" : undefined
            }
            className={cn(
              "w-full rounded-xl px-4 py-2.5",
              "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
              "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
            )}
            data-oid="bnlj:z1"
          />

          {fieldErrors?.new_password ? (
            <p
              id="new-password-error"
              className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-error)]"
              data-oid="6-qjqxf"
            >
              {fieldErrors.new_password}
            </p>
          ) : (
            <p
              className="font-brand text-[var(--settings-form-helper)] text-[length:var(--settings-text-xs)] font-normal tracking-wide mt-1"
              data-oid=".--qsoi"
            >
              8–64 characters, include at least one letter and one digit
            </p>
          )}
        </div>
        <div data-oid="47ix9rd">
          <label
            htmlFor="confirm-password"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
            data-oid="5xmgdgc"
          >
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={passwordForm.confirm_password}
            onChange={onConfirmPasswordChange}
            required
            minLength={8}
            maxLength={64}
            aria-invalid={Boolean(fieldErrors?.confirm_password)}
            aria-describedby={
              fieldErrors?.confirm_password
                ? "confirm-password-error"
                : undefined
            }
            className={cn(
              "w-full rounded-xl px-4 py-2.5",
              "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
              "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
            )}
            data-oid=".8op07u"
          />

          {fieldErrors?.confirm_password && (
            <p
              id="confirm-password-error"
              className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-error)]"
              data-oid="3:cc56f"
            >
              {fieldErrors.confirm_password}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            "font-brand w-full rounded-xl px-4 py-2.5 font-semibold tracking-wide",
            "bg-[var(--settings-action-bg)] text-[var(--settings-action-text)]",
            "hover:bg-[var(--settings-action-bg-hover)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          data-oid="-zsxz4-"
        >
          {loading ? "Changing..." : "Change password"}
        </button>
      </form>
    </SettingsCard>
  );
});

export default PasswordChangeSection;
