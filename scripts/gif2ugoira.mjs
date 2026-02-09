#!/usr/bin/env node
/**
 * GIF → Ugoira 转换脚本
 * 用法: node scripts/gif2ugoira.mjs <filename.gif>
 * 源目录: frontend/gif-files/
 * 输出目录: frontend/gif2ugoira-files/
 * 依赖: ffmpeg、ffprobe（需已安装）
 */

import { spawn } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const GIF_DIR = path.join(ROOT, 'frontend/gif-files');
const UGOIRA_DIR = path.join(ROOT, 'frontend/gif2ugoira-files');
const JSZip = require(path.join(ROOT, 'frontend/node_modules/jszip'));

// -----------------------------------------------------------------------------
// 工具
// -----------------------------------------------------------------------------

function exec(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: opts.capture ? 'pipe' : 'inherit',
      ...opts,
    });
    let out = '';
    if (opts.capture && proc.stdout) {
      proc.stdout.on('data', (d) => { out += d; });
    }
    proc.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited with ${code}`));
    });
    proc.on('error', reject);
  });
}

function ensureFfmpeg() {
  return exec('ffmpeg', ['-version'], { stdio: 'ignore' }).catch(() => {
    throw new Error('未找到 ffmpeg，请先安装: brew install ffmpeg');
  });
}

/** 用 ffprobe 获取每帧时长（秒） */
async function getFrameDurations(gifPath) {
  const out = await exec('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'frame=duration',
    '-of', 'csv=p=0',
    gifPath,
  ], { capture: true });
  const lines = out.trim().split('\n').filter(Boolean);
  return lines.map((s) => {
    const d = parseFloat(s);
    return Number.isFinite(d) ? Math.round(d * 1000) : 100;
  });
}

/** 用 ffmpeg 拆帧到目录 */
async function extractFrames(gifPath, outDir) {
  const outPattern = path.join(outDir, 'frame_%04d.png');
  await exec('ffmpeg', [
    '-i', gifPath,
    '-vsync', '0',
    outPattern,
  ]);
}

/** 读取目录下 frame_*.png 并按序号排序 */
function listFrames(dir) {
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith('frame_') && f.endsWith('.png'))
    .sort();
  return files;
}

// -----------------------------------------------------------------------------
// 主逻辑
// -----------------------------------------------------------------------------

async function main() {
  const filename = process.argv[2];

  if (!filename) {
    console.error('用法: node scripts/gif2ugoira.mjs <filename.gif>');
    console.error('  将 frontend/gif-files/<filename.gif> 转为 frontend/gif2ugoira-files/<filename>.ugoira');
    process.exit(1);
  }

  const inputPath = path.join(GIF_DIR, path.basename(filename));
  if (!fs.existsSync(inputPath)) {
    console.error('文件不存在:', inputPath);
    process.exit(1);
  }

  const baseName = path.basename(filename, path.extname(filename));
  fs.mkdirSync(UGOIRA_DIR, { recursive: true });
  const outPath = path.join(UGOIRA_DIR, `${baseName}.ugoira`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gif2ugoira-'));

  try {
    await ensureFfmpeg();
    console.log('[gif2ugoira] 获取帧时长...');
    const durations = await getFrameDurations(inputPath);
    console.log('[gif2ugoira] 拆帧...');
    await extractFrames(inputPath, tmpDir);
    const frames = listFrames(tmpDir);

    if (frames.length === 0) {
      throw new Error('未提取到任何帧');
    }

    // 若 ffprobe 返回的帧数与实际不一致，用均匀间隔
    const delays = frames.length === durations.length
      ? durations
      : Array(frames.length).fill(Math.round(1000 / Math.max(1, frames.length)));

    const meta = {
      frames: frames.map((file, i) => ({ file, delay: delays[i] ?? 100 })),
    };
    fs.writeFileSync(path.join(tmpDir, 'frames.json'), JSON.stringify(meta, null, 2));

    console.log('[gif2ugoira] 打包 ZIP...');
    const zip = new JSZip();
    for (const f of frames) {
      zip.file(f, fs.readFileSync(path.join(tmpDir, f)));
    }
    zip.file('frames.json', JSON.stringify(meta, null, 2));

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(outPath, buf);

    console.log('[gif2ugoira] 完成:', outPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
