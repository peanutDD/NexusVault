import { trackError } from "../utils/telemetry";

export function setupGlobalErrorTracking() {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("error", (event) => {
    trackError(event.error ?? event.message, {
      action: "window_error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    trackError(event.reason, {
      action: "unhandled_rejection",
    });
  });
}
