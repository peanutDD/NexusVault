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

// 为了更接近 Pixiv 的实际体积与性能，这里做几项约束：
// - 帧统一导出为 JPEG（而不是 PNG），大幅减小单帧体积
// - 限制最长边分辨率，避免超高分辨率导致前端解码/绘制过慢
// 如后续需要，可把这些常量改成命令行参数。
const MAX_WIDTH = 1920;   // 最长边上限（像素），常见 Pixiv 规格为 1920x1080
const MAX_HEIGHT = 1080;  // 另一边按等比例缩放，不会超过这个值
const JPEG_QUALITY = 4;   // ffmpeg 的 qscale 质量（2~6 通常肉眼接近无损）
const TARGET_FPS = 30;    // 目标帧率：过高会导致播放卡顿，30fps 体验通常足够

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
  // 说明：
  // - 输出 JPEG 而不是 PNG，单帧体积会从 ~1MB 降到几十 KB 级别
  // - 使用 scale 约束最长边，避免非常大的 GIF 生成超大帧导致前端解码卡顿
  // - 保持 -vsync 0，尽量与原 GIF 帧对齐（时间轴仍由 ffprobe 的 durations 决定）
  const outPattern = path.join(outDir, 'frame_%04d.jpg');
  const scaleFilter = `scale=w='if(gt(iw,${MAX_WIDTH}),${MAX_WIDTH},iw)':h='if(gt(ih,${MAX_HEIGHT}),${MAX_HEIGHT},ih)':force_original_aspect_ratio=decrease`;

  await exec('ffmpeg', [
    '-i', gifPath,
    '-vsync', '0',
    '-q:v', String(JPEG_QUALITY),
    '-vf', scaleFilter,
    outPattern,
  ]);
}

/** 读取目录下 frame_*.jpg 并按序号排序 */
function listFrames(dir) {
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith('frame_') && (f.endsWith('.jpg') || f.endsWith('.jpeg')))
    .sort();
  return files;
}

/**
 * 将原始帧序列降采样到目标帧率附近：
 * - 根据 durations 计算原始平均 fps
 * - 如果原始 fps 高于 TARGET_FPS，则按步长合并/抽帧
 * - 保持整体时长不变（通过合并 delay）
 */
function downsampleFrames(frames, delays, targetFps) {
  if (!frames.length || !delays.length) {
    return { frames, delays };
  }

  const totalDuration = delays.reduce((acc, d) => acc + d, 0);
  const avgDelay = totalDuration / delays.length;
  const origFps = 1000 / Math.max(1, avgDelay);

  if (!Number.isFinite(origFps) || origFps <= targetFps) {
    // 原始帧率已经不高，无需降采样
    return { frames, delays };
  }

  const step = Math.max(2, Math.ceil(origFps / targetFps));

  const newFrames = [];
  const newDelays = [];
  let accDelay = 0;

  for (let i = 0; i < frames.length; i++) {
    accDelay += delays[i] ?? avgDelay;
    if (i % step === 0) {
      // 保留这一帧，delay 为累计值
      newFrames.push(frames[i]);
      newDelays.push(accDelay);
      accDelay = 0;
    }
  }

  // 把尾部剩余时间补到最后一帧，避免总时长变短
  if (accDelay > 0 && newDelays.length > 0) {
    newDelays[newDelays.length - 1] += accDelay;
  }

  return {
    frames: newFrames,
    delays: newDelays,
  };
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
    const rawDelays = frames.length === durations.length
      ? durations
      : Array(frames.length).fill(Math.round(1000 / Math.max(1, frames.length)));

    // 按目标帧率降采样，减少总帧数（减轻前端解码/绘制压力）
    const { frames: finalFrames, delays: finalDelays } = downsampleFrames(
      frames,
      rawDelays,
      TARGET_FPS,
    );

    const meta = {
      frames: finalFrames.map((file, i) => ({ file, delay: finalDelays[i] ?? 100 })),
    };
    fs.writeFileSync(path.join(tmpDir, 'frames.json'), JSON.stringify(meta, null, 2));

    console.log('[gif2ugoira] 打包 ZIP...');
    const zip = new JSZip();
    for (const f of finalFrames) {
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
