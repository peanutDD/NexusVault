import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { authService } from "../../services/auth";
import { useAuthStore } from "../../store/authStore";
import { getErrorMessage } from "../../utils/error";
import {
  AUTH_INPUT_CLASSES,
  AUTH_LABEL_CLASSES,
  AUTH_ERROR_CLASSES,
  AUTH_ERROR_BOX_CLASSES,
  AUTH_BUTTON_CLASSES,
  AUTH_PAGE_CLASSES,
  AUTH_CARD_CLASSES,
  AUTH_TITLE_CLASSES,
  AUTH_SUBTITLE_CLASSES,
} from "./styles";
import { CyberPrismLogo } from "../common/CyberPrismLogo";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.register(data);
      setAuth(response.user, response.token);
      navigate("/files");
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={AUTH_PAGE_CLASSES} data-oid="gscu-88">
      <div className="relative z-10 w-full max-w-[clamp(22rem,92vw,28rem)] mx-[clamp(0.78rem,1.8vw,1rem)] animate-fade-in" data-oid="3ffslsk">
        <div className={AUTH_CARD_CLASSES} data-oid="l6j05_4">
          <div className="relative z-10" data-oid="ic-zt:0">
            <div
              className="flex items-center justify-center mb-[clamp(1.75rem,3.6vw,2rem)]"
              data-oid="6967a3d"
            >
              <div className="relative" data-oid="4tynibj">
                <div
                  className="neu-raised-sm relative flex h-[clamp(3.75rem,7.2vw,4rem)] w-[clamp(3.75rem,7.2vw,4rem)] items-center justify-center rounded-[clamp(0.8rem,2vw,1rem)]"
                  data-oid="7s9x215"
                >
                  <CyberPrismLogo className="h-[clamp(2.25rem,4.5vw,2.5rem)] w-[clamp(2.25rem,4.5vw,2.5rem)]" data-oid="1hcfwy6" />
                </div>
              </div>
            </div>

            <h1 className={AUTH_TITLE_CLASSES} data-oid="1yhaiac">
              CREATE ACCOUNT
            </h1>
            <p className={AUTH_SUBTITLE_CLASSES} data-oid="qzbvht0">
              Join the portal to upload, preview and share your files.
            </p>

            {error && (
              <div className={AUTH_ERROR_BOX_CLASSES} data-oid="v9m45bh">
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-[clamp(0.78rem,1.8vw,1rem)]"
              data-oid="frpuy1l"
            >
              <div data-oid="9-qoq2b">
                <label
                  htmlFor="register-username"
                  className={AUTH_LABEL_CLASSES}
                  data-oid="tyfk1l8"
                >
                  Username
                </label>
                <input
                  {...register("username")}
                  id="register-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  className={AUTH_INPUT_CLASSES}
                  placeholder="johndoe"
                  data-oid="-w-ygpq"
                />

                {errors.username && (
                  <p className={AUTH_ERROR_CLASSES} data-oid="gh2:elt">
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div data-oid="buz1jo.">
                <label
                  htmlFor="register-email"
                  className={AUTH_LABEL_CLASSES}
                  data-oid="sa7q7p2"
                >
                  Email
                </label>
                <input
                  {...register("email")}
                  id="register-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  className={AUTH_INPUT_CLASSES}
                  placeholder="you@example.com"
                  data-oid="5be270a"
                />

                {errors.email && (
                  <p className={AUTH_ERROR_CLASSES} data-oid="zem23.x">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div data-oid="s.gblxc">
                <label
                  htmlFor="register-password"
                  className={AUTH_LABEL_CLASSES}
                  data-oid="p1i_69g"
                >
                  Password
                </label>
                <input
                  {...register("password")}
                  id="register-password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  className={AUTH_INPUT_CLASSES}
                  placeholder="••••••••"
                  data-oid="v5kzj7z"
                />

                {errors.password && (
                  <p className={AUTH_ERROR_CLASSES} data-oid="znco2ez">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={AUTH_BUTTON_CLASSES}
                data-oid="czr99y8"
              >
                {loading ? "Creating account…" : "Sign up"}
              </button>
            </form>

            <p
              className="font-brand mt-[clamp(1.25rem,2.7vw,1.5rem)] text-center text-[var(--auth-footer-text)] text-[clamp(0.75rem,1.8vw,0.875rem)]"
              data-oid="qzf9ydv"
            >
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-brand text-[var(--auth-footer-link-text)] hover:text-[var(--auth-footer-link-text-hover)] font-medium"
                data-oid="3uwc8l9"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
