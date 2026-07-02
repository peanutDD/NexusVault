import { currentFilesLocation, isFilesLocation } from "./trashReturnTarget";

export const SETTINGS_RETURN_TO_KEY = "settings-return-to";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function rememberSettingsReturnTarget(
  pathname: string,
  search = "",
): void {
  const target = currentFilesLocation(pathname, search);
  if (!isFilesLocation(target) || !canUseSessionStorage()) return;

  try {
    window.sessionStorage.setItem(SETTINGS_RETURN_TO_KEY, target);
  } catch {
    // Session storage can be unavailable in hardened browser contexts.
  }
}

export function readSettingsReturnTarget(): string | null {
  if (!canUseSessionStorage()) return null;

  try {
    const target = window.sessionStorage.getItem(SETTINGS_RETURN_TO_KEY);
    return isFilesLocation(target) ? target : null;
  } catch {
    return null;
  }
}

export function resolveSettingsReturnTarget(): string {
  return readSettingsReturnTarget() ?? "/files";
}
