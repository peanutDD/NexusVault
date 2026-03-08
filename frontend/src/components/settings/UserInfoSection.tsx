import { memo, useState, useCallback, useMemo, useEffect } from "react";
import { UserCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "../../utils/cn";
import ErrorMessage from "../common/feedback/ErrorMessage";
import SettingsCard from "./SettingsCard";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/auth";
import { getErrorMessage } from "../../utils/error";
import { validateEmail } from "../../utils/emailValidation";

interface ProfileFormValues {
  username: string;
  email: string;
  emailVerificationCode?: string;
}

const UserInfoSection = memo(function UserInfoSection() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [sendCodeCooldown, setSendCodeCooldown] = useState(0);

  const profileSchema = useMemo(() => {
    const currentEmail = user?.email ?? "";
    return z
      .object({
        username: z
          .string()
          .trim()
          .min(3, "Username must be at least 3 characters")
          .max(50, "Username must be at most 50 characters"),
        email: z
          .string()
          .trim()
          .superRefine((value, ctx) => {
            const r = validateEmail(value);
            if (!r.valid && r.message) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.message });
            }
          }),
        emailVerificationCode: z.string().trim().optional(),
      })
      .superRefine((data, ctx) => {
        if (currentEmail && data.email !== currentEmail) {
          const code = (data.emailVerificationCode ?? "").trim();
          if (!code) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Email verification code is required when changing email",
              path: ["emailVerificationCode"],
            });
            return;
          }
          if (!/^\d{6}$/.test(code)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Verification code must be 6 digits",
              path: ["emailVerificationCode"],
            });
          }
        }
      });
  }, [user?.email]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      emailVerificationCode: "",
    },
    mode: "onBlur",
  });

  // Sync form when user changes (e.g. initial load)
  useEffect(() => {
    if (user) {
      reset({
        username: user.username,
        email: user.email,
        emailVerificationCode: "",
      });
    }
  }, [user, reset]);

  // Cooldown timer
  useEffect(() => {
    if (sendCodeCooldown <= 0) return;
    const t = setInterval(() => {
      setSendCodeCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [sendCodeCooldown]);

  const emailValue = watch("email");
  const canSendCode = useMemo(() => {
    const email = (emailValue ?? "").trim();
    if (!email) return false;
    const emailResult = validateEmail(email);
    if (!emailResult.valid) return false;
    if (user && email === user.email) return false;
    return true;
  }, [emailValue, user]);

  const handleSendVerificationCode = useCallback(async () => {
    setError(null);
    setSuccess(null);
    
    if (!canSendCode) return;

    setSendingCode(true);
    try {
      await authService.sendEmailVerification(emailValue);
      setSuccess("Verification code sent. Check your inbox.");
      setSendCodeCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send verification code"));
    } finally {
      setSendingCode(false);
    }
  }, [canSendCode, emailValue]);

  const onSubmit = useCallback(async (data: ProfileFormValues) => {
    setError(null);
    setSuccess(null);

    const username = data.username.trim();
    const email = data.email.trim();

    if (user && username === user.username && email === user.email) {
      setSuccess("No changes made");
      return;
    }

    setLoading(true);
    try {
      const { username_available, email_available } =
        await authService.checkProfileAvailability({
          username,
          email,
        });
      const availabilityErrors: string[] = [];
      if (!username_available) availabilityErrors.push("Username is taken");
      if (!email_available) availabilityErrors.push("Email is taken");
      if (availabilityErrors.length > 0) {
        setError(availabilityErrors.join("; "));
        return;
      }

      const payload: {
        username: string;
        email: string;
        email_verification_code?: string;
      } = { username, email };
      
      if (
        user &&
        email !== user.email &&
        data.emailVerificationCode?.trim()
      ) {
        payload.email_verification_code = data.emailVerificationCode.trim();
      }

      const { user: newUser } = await authService.updateProfile(payload);
      updateUser(newUser);
      setSuccess("Profile updated");
      setValue("emailVerificationCode", "");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update profile"));
    } finally {
      setLoading(false);
    }
  }, [user, updateUser, setValue]);

  const handleCloseError = useCallback(() => setError(null), []);
  const handleCloseSuccess = useCallback(() => setSuccess(null), []);

  return (
    <SettingsCard
      id="profile"
      title="Account"
      description="Update your username and email. Email changes require verification."
      icon={
        <UserCircle2
          className="h-5 w-5"
          aria-hidden="true"
          data-oid=":xh-78x"
        />
      }
      data-oid="n9osl2q"
    >
      {error && (
        <ErrorMessage
          message={error}
          onClose={handleCloseError}
          type="error"
          autoDismissMs={5000}
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
          data-oid="rslw:5_"
        />
      )}
      {success && (
        <ErrorMessage
          message={success}
          onClose={handleCloseSuccess}
          type="info"
          autoDismissMs={3000}
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
          data-oid="73_qjhq"
        />
      )}
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
        data-oid=".gy:f9i"
      >
        <div data-oid="pqfg1l8">
          <label
            htmlFor="profile-username"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
            data-oid="m6ngi28"
          >
            Username
          </label>
          <input
            id="profile-username"
            type="text"
            {...register("username")}
            minLength={3}
            maxLength={50}
            placeholder="3–50 characters"
            className={cn(
              "w-full rounded-xl px-4 py-2.5",
              "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
              "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
              errors.username && "border-red-500 focus:ring-red-500"
            )}
            data-oid="nrlh9g1"
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-500">{errors.username.message}</p>
          )}
        </div>
        <div data-oid="lz88_h5">
          <label
            htmlFor="profile-email"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
            data-oid="vaeuha7"
          >
            Email
          </label>
          <div className="flex gap-2" data-oid="wvivq7f">
            <input
              id="profile-email"
              type="email"
              {...register("email")}
              className={cn(
                "flex-1 rounded-xl px-4 py-2.5",
                "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
                "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
                errors.email && "border-red-500 focus:ring-red-500"
              )}
              data-oid=":o6py4z"
            />

            <button
              type="button"
              onClick={handleSendVerificationCode}
              disabled={
                !canSendCode || sendingCode || sendCodeCooldown > 0 || loading
              }
              className={cn(
                "font-brand shrink-0 rounded-xl px-4 py-2.5 text-[length:var(--settings-text-sm)] font-semibold tracking-wide whitespace-nowrap",
                "border border-[var(--settings-secondary-border)] bg-[var(--settings-secondary-bg)] text-[var(--settings-secondary-text)]",
                "hover:bg-[var(--settings-secondary-bg-hover)] hover:border-[var(--settings-secondary-border-hover)]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              data-oid="zvpvalp"
            >
              {sendCodeCooldown > 0
                ? `${sendCodeCooldown}s`
                : sendingCode
                  ? "Sending..."
                  : "Get code"}
            </button>
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
          )}
          
          {user?.email && emailValue?.trim() !== user.email && (
            <div className="mt-2" data-oid="y9w43uk">
              <label
                htmlFor="profile-email-code"
                className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
                data-oid="z-oab7l"
              >
                Verification code
              </label>
              <input
                id="profile-email-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                {...register("emailVerificationCode")}
                placeholder="6 digits"
                maxLength={6}
                className={cn(
                  "w-full rounded-xl px-4 py-2.5",
                  "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
                  "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
                  errors.emailVerificationCode && "border-red-500 focus:ring-red-500"
                )}
                data-oid="ku82zss"
              />
              {errors.emailVerificationCode && (
                <p className="mt-1 text-sm text-red-500">{errors.emailVerificationCode.message}</p>
              )}
            </div>
          )}
        </div>
        <div
          className="rounded-xl border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-4"
          data-oid="gjqcw3z"
        >
          <p
            className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-panel-label)]"
            data-oid=":komo1h"
          >
            Registered
          </p>
          <p
            className="mt-1 text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-panel-value)]"
            data-oid="ma009es"
          >
            {user?.created_at
              ? new Date(user.created_at).toLocaleString()
              : "-"}
          </p>
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
          data-oid="-o5ufhh"
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </form>
    </SettingsCard>
  );
});

export default UserInfoSection;
