import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authService } from "../../services/auth";
import { useAuthStore } from "../../store/authStore";
import type { User } from "../../types/auth";
import Spinner from "../common/feedback/Spinner";

export default function GithubCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const doFetch = async () => {
      try {
        const data = (await authService.getMeWithToken(token)) as {
          user: User;
        };
        // setAuth 会把 token 写入 store 和 localStorage，后续 axios 请求走统一拦截器
        setAuth(data.user, token);
        navigate("/files", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    };

    void doFetch();
  }, [location.search, navigate, setAuth]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-[clamp(0.585rem,1.35vw,0.75rem)] bg-[var(--app-shell-loading-bg)] text-[var(--app-shell-loading-text)]"
      data-oid="3_gaj4w"
    >
      <Spinner size="lg" data-oid="a8rbjv8" />
      <span data-oid="ctq.rkj">Signing you in with GitHub…</span>
    </div>
  );
}
