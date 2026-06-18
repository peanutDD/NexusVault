import { currentFilesLocation, isFilesLocation } from "./trashReturnTarget";

export const ACTIVITY_RETURN_TO_KEY = "activity-return-to";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function rememberActivityReturnTarget(
  pathname: string,
  search = "",
): void {
  const target = currentFilesLocation(pathname, search);
  if (!isFilesLocation(target) || !canUseSessionStorage()) return;

  try {
    window.sessionStorage.setItem(ACTIVITY_RETURN_TO_KEY, target);
  } catch {
    // Session storage can be unavailable in hardened browser contexts.
  }
}

export function readActivityReturnTarget(): string | null {
  if (!canUseSessionStorage()) return null;

  try {
    const target = window.sessionStorage.getItem(ACTIVITY_RETURN_TO_KEY);
    return isFilesLocation(target) ? target : null;
  } catch {
    return null;
  }
}

export function resolveActivityReturnTarget(): string {
  return readActivityReturnTarget() ?? "/files";
}
