import fs from "node:fs/promises";
import path from "node:path";

const cwdRoot = path.resolve(process.cwd());
const rootArg = process.argv.find((arg) => arg.startsWith("--root="));
const projectRoot = rootArg ? path.resolve(rootArg.slice("--root=".length)) : cwdRoot;
const srcRoot = path.join(projectRoot, "src");
const exts = new Set([".css", ".ts", ".tsx"]);

const residueRules = [
  {
    kind: "legacy-background-utility",
    re: /\[background:var\(|bg-\[var\(|hover:bg-\[var\(|hover:\[background/g,
  },
  {
    kind: "surface-gradient",
    re: /\bbg-gradient\b|linear-gradient|radial-gradient|repeating-linear-gradient/g,
  },
  {
    kind: "backdrop-filter",
    re: /backdrop-filter|-webkit-backdrop-filter|\bbackdrop-blur\b/g,
  },
  {
    kind: "legacy-depth-system",
    re: /neu-semantic-raised|glass-|static-scanlines|preview-static|shadow-glass|modal-surface-glass|trash-tech/g,
  },
  {
    kind: "indirect-background-image",
    re: /background-image\s*:\s*var\(/g,
  },
  {
    kind: "visible-surface-border",
    re: /(?:border-color\s*:\s*|border\s*:[^;]*|--[\w-]*border\s*:\s*)(?:rgba?\(|#[0-9a-fA-F]{3,8}\b)/g,
  },
];

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
    if (exts.has(path.extname(entryPath)) && path.basename(entryPath) !== "tokens.css") {
      yield entryPath;
    }
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
    if (isCommentLine(line) || line.includes("neuromorphic-allow:")) return;
    const lineNumber = index + 1;

    for (const rule of residueRules) {
      rule.re.lastIndex = 0;
      for (const match of line.matchAll(rule.re)) {
        addHit(hits, rule.kind, filePath, line, lineNumber, match[0], match.index ?? 0);
      }
    }
  });
}

if (hits.length === 0) {
  process.stdout.write("OK: all active Neuromorphic surfaces use global primitives.\n");
  process.exit(0);
}

process.stdout.write(
  [
    "Found disallowed Neuromorphic surface residue.",
    "Policy: active UI surfaces must use the global flat/raised/inset/pressed primitives, with no visible persistent border, surface gradient, backdrop/glass layer, or page-specific depth system.",
    "Allowed exceptions must be marked with neuromorphic-allow: <reason>.",
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
