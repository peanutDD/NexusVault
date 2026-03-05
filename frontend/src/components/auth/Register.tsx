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
      <div className="w-full max-w-md mx-4 animate-fade-in" data-oid="3ffslsk">
        <div className={AUTH_CARD_CLASSES} data-oid="l6j05_4">
          {/* 顶部渐变光效，与主页卡片呼应 */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-transparent to-emerald-400/10"
            data-oid="0q6535j"
          />

          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent"
            data-oid="q40rv1l"
          />

          <div className="relative z-10" data-oid="ic-zt:0">
            <div
              className="flex items-center justify-center mb-8"
              data-oid="6967a3d"
            >
              <div className="relative" data-oid="4tynibj">
                <div
                  className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-tr from-emerald-400/60 via-fuchsia-500/60 to-cyan-400/60 opacity-60 blur-md"
                  data-oid="zdazne6"
                />

                <div
                  className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/40 bg-slate-950/90 shadow-[0_18px_70px_rgba(0,0,0,0.65)]"
                  data-oid="7s9x215"
                >
                  <CyberPrismLogo className="h-10 w-10" data-oid="1hcfwy6" />
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
              className="space-y-4"
              data-oid="frpuy1l"
            >
              <div data-oid="9-qoq2b">
                <label className={AUTH_LABEL_CLASSES} data-oid="tyfk1l8">
                  Username
                </label>
                <input
                  {...register("username")}
                  type="text"
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
                <label className={AUTH_LABEL_CLASSES} data-oid="sa7q7p2">
                  Email
                </label>
                <input
                  {...register("email")}
                  type="email"
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
                <label className={AUTH_LABEL_CLASSES} data-oid="p1i_69g">
                  Password
                </label>
                <input
                  {...register("password")}
                  type="password"
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
              className="font-brand mt-6 text-center text-slate-400 text-sm"
              data-oid="qzf9ydv"
            >
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-brand text-emerald-300 hover:text-emerald-200 font-medium"
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
