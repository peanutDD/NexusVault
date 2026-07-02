import fs from "node:fs/promises";
import path from "node:path";

const cwdRoot = path.resolve(process.cwd());
const rootArg = process.argv.find((arg) => arg.startsWith("--root="));
const scopeArg = process.argv.find((arg) => arg.startsWith("--scope="));
const projectRoot = rootArg ? path.resolve(rootArg.slice("--root=".length)) : cwdRoot;
const scope = scopeArg ? scopeArg.slice("--scope=".length) : rootArg ? "all" : "pr1";

const exts = new Set([".css", ".ts", ".tsx"]);

const scopes = {
  pr1: [
    "src/pages",
    "src/components/layout",
    "src/components/common",
    "src/components/files/upload",
    "src/styles/base.css",
    "src/styles/misc.css",
    "src/styles/devtools.css",
  ],
  filelist: [
    "src/components/files/list",
    "src/components/files/grid",
  ],
  preview: [
    "src/components/files/preview",
    "src/styles/preview.css",
  ],
  dialogs: [
    "src/components/common/dialog",
    "src/components/files/dialogs",
    "src/components/files/list/FileListDialogs.tsx",
    "src/styles/confirm-dialog.css",
  ],
  global: [
    "src/styles/tokens.css",
    "src/styles/cta.css",
    "src/styles/nav.css",
    "src/providers/QueryProvider.tsx",
    "src/components/files/InfiniteScrollSentinel.tsx",
  ],
  all: ["src"],
  "tailwind-visual": ["src"],
  "tailwind-shell-common": [
    "src/components/common/BrowserCompatibilityWarning.tsx",
    "src/components/common/EmptyState.tsx",
    "src/components/common/feedback/ErrorMessage.tsx",
    "src/components/layout",
    "src/components/ErrorBoundary.tsx",
    "src/providers/AuthProvider.tsx",
    "src/router/AppRouter.tsx",
  ],
  "tailwind-filelist-trash": [
    "src/components/files/grid",
    "src/components/files/list",
    "src/pages/Trash.tsx",
  ],
};

const targetEntries = scopes[scope] ?? scopes.pr1;
const isTailwindVisualScope = scope.startsWith("tailwind-");
const fixedPxRe = /(?<![\w.-])-?(?:0|[1-9]\d*)(?:\.\d+)?px\b/g;
const tailwindVariantPrefix = "(?:[a-z0-9-]+:)*";
const tailwindSpacingPrefix =
  "-?(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|w|h|min-w|min-h|max-w|max-h|size|inset|inset-x|inset-y|top|right|bottom|left|translate-x|translate-y|scroll-mt|scroll-mb|scroll-pt|scroll-pb|scroll-pl|scroll-pr)";
const tailwindVisualScaleRe = new RegExp(
  [
    `(?<![\\w/-])${tailwindVariantPrefix}${tailwindSpacingPrefix}-(?!(?:0|px|full|screen|svh|lvh|dvh|auto|min|max|fit)\\b)(?:[2-9]xl|\\d+(?:\\.\\d+)?|xs|sm|md|lg|xl)(?![\\w/-])`,
    `(?<![\\w/-])${tailwindVariantPrefix}text-(?:xs|sm|base|lg|xl|[2-9]xl)(?![\\w/-])`,
    `(?<![\\w/-])${tailwindVariantPrefix}rounded-(?:sm|md|lg|xl|[2-9]xl)(?![\\w/-])`,
    `(?<![\\w/-])${tailwindVariantPrefix}blur-(?:sm|md|lg|xl|[2-9]xl|\\d+(?:\\.\\d+)?)(?![\\w/-])`,
  ].join("|"),
  "g",
);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function* walk(entryPath) {
  let stat;
  try {
    stat = await fs.stat(entryPath);
  } catch {
    return;
  }

  if (stat.isFile()) {
    if (exts.has(path.extname(entryPath))) yield entryPath;
    return;
  }

  if (!stat.isDirectory()) return;
  const entries = await fs.readdir(entryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.includes(".test.")) continue;
    yield* walk(path.join(entryPath, entry.name));
  }
}

function toRel(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*/")
  );
}

