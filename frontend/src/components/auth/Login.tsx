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

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login(data);
      setAuth(response.user, response.token);
      navigate("/files");
    } catch (err) {
      setError(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setGithubLoading(true);
    setError(null);
    try {
      const { url } = await authService.getGithubOAuthUrl();
      window.location.href = url;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to initiate GitHub login"));
      setGithubLoading(false);
    }
  };

  return (
    <div className={AUTH_PAGE_CLASSES} data-oid="c81a8nz">
      <div className="w-full max-w-md mx-4 animate-fade-in" data-oid="73-1cga">
        <div className={AUTH_CARD_CLASSES} data-oid="12or9nf">
          {/* 顶部渐变光效，与主页卡片呼应 */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-transparent to-emerald-400/10"
            data-oid="wd63wdd"
          />

          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent"
            data-oid="51vqbla"
          />

          <div className="relative z-10" data-oid="zf-:ywt">
            <div
              className="flex items-center justify-center mb-8"
              data-oid="ij_sc42"
            >
              <div className="relative" data-oid="ibkt9b-">
                <div
                  className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-tr from-emerald-400/60 via-fuchsia-500/60 to-cyan-400/60 opacity-60 blur-md"
                  data-oid="_2u:we8"
                />

                <div
                  className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/40 bg-slate-950/90 shadow-[0_18px_70px_rgba(0,0,0,0.65)]"
                  data-oid="_29y:4u"
                >
                  <CyberPrismLogo className="h-10 w-10" data-oid="5vbrkrr" />
                </div>
              </div>
            </div>

            <h1 className={AUTH_TITLE_CLASSES} data-oid="jpc4cvj">
              FILE PORTAL
            </h1>
            <p className={AUTH_SUBTITLE_CLASSES} data-oid=".mc:jbb">
              Sign in to upload, preview and share your files.
            </p>

            {error && (
              <div className={AUTH_ERROR_BOX_CLASSES} data-oid="i6m9cnj">
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              data-oid=".wvtkow"
            >
              <div data-oid="y8m-gm9">
                <label className={AUTH_LABEL_CLASSES} data-oid="lqywvi6">
                  Email
                </label>
                <input
                  {...register("email")}
                  type="email"
                  className={AUTH_INPUT_CLASSES}
                  placeholder="you@example.com"
                  data-oid="snubptr"
                />

                {errors.email && (
                  <p className={AUTH_ERROR_CLASSES} data-oid="2oxyq.r">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div data-oid="7:x0rz2">
                <label className={AUTH_LABEL_CLASSES} data-oid="l03iiw8">
                  Password
                </label>
                <input
                  {...register("password")}
                  type="password"
                  className={AUTH_INPUT_CLASSES}
                  placeholder="••••••••"
                  data-oid="wb1uwd_"
                />

                {errors.password && (
                  <p className={AUTH_ERROR_CLASSES} data-oid="m9ybcxh">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={AUTH_BUTTON_CLASSES}
                data-oid="yhnlghk"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-6" data-oid="jsgbksl">
              <button
                type="button"
                onClick={handleGithubLogin}
                disabled={githubLoading}
                className="w-full inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800/80 transition-colors"
                data-oid="dd3dfhp"
              >
                {githubLoading
                  ? "Redirecting to GitHub…"
                  : "Sign in with GitHub"}
              </button>
            </div>

            <div className="mt-3" data-oid="l.f21zd">
              <button
                type="button"
                disabled
                className="w-full inline-flex items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/40 px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed"
                data-oid="heomkn5"
              >
                Sign in with Google (coming soon)
              </button>
            </div>

            <p
              className="font-brand mt-6 text-center text-slate-400 text-sm"
              data-oid="35zdoqk"
            >
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="font-brand text-emerald-300 hover:text-emerald-200 font-medium"
                data-oid="h5vh81."
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
