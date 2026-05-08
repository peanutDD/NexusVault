export const TRASH_RETURN_TO_KEY = "trash-return-to";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function isFilesLocation(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/files");
}

export function currentFilesLocation(pathname: string, search = ""): string | null {
  if (!pathname.startsWith("/files")) return null;
  return `${pathname}${search}`;
}

export function rememberTrashReturnTarget(target: string | null | undefined): void {
  if (!isFilesLocation(target) || !canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(TRASH_RETURN_TO_KEY, target);
  } catch {
    // Session storage can be unavailable in hardened browser contexts.
  }
}

export function readTrashReturnTarget(): string | null {
  if (!canUseSessionStorage()) return null;
  try {
    const target = window.sessionStorage.getItem(TRASH_RETURN_TO_KEY);
    return isFilesLocation(target) ? target : null;
  } catch {
    return null;
  }
}

export function resolveTrashReturnTarget(candidate?: string | null): string {
  if (isFilesLocation(candidate)) return candidate;
  return readTrashReturnTarget() ?? "/files";
}