function isInsideSingleLineClamp(line, index) {
  const before = line.slice(0, index);
  const clampIndex = before.lastIndexOf("clamp(");
  return clampIndex !== -1;
}

function isBuiltInException(value, line) {
  if (value === "0px") return true;
  if (value === "999px") return true;
  if (value === "1px" || value === "2px") return true;
  if (/^\s*@media\b/.test(line)) return true;
  return false;
}

function findFixedPx(content) {
  const hits = [];
  const lines = content.split("\n");

  lines.forEach((line, lineIndex) => {
    if (isCommentLine(line)) return;
    for (const match of line.matchAll(fixedPxRe)) {
      const value = match[0];
      const index = match.index ?? 0;
      if (line.includes("fluid-sizing-allow:")) continue;
      if (isInsideSingleLineClamp(line, index)) continue;
      if (isBuiltInException(value, line)) continue;
      hits.push({
        value,
        line: lineIndex + 1,
        col: index + 1,
        snippet: line.trim(),
      });
    }
  });

  return hits;
}

function findFixedTailwindVisualScale(content, filePath) {
  const hits = [];
  const lines = content.split("\n");

  lines.forEach((line, lineIndex) => {
    if (isCommentLine(line)) return;
    if (line.includes("fluid-sizing-allow:")) return;
    if (!shouldScanTailwindVisualLine(filePath, line)) return;
    for (const match of line.matchAll(tailwindVisualScaleRe)) {
      const value = match[0];
      const index = match.index ?? 0;
      hits.push({
        value,
        line: lineIndex + 1,
        col: index + 1,
        snippet: line.trim(),
      });
    }
  });

  return hits;
}

function shouldScanTailwindVisualLine(filePath, line) {
  if (path.extname(filePath) === ".css") return false;
  if (
    line.includes("className") ||
    line.includes("classNames") ||
    line.includes("cn(") ||
    line.includes("clsx(") ||
    line.includes("cva(") ||
    line.includes("twMerge(")
  ) {
    return true;
  }

  const baseName = path.basename(filePath);
  if (baseName === "styles.ts" || baseName === "style.ts") return true;
  return /^\s*["'`][^"'`]*(?:\bp-|px-|py-|h-|w-|max-w-|text-|rounded-|gap-)/.test(line);
}

const results = [];
for (const entry of targetEntries) {
  const entryPath = path.join(projectRoot, entry);
  if (!(await exists(entryPath))) continue;
  for await (const filePath of walk(entryPath)) {
    const content = await fs.readFile(filePath, "utf8");
    const hits =
      isTailwindVisualScope
        ? findFixedTailwindVisualScale(content, filePath)
        : findFixedPx(content);
    if (hits.length > 0) {
      results.push({ filePath, hits });
    }
  }
}

if (results.length === 0) {
  const label =
    isTailwindVisualScope
      ? "fixed Tailwind visual scale utilities"
      : "fixed px dimensions";
  process.stdout.write(`OK: no ${label} in ${scope} fluid sizing scope.\n`);
  process.exit(0);
}

if (isTailwindVisualScope) {
  process.stdout.write(
    [
      "Found fixed Tailwind visual scale utilities in enforced frontend scopes.",
      "Policy: user-visible Tailwind scale dimensions should use semantic CSS tokens or explicit clamp()/min()/max() utilities.",
      "Allowed exceptions must be marked with fluid-sizing-allow: <reason>.",
      "",
    ].join("\n"),
  );
} else {
  process.stdout.write(
    [
      "Found fixed px dimensions in enforced frontend scopes.",
      "Policy: user-visible dimensions should use clamp(), rem, viewport units, or semantic CSS tokens.",
      "Allowed exceptions must be built-in hairlines/pills or marked with fluid-sizing-allow: <reason>.",
      "",
    ].join("\n"),
  );
}

for (const result of results) {
  process.stdout.write(`${toRel(result.filePath)}\n`);
  for (const hit of result.hits.slice(0, 40)) {
    process.stdout.write(
      `  - ${hit.value} (${hit.line}:${hit.col}) ${hit.snippet}\n`,
    );
  }
  if (result.hits.length > 40) {
    process.stdout.write(`  - ... +${result.hits.length - 40} more\n`);
  }
  process.stdout.write("\n");
}

process.exit(2);
