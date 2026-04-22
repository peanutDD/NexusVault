import { API_BASE_URL } from "../config/env";

export function setupApiPreconnect() {
  if (typeof document === "undefined" || !API_BASE_URL.startsWith("http")) {
    return;
  }

  try {
    const origin = new URL(API_BASE_URL).origin;

    if (origin === window.location.origin) {
      return;
    }

    const existing = document.querySelector(
      `link[rel="preconnect"][href="${origin}"]`,
    );

    if (existing) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.setAttribute("crossorigin", "");
    document.head.appendChild(link);
  } catch {
    return;
  }
}
