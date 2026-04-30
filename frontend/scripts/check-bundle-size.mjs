#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Bundle size budget checker
//
// 设计原因（对照 AGENTS.md 第 4/9 条）：
// - `bundle-size-checker` 不是通用包，且 vite 已经产出 .gz / .br 文件
//   （见 frontend/vite.config.ts 的 vite-plugin-compression），
//   我们直接测量 gzip 后的真实大小 —— 最贴近"压缩后"的用户体感。
// - 预算分层：
//     DEFAULT_BUDGET_KB  = 200  —— 入口、路由 chunk、小 vendor
//     HEAVY_VENDOR_BUDGET= 400  —— 已知大件（pdf.js / three / hls.js / sentry）
//   大件名单与 vite.config.ts 的 manualChunks 保持一致，新增大件必须在这里登记。
// - 超预算即退出码 1，CI 拒绝合并。
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST_ASSETS = join(__dirname, "..", "dist", "assets");

const DEFAULT_BUDGET_KB = 200;
const HEAVY_VENDOR_BUDGET_KB = 400;

// 这些 chunk 名（前缀匹配）允许 400KB gzip 预算。
// 与 vite.config.ts → rollupOptions.output.manualChunks 保持同步。
const HEAVY_VENDORS = [
  "vendor-pdfjs",
  "vendor-three",
  "vendor-hls",
  "vendor-sentry",
  "vendor-zip",
];

/** @param {string} file */
function isHeavyVendor(file) {
  return HEAVY_VENDORS.some((name) => file.startsWith(name));
}

/** @param {number} bytes */
function kb(bytes) {
  return (bytes / 1024).toFixed(2);
}

let files;
try {
  files = readdirSync(DIST_ASSETS);
} catch (err) {
  console.error(`[bundle-size] dist/assets not found: ${err.message}`);
  console.error("[bundle-size] did `npm run build` succeed?");
  process.exit(1);
}

// 只对 gzip 后的 JS 产物做预算（.js.gz）。CSS 的体积 budget 另行处理。
const gzJs = files
  .filter((f) => f.endsWith(".js.gz"))
  .map((f) => {
    const full = join(DIST_ASSETS, f);
    const size = statSync(full).size;
    const original = basename(f, ".gz"); // foo-[hash].js
    return { gzFile: f, originalName: original, size };
  })
  .sort((a, b) => b.size - a.size);

if (gzJs.length === 0) {
  console.error(
    "[bundle-size] no *.js.gz found; vite-plugin-compression must be enabled.",
  );
  process.exit(1);
}

let hasViolation = false;
const rows = [];

for (const { gzFile, originalName, size } of gzJs) {
  const budgetKb = isHeavyVendor(originalName)
    ? HEAVY_VENDOR_BUDGET_KB
    : DEFAULT_BUDGET_KB;
  const budgetBytes = budgetKb * 1024;
  const over = size > budgetBytes;
  if (over) hasViolation = true;
  rows.push({
    file: originalName,
    gzipKb: kb(size),
    budgetKb,
    status: over ? "FAIL" : "ok",
  });
}

// 打印对齐表格
const colWidths = {
  file: Math.max(4, ...rows.map((r) => r.file.length)),
  gzipKb: 10,
  budgetKb: 10,
  status: 6,
};
const pad = (s, w) => String(s).padEnd(w);
console.log(
  `\n${pad("file", colWidths.file)}  ${pad("gzip(KB)", colWidths.gzipKb)}  ${pad(
    "budget",
    colWidths.budgetKb,
  )}  ${pad("status", colWidths.status)}`,
);
console.log("-".repeat(colWidths.file + colWidths.gzipKb + colWidths.budgetKb + colWidths.status + 6));
for (const r of rows) {
  console.log(
    `${pad(r.file, colWidths.file)}  ${pad(r.gzipKb, colWidths.gzipKb)}  ${pad(
      `${r.budgetKb} KB`,
      colWidths.budgetKb,
    )}  ${pad(r.status, colWidths.status)}`,
  );
}

if (hasViolation) {
  console.error(
    "\n[bundle-size] one or more chunks exceeded their gzip budget.",
  );
  console.error(
    "  - default budget: 200KB (gzip)",
  );
  console.error(
    `  - heavy vendor budget (${HEAVY_VENDORS.join(", ")}): 400KB (gzip)`,
  );
  console.error(
    "  fix: split chunks in vite.config.ts or register as heavy vendor (with justification in docs/constraints/ci-pipeline.md).",
  );
  process.exit(1);
}

console.log("\n[bundle-size] all chunks within budget ✅");
