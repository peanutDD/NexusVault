import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

function scopeFor(key: string, pathname: string, search: string) {
  const url = `${pathname}${search}`;
  return { entry: `${key}:${url}`, url };
}

type RouteScrollScope = NonNullable<ReturnType<typeof scopeFor>>;

const entryKeyFor = (scope: string) => `routeScroll:${scope}`;
const urlKeyFor = (url: string) => `routeScrollUrl:${url}`;
const parseScroll = (raw: string | null) => {
  if (!raw) return null;
  const y = Number.parseInt(raw, 10);
  return Number.isFinite(y) && y >= 0 ? y : null;
};
const readScroll = (scope: RouteScrollScope, allowUrlFallback: boolean) => {
  try {
    const entryScroll = parseScroll(sessionStorage.getItem(entryKeyFor(scope.entry)));
    if (entryScroll !== null) return entryScroll;
    return allowUrlFallback ? parseScroll(sessionStorage.getItem(urlKeyFor(scope.url))) : null;
  } catch {
    return null;
  }
};
const writeScroll = (scope: RouteScrollScope, y: number) => {
  try {
    const value = String(Math.max(0, Math.round(y)));
    sessionStorage.setItem(entryKeyFor(scope.entry), value);
    sessionStorage.setItem(urlKeyFor(scope.url), value);
  } catch {
    /* ignore */
  }
};

const RESTORE_MAX_ATTEMPTS = 120; // ~2s at 60fps — enough for virtual list mount + loadMore
const RESTORE_TOLERANCE = 2;

function restore(y: number) {
  if (y <= 0) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    });
    return;
  }
  let attempts = 0;
  let userInterrupted = false;
  const onUserScroll = () => {
    userInterrupted = true;
  };
  // Cancel restoration if the user manually scrolls (e.g. via wheel/touch).
  window.addEventListener("wheel", onUserScroll, { passive: true, once: true });
  window.addEventListener("touchmove", onUserScroll, { passive: true, once: true });
  window.addEventListener("keydown", onUserScroll, { once: true });

  const cleanup = () => {
    window.removeEventListener("wheel", onUserScroll);
    window.removeEventListener("touchmove", onUserScroll);
    window.removeEventListener("keydown", onUserScroll);
  };

  const tick = () => {
    if (userInterrupted) {
      cleanup();
      return;
    }
    window.scrollTo({ top: y, left: 0, behavior: "auto" });
    const reached = Math.abs((window.scrollY || 0) - y) <= RESTORE_TOLERANCE;
    attempts += 1;
    if (reached || attempts >= RESTORE_MAX_ATTEMPTS) {
      cleanup();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(() => requestAnimationFrame(tick));
}
export default function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const scopeRef = useRef(scopeFor(location.key, location.pathname, location.search));
  const didRestoreRef = useRef(false);
  const saveCurrent = useCallback(() => {
    if (scopeRef.current) writeScroll(scopeRef.current, window.scrollY || 0);
  }, []);
  useEffect(() => {
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const scope = scopeFor(location.key, location.pathname, location.search);
    if (didRestoreRef.current && scopeRef.current?.entry !== scope?.entry) saveCurrent();
    scopeRef.current = scope;
    didRestoreRef.current = true;
    if (scope) restore(readScroll(scope, navigationType !== "PUSH") ?? 0);
  }, [location.key, location.pathname, location.search, navigationType, saveCurrent]);
  useEffect(() => {
    let frame: number | null = null;
    const saveNow = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = null;
      saveCurrent();
    };
    const scheduleSave = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        saveCurrent();
      });
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.addEventListener("beforeunload", saveNow);
    window.addEventListener("pagehide", saveNow);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("scroll", scheduleSave);
      window.removeEventListener("beforeunload", saveNow);
      window.removeEventListener("pagehide", saveNow);
      document.removeEventListener("visibilitychange", saveWhenHidden);
      saveNow();
    };
  }, [saveCurrent]);

  return null;
}
