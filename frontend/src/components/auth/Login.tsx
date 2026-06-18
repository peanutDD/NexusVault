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
  AUTH_OAUTH_BUTTON_CLASSES,
  AUTH_OAUTH_DISABLED_CLASSES,
} from "./styles";
import { CyberPrismLogo } from "../common/CyberPrismLogo";
import AuthShapeWaveBackground from "./AuthShapeWaveBackground";

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
      <AuthShapeWaveBackground />
      <div className="relative z-10 w-full max-w-[clamp(22rem,92vw,28rem)] mx-[clamp(0.78rem,1.8vw,1rem)] animate-fade-in" data-oid="73-1cga">
        <div className={AUTH_CARD_CLASSES} data-oid="12or9nf">
          {/* 顶部渐变光效，与主页卡片呼应 */}
          <div
            className="authCardGlow pointer-events-none absolute inset-0 bg-[image:var(--auth-card-glow-bg)]"
            data-oid="wd63wdd"
          />

          <div
            className="authCardEdge pointer-events-none absolute inset-x-0 top-0 h-px bg-[image:var(--auth-card-edge-bg)]"
            data-oid="51vqbla"
          />

          <div className="relative z-10" data-oid="zf-:ywt">
            <div
              className="flex items-center justify-center mb-[clamp(1.75rem,3.6vw,2rem)]"
              data-oid="ij_sc42"
            >
              <div className="relative" data-oid="ibkt9b-">
                <div
                  className="authLogoAura pointer-events-none absolute -inset-[clamp(0.195rem,0.45vw,0.25rem)] rounded-[clamp(0.8rem,2vw,1rem)] bg-[image:var(--auth-logo-aura-bg)] opacity-[var(--auth-logo-aura-opacity)] blur-[clamp(0.6rem,1.4vw,0.75rem)]"
                  data-oid="_2u:we8"
                />

                <div
                  className="relative flex h-[clamp(3.75rem,7.2vw,4rem)] w-[clamp(3.75rem,7.2vw,4rem)] items-center justify-center rounded-[clamp(0.8rem,2vw,1rem)] border border-[var(--auth-logo-shell-border)] [background:var(--auth-logo-shell-bg)] shadow-[var(--auth-logo-shell-shadow)]"
                  data-oid="_29y:4u"
                >
                  <CyberPrismLogo className="h-[clamp(2.25rem,4.5vw,2.5rem)] w-[clamp(2.25rem,4.5vw,2.5rem)]" data-oid="5vbrkrr" />
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
              className="space-y-[clamp(0.78rem,1.8vw,1rem)]"
              data-oid=".wvtkow"
            >
              <div data-oid="y8m-gm9">
                <label
                  htmlFor="login-email"
                  className={AUTH_LABEL_CLASSES}
                  data-oid="lqywvi6"
                >
                  Email
                </label>
                <input
                  {...register("email")}
                  id="login-email"
                  type="email"
                  name="email"
                  autoComplete="email"
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
                <label
                  htmlFor="login-password"
                  className={AUTH_LABEL_CLASSES}
                  data-oid="l03iiw8"
                >
                  Password
                </label>
                <input
                  {...register("password")}
                  id="login-password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
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

            <div className="mt-[clamp(1.25rem,2.7vw,1.5rem)]" data-oid="jsgbksl">
              <button
                type="button"
                onClick={handleGithubLogin}
                disabled={githubLoading}
                className={AUTH_OAUTH_BUTTON_CLASSES}
                data-oid="dd3dfhp"
              >
                {githubLoading
                  ? "Redirecting to GitHub…"
                  : "Sign in with GitHub"}
              </button>
            </div>

            <div className="mt-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="l.f21zd">
              <button
                type="button"
                disabled
                className={AUTH_OAUTH_DISABLED_CLASSES}
                data-oid="heomkn5"
              >
                Sign in with Google (coming soon)
              </button>
            </div>

            <p
              className="font-brand mt-[clamp(1.25rem,2.7vw,1.5rem)] text-center text-[var(--auth-footer-text)] text-[clamp(0.75rem,1.8vw,0.875rem)]"
              data-oid="35zdoqk"
            >
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="font-brand text-[var(--auth-footer-link-text)] hover:text-[var(--auth-footer-link-text-hover)] font-medium"
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
