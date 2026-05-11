import fs from "node:fs/promises";
import path from "node:path";

const cwdRoot = path.resolve(process.cwd());
const rootArg = process.argv.find((arg) => arg.startsWith("--root="));
const projectRoot = rootArg ? path.resolve(rootArg.slice("--root=".length)) : cwdRoot;
const srcRoot = path.join(projectRoot, "src");
const exts = new Set([".css", ".ts", ".tsx"]);

const deployUrlRe = /https?:\/\/[^`'"\s)]+/g;
const rawThemeClassRe =
  /\b(?:bg|text|border|from|via|to|placeholder|hover:bg|hover:text|hover:border|focus:ring|focus:border|border-t)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d{1,3})?\b/g;
const colorFunctionRe = /\b(?:rgba?|hsla?)\(/g;
const timingLiteralRe = /\b(?:setTimeout|setInterval)\([^,\n]+,\s*\d[\d_]*(?:\.\d+)?\s*[),]/g;

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function* walk(entryPath) {
  if (!(await exists(entryPath))) return;
  const stat = await fs.stat(entryPath);
  if (stat.isFile()) {
    if (exts.has(path.extname(entryPath))) yield entryPath;
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of await fs.readdir(entryPath, { withFileTypes: true })) {
    if (entry.name.includes(".test.") || entry.name.includes(".spec.")) continue;
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

function hasAllow(line) {
  return line.includes("hardcoding-allow:");
}

function shouldIgnoreUrl(value, line) {
  return (
    value.startsWith("http://www.w3.org/") ||
    value.startsWith("https://www.w3.org/") ||
    value.startsWith("https://example.com/") ||
    value.startsWith("http://.../") ||
    hasAllow(line)
  );
}

function shouldScanThemeLine(filePath, line) {
  if (path.extname(filePath) !== ".tsx") return false;
  return (
    line.includes("className") ||
    line.includes("cn(") ||
    line.includes("classNames") ||
    line.includes("clsx(") ||
    /^\s*["'`]/.test(line)
  );
}

function shouldScanInlineColor(filePath, line) {
  if (path.extname(filePath) !== ".tsx") return false;
  return line.includes("style={{") || line.includes("style={");
}

function addHit(hits, kind, filePath, line, lineNumber, value, index) {
  hits.push({
    kind,
    filePath,
    line: lineNumber,
    col: index + 1,
    value,
    snippet: line.trim(),
  });
}

const hits = [];
for await (const filePath of walk(srcRoot)) {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (isCommentLine(line) || hasAllow(line)) return;
    const lineNumber = index + 1;

    for (const match of line.matchAll(deployUrlRe)) {
      const value = match[0];
      if (!shouldIgnoreUrl(value, line)) {
        addHit(hits, "deploy-url", filePath, line, lineNumber, value, match.index ?? 0);
      }
    }

    if (shouldScanThemeLine(filePath, line)) {
      for (const match of line.matchAll(rawThemeClassRe)) {
        addHit(
          hits,
          "raw-theme-color",
          filePath,
          line,
          lineNumber,
          match[0],
          match.index ?? 0,
        );
      }
    }

    if (shouldScanInlineColor(filePath, line)) {
      for (const match of line.matchAll(colorFunctionRe)) {
        addHit(
          hits,
          "inline-color-function",
          filePath,
          line,
          lineNumber,
          match[0],
          match.index ?? 0,
        );
      }
    }

    for (const match of line.matchAll(timingLiteralRe)) {
      addHit(hits, "magic-timing", filePath, line, lineNumber, match[0], match.index ?? 0);
    }
  });
}

if (hits.length === 0) {
  process.stdout.write("OK: no disallowed frontend hardcoding found.\n");
  process.exit(0);
}

process.stdout.write(
  [
    "Found disallowed frontend hardcoding.",
    "Policy: deployment URLs, raw theme colors, inline color functions, and timing literals should use env helpers, semantic tokens, or named constants.",
    "Allowed exceptions must be marked with hardcoding-allow: <reason>.",
    "",
  ].join("\n"),
);

const byFile = new Map();
for (const hit of hits) {
  const rel = toRel(hit.filePath);
  if (!byFile.has(rel)) byFile.set(rel, []);
  byFile.get(rel).push(hit);
}

for (const [file, fileHits] of byFile) {
  process.stdout.write(`${file}\n`);
  for (const hit of fileHits.slice(0, 40)) {
    process.stdout.write(
      `  - ${hit.kind}: ${hit.value} (${hit.line}:${hit.col}) ${hit.snippet}\n`,
    );
  }
  if (fileHits.length > 40) {
    process.stdout.write(`  - ... +${fileHits.length - 40} more\n`);
  }
  process.stdout.write("\n");
}

process.exit(2);
