/**
 * Build URLSearchParams from a record. Skip undefined/null/empty appropriately.
 */

export function buildQueryParams(
  obj: Record<string, string | number | undefined | null>
): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    p.append(k, String(v));
  }
  return p;
}
