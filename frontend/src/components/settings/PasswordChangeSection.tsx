import { memo, useState, useCallback, useMemo } from "react";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "../../utils/cn";
import ErrorMessage from "../common/feedback/ErrorMessage";
import SettingsCard from "./SettingsCard";
import { authService } from "../../services/auth";
import { getErrorMessage } from "../../utils/error";

interface PasswordFormValues {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

const PasswordChangeSection = memo(function PasswordChangeSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordSchema = useMemo(() => {
    return z
      .object({
        current_password: z.string().min(1, "Current password is required"),
        new_password: z
          .string()
          .min(8, "New password must be between 8 and 64 characters")
          .max(64, "New password must be between 8 and 64 characters")
          .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
            message:
              "New password must contain at least one letter and one digit",
          }),
        confirm_password: z.string(),
      })
      .superRefine((data, ctx) => {
        if (data.new_password !== data.confirm_password) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "New password and confirmation do not match",
            path: ["confirm_password"],
          });
        }
      });
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
    mode: "onBlur",
  });

  const onSubmit = useCallback(async (data: PasswordFormValues) => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await authService.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      setSuccess("Password changed");
      reset();
    } catch (err) {
      const message = getErrorMessage(err, "Failed to change password");
      if (
        message.includes("between 8 and 64") ||
        message.includes("one letter and one digit") ||
        message.includes("New password must")
      ) {
        setFormError("new_password", { message });
      } else if (
        message.toLowerCase().includes("password") ||
        message.includes("密码")
      ) {
        setFormError("current_password", { message });
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [reset, setFormError]);

  const handleCloseError = useCallback(() => setError(null), []);
  const handleCloseSuccess = useCallback(() => setSuccess(null), []);

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
          onClose={handleCloseError}
          type="error"
          autoDismissMs={5000}
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
          data-oid="h9n6kem"
        />
      )}
      {success && (
        <ErrorMessage
          message={success}
          onClose={handleCloseSuccess}
          type="info"
          autoDismissMs={3000}
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
          data-oid="s.:7sdp"
        />
      )}
      <form
        onSubmit={handleSubmit(onSubmit)}
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
            {...register("current_password")}
            required
            aria-invalid={Boolean(errors.current_password)}
            aria-describedby={
              errors.current_password
                ? "current-password-error"
                : undefined
            }
            className={cn(
              "w-full rounded-xl px-4 py-2.5",
              "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
              "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
              errors.current_password && "border-red-500 focus:ring-red-500"
            )}
            data-oid="8_-nvyf"
          />

          {errors.current_password && (
            <p
              id="current-password-error"
              className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-error)]"
              data-oid="hvyxc0c"
            >
              {errors.current_password.message}
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
            {...register("new_password")}
            required
            minLength={8}
            maxLength={64}
            aria-invalid={Boolean(errors.new_password)}
            aria-describedby={
              errors.new_password ? "new-password-error" : undefined
            }
            className={cn(
              "w-full rounded-xl px-4 py-2.5",
              "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
              "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
              errors.new_password && "border-red-500 focus:ring-red-500"
            )}
            data-oid="bnlj:z1"
          />

          {errors.new_password ? (
            <p
              id="new-password-error"
              className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-error)]"
              data-oid="6-qjqxf"
            >
              {errors.new_password.message}
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
            {...register("confirm_password")}
            required
            minLength={8}
            maxLength={64}
            aria-invalid={Boolean(errors.confirm_password)}
            aria-describedby={
              errors.confirm_password
                ? "confirm-password-error"
                : undefined
            }
            className={cn(
              "w-full rounded-xl px-4 py-2.5",
              "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
              "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
              errors.confirm_password && "border-red-500 focus:ring-red-500"
            )}
            data-oid=".8op07u"
          />

          {errors.confirm_password && (
            <p
              id="confirm-password-error"
              className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-error)]"
              data-oid="3:cc56f"
            >
              {errors.confirm_password.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            "font-brand w-full rounded-xl px-4 py-2.5 font-semibold tracking-wide",
            "border border-[var(--settings-action-border)] bg-[var(--settings-action-bg)] text-[var(--settings-action-text)] shadow-[var(--settings-action-shadow)]",
            "hover:bg-[image:var(--settings-action-bg-hover)]",
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
