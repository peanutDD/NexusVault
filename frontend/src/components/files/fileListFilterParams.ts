export function parseCollectionParam(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

export function getCurrentFolderParam(params: URLSearchParams): string | null {
  const folder = params.get("folder")?.trim();
  if (folder) return folder;
  const legacyFolder = params.get("folder_id")?.trim();
  return legacyFolder || null;
}

export function setCollectionParam(params: URLSearchParams, collections: string[]): URLSearchParams {
  const next = new URLSearchParams(params);
  const unique = parseCollectionParam(collections.join(","));
  if (unique.length > 0) next.set("collection", unique.join(","));
  else next.delete("collection");
  return next;
}

export function toggleCollectionParam(params: URLSearchParams, collection: string): URLSearchParams {
  if (!collection) return setCollectionParam(params, []);
  const current = parseCollectionParam(params.get("collection"));
  const next = current.includes(collection)
    ? current.filter((item) => item !== collection)
    : [...current, collection];
  return setCollectionParam(params, next);
}

export function toggleTagParam(params: URLSearchParams, tagId: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (!tagId || next.get("tag") === tagId) next.delete("tag");
  else next.set("tag", tagId);
  return next;
}

export function clearSmartFilterParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("collection");
  next.delete("tag");
  return next;
}
