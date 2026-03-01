import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

const scopeArg = process.argv.find((a) => a.startsWith('--scope='));
const scope = scopeArg ? scopeArg.slice('--scope='.length) : 'all';

const scopes = {
  pages: [path.join(projectRoot, 'src/pages')],
  layout: [path.join(projectRoot, 'src/components/layout')],
  common: [path.join(projectRoot, 'src/components/common')],
  all: [
    path.join(projectRoot, 'src/pages'),
    path.join(projectRoot, 'src/components/layout'),
    path.join(projectRoot, 'src/components/common'),
  ],
};

const targetDirs = scopes[scope] ?? scopes.all;

const exts = new Set(['.ts', '.tsx']);

const bannedRe =
  /\b(?:bg|text|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d{1,3})?\b/g;

const allowedExact = new Set([
  'bg-transparent',
  'text-current',
  'border-transparent',
  'ring-transparent',
  'from-transparent',
  'via-transparent',
  'to-transparent',
  'bg-inherit',
  'text-inherit',
  'border-inherit',
]);

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (exts.has(ext)) yield full;
    }
  }
}

function findBannedClasses(content) {
  const hits = [];
  for (const m of content.matchAll(bannedRe)) {
    const v = m[0];
    if (allowedExact.has(v)) continue;
    hits.push({ value: v, index: m.index ?? 0 });
  }
  return hits;
}

function indexToLineCol(content, index) {
  const prefix = content.slice(0, index);
  const lines = prefix.split('\n');
  return { line: lines.length, col: lines.at(-1)?.length ?? 0 };
}

function toRel(p) {
  return path.relative(projectRoot, p).replaceAll(path.sep, '/');
}

const results = [];
for (const dir of targetDirs) {
  for await (const filePath of walk(dir)) {
    const content = await fs.readFile(filePath, 'utf8');
    const hits = findBannedClasses(content);
    if (hits.length === 0) continue;
    results.push({ filePath, hits, content });
  }
}

const strict = process.argv.includes('--strict');

if (results.length === 0) {
  process.stdout.write('OK: no hardcoded Tailwind palette colors in enforced scopes.\n');
  process.exit(0);
}

process.stdout.write(
  [
    'Found hardcoded Tailwind palette colors in enforced scopes.',
    'Policy: use Semantic/Component Tokens (see docs/TOKENS_USAGE.md §5.4).',
    '',
  ].join('\n')
);

for (const r of results) {
  process.stdout.write(`${toRel(r.filePath)}\n`);
  const unique = new Map();
  for (const h of r.hits) {
    const key = `${h.value}@${h.index}`;
    unique.set(key, h);
  }
  const items = [...unique.values()].slice(0, 40);
  for (const h of items) {
    const { line, col } = indexToLineCol(r.content, h.index);
    process.stdout.write(`  - ${h.value} (${line}:${col})\n`);
  }
  if (unique.size > items.length) process.stdout.write(`  - ... +${unique.size - items.length} more\n`);
  process.stdout.write('\n');
}

process.exit(strict ? 2 : 0);
