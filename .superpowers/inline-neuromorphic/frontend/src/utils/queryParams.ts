/**
 * Build URLSearchParams from a record. Skip undefined/null/empty appropriately.
 */

export function buildQueryParams(
  obj: Record<string, string | number | undefined | null>
): URLSearchParams {
  // 使用链式调用替代 for 循环
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .reduce((params, [k, v]) => (params.append(k, String(v)), params), new URLSearchParams());
}
