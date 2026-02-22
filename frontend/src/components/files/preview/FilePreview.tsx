/**
 * FilePreview
 * 文件预览弹窗：支持图片、视频、音频、PDF、文本
 * 多文件时可左右切换，图片支持缩放、旋转
 */

// =============================================================================
// 依赖
// =============================================================================

import { useMemo, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { fileService } from '../../../services/files';
import { formatFileSize } from '../../../utils/format';
import { cn } from '../../../utils/cn';
import { getPreviewKind, getMimeTypeLabel } from '../../../utils/mimeType';
import type { FileMetadata } from '../../../types/files';

import { useFilePreviewData } from './hooks/useFilePreviewData';
import { useFilePreviewNavigation } from './hooks/useFilePreviewNavigation';
import { useFilePreviewEffects } from './hooks/useFilePreviewEffects';
import { FilePreviewContent } from './FilePreviewContent.tsx';
import { FilePreviewToolbar } from './FilePreviewToolbar.tsx';
import { truncateFilename, formatPreviewDate } from './utils';

// =============================================================================
// 类型
// =============================================================================

export interface FilePreviewProps {
  /** 当前预览的文件，null 时渲染 null */
  file: FileMetadata | null;
  /** 同目录文件列表，用于上一页/下一页 */
  files?: FileMetadata[];
  /** 当前文件在列表中的索引 */
  currentIndex?: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 切换文件回调（上一页/下一页时传入新文件） */
  onNavigate?: (file: FileMetadata) => void;
}

// =============================================================================
// 主组件
// =============================================================================

export default function FilePreview({
  file,
  files = [],
  currentIndex = 0,
  onClose,
  onNavigate,
}: FilePreviewProps) {
  // -------------------------------------------------------------------------
  // 预览类型
  // -------------------------------------------------------------------------
  const kind = useMemo(
    () =>
      file
        ? getPreviewKind(file.mime_type, file.original_filename)
        : getPreviewKind(''),
    [file]
  );

  const { isImage, isPDF, isText, isMarkdown, isVideo, isAudio, supported } = kind;

  // -------------------------------------------------------------------------
  // 数据加载（Blob/文本/GIF 流式首帧等）
  // -------------------------------------------------------------------------
  const {
    blobUrl,
    gifFirstFrameUrl,
    textContent,
    error,
    loading,
    gifTranscodeInProgress,
    gifTranscodeProgress,
    useHls,
    imageLoaded,
    setImageLoaded,
    videoRef,
    tryVideoAudioFallback,
    tryVideoAudioFallbackRef,
    onImageError,
  } = useFilePreviewData({ file, kind });

  // -------------------------------------------------------------------------
  // 导航（上一页/下一页）
  // -------------------------------------------------------------------------
  const { canGoPrev, canGoNext, goToPrev, goToNext } = useFilePreviewNavigation({
    files,
    currentIndex,
    onNavigate,
  });

  // -------------------------------------------------------------------------
  // 图片视图状态（缩放、旋转）
  // -------------------------------------------------------------------------
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [isRotationPaused, setIsRotationPaused] = useState(true);
  const isRotationPausedRef = useRef(true);
  const imageTransformRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const previewRootRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Side Effects：HLS、键盘、滚动锁定、预加载
  // -------------------------------------------------------------------------
  useFilePreviewEffects({
    kind,
    useHls,
    blobUrl,
    loading,
    file,
    files,
    currentIndex,
    canGoPrev,
    canGoNext,
    videoRef,
    tryVideoAudioFallbackRef,
    onClose,
    goToPrev,
    goToNext,
  });

  // -------------------------------------------------------------------------
  // 文件切换时重置视图状态
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 将 zoom/rotation 同步到图片容器的 transform
  // -------------------------------------------------------------------------
  useEffect(() => {
    const el = imageTransformRef.current;
    if (!el) return;
    el.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
  }, [zoom, rotation]);

  useEffect(() => {
    isRotationPausedRef.current = isRotationPaused;
  }, [isRotationPaused]);

  useEffect(() => {
    const container = backdropRef.current;
    const root = previewRootRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 8);

    const ambient = new THREE.AmbientLight(0xe2fffb, 0.75);
    const keyLight = new THREE.DirectionalLight(0x22f3a6, 1.55);
    keyLight.position.set(6, 4, 8);
    const rimLight = new THREE.DirectionalLight(0xb455ff, 0.95);
    rimLight.position.set(-6, -3, -6);
    const pulseLight = new THREE.PointLight(0xd946ef, 1.35, 30);
    pulseLight.position.set(0, 0, 6);
    scene.add(ambient, keyLight, rimLight, pulseLight);

    const group = new THREE.Group();
    scene.add(group);

    const coreGeometry = new THREE.SphereGeometry(1.6, 64, 64);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b1d18,
      metalness: 0.25,
      roughness: 0.4,
      emissive: 0x08211b,
      emissiveIntensity: 0.6,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const atmosphereGeometry = new THREE.SphereGeometry(1.72, 64, 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x22f3a6,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    group.add(atmosphere);

    const orbitGroup = new THREE.Group();
    group.add(orbitGroup);

    const screenGroup = new THREE.Group();
    screenGroup.position.set(4.6, 0.3, 0);
    orbitGroup.add(screenGroup);

    const frameGeometry = new THREE.BoxGeometry(4.9, 3.1, 0.28);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0f14,
      metalness: 0.85,
      roughness: 0.28,
      emissive: 0x140a1f,
      emissiveIntensity: 0.7,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    screenGroup.add(frame);

    const screenGeometry = new THREE.PlaneGeometry(4.4, 2.6, 1, 1);
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x1bd98a,
      metalness: 0.15,
      roughness: 0.12,
      emissive: 0x0b3a26,
      emissiveIntensity: 1.25,
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = 0.16;
    screenGroup.add(screen);

    const screenGlowGeometry = new THREE.PlaneGeometry(4.8, 2.95, 1, 1);
    const screenGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xb455ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const screenGlow = new THREE.Mesh(screenGlowGeometry, screenGlowMaterial);
    screenGlow.position.z = 0.18;
    screenGroup.add(screenGlow);

    const ringGeometry = new THREE.TorusGeometry(2.2, 0.06, 16, 120);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xb455ff,
      metalness: 0.9,
      roughness: 0.22,
      emissive: 0x2a0f3d,
      emissiveIntensity: 0.75,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2.2;
    ring.rotation.y = Math.PI / 6;
    group.add(ring);

    const shardGeometry = new THREE.BoxGeometry(0.2, 1.2, 0.2);
    const shardMaterial = new THREE.MeshStandardMaterial({
      color: 0x22f3a6,
      metalness: 0.5,
      roughness: 0.28,
      emissive: 0x07301f,
      emissiveIntensity: 0.65,
    });
    const shards: THREE.Mesh[] = [];
    for (let i = 0; i < 22; i += 1) {
      const shard = new THREE.Mesh(shardGeometry, shardMaterial);
      const angle = (i / 22) * Math.PI * 2;
      const radius = 3.2 + Math.random() * 0.8;
      shard.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 2.2,
        Math.sin(angle) * radius
      );
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      shard.scale.setScalar(0.7 + Math.random() * 0.6);
      shards.push(shard);
      group.add(shard);
    }

    const particleCount = 320;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const i3 = i * 3;
      particlePositions[i3] = (Math.random() - 0.5) * 14;
      particlePositions[i3 + 1] = (Math.random() - 0.5) * 8;
      particlePositions[i3 + 2] = (Math.random() - 0.5) * 10;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xd7fff1,
      size: 0.04,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const hudRingGeometry = new THREE.RingGeometry(2.8, 3.05, 64);
    const hudRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x22f3a6,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const hudRing = new THREE.Mesh(hudRingGeometry, hudRingMaterial);
    hudRing.rotation.x = Math.PI / 2.6;
    hudRing.rotation.y = Math.PI / 4;
    group.add(hudRing);

    const hudRingInnerGeometry = new THREE.RingGeometry(1.6, 1.9, 48);
    const hudRingInnerMaterial = new THREE.MeshBasicMaterial({
      color: 0xd946ef,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const hudRingInner = new THREE.Mesh(hudRingInnerGeometry, hudRingInnerMaterial);
    hudRingInner.rotation.x = Math.PI / 2.2;
    hudRingInner.rotation.y = -Math.PI / 5;
    group.add(hudRingInner);

    const grid = new THREE.GridHelper(14, 80, 0x22f3a6, 0x220b3a);
    grid.position.z = -3.2;
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    grid.rotation.x = Math.PI / 2.1;
    scene.add(grid);

    let frameId = 0;
    let targetX = 0;
    let targetY = 0;
    let orbitYaw = 0;
    let orbitPitch = 0;
    let isDragging = false;
    let lastDragX = 0;
    let lastDragY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (event.target instanceof HTMLElement && event.target.closest('[data-preview-content]')) {
        return;
      }
      isDragging = true;
      lastDragX = event.clientX;
      lastDragY = event.clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const posX = (event.clientX - rect.left) / rect.width - 0.5;
      const posY = (event.clientY - rect.top) / rect.height - 0.5;
      targetX = posX * 2;
      targetY = posY * 2;
      if (root) {
        root.style.setProperty('--preview-tilt-x', `${posY * -10}deg`);
        root.style.setProperty('--preview-tilt-y', `${posX * 12}deg`);
      }
      if (isDragging) {
        const deltaX = event.clientX - lastDragX;
        const deltaY = event.clientY - lastDragY;
        lastDragX = event.clientX;
        lastDragY = event.clientY;
        orbitYaw += deltaX * 0.004;
        orbitPitch = Math.max(-0.6, Math.min(0.6, orbitPitch + deltaY * 0.003));
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointerleave', onPointerUp);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const clock = new THREE.Clock();
    let motionTime = 0;

    const animate = () => {
      const delta = clock.getDelta();
      if (!isRotationPausedRef.current) {
        motionTime += delta;
      }
      const elapsed = motionTime;
      core.rotation.y = elapsed * 0.25;
      core.rotation.x = elapsed * 0.1;
      atmosphere.rotation.y = -elapsed * 0.18;
      ring.rotation.z = elapsed * 0.35;
      const orbitAngle = elapsed * 0.45 + orbitYaw;
      const frontAlign = Math.max(0, Math.cos(orbitAngle));
      const orbitScale = 1 - frontAlign;
      orbitGroup.rotation.y = orbitAngle;
      orbitGroup.rotation.x = orbitPitch;
      screenGroup.lookAt(0, 0, 0);
      (screenGlow.material as THREE.MeshBasicMaterial).opacity =
        0.22 + Math.sin(elapsed * 1.8) * 0.08;
      hudRing.rotation.z = -elapsed * 0.25;
      hudRingInner.rotation.z = elapsed * 0.4;
      shards.forEach((shard, index) => {
        shard.rotation.y += 0.003 + index * 0.0001;
        shard.rotation.x += 0.001;
      });
      particles.rotation.y = elapsed * 0.05;
      particles.rotation.x = elapsed * 0.02;
      pulseLight.intensity = 1 + Math.sin(elapsed * 1.4) * 0.35;
      group.position.y = Math.sin(elapsed * 0.7) * 0.15;
      if (root) {
        const orbitRadius = Math.min(container.clientWidth, container.clientHeight) * 0.32;
        const orbitX = Math.cos(orbitAngle) * orbitRadius * 1.18 * orbitScale;
        const orbitY =
          Math.sin(orbitAngle) * orbitRadius * 0.55 * orbitScale +
          orbitPitch * orbitRadius * 0.6 * orbitScale;
        const orbitZ = Math.sin(orbitAngle) * orbitRadius * 1.1 * orbitScale;
        const orbitRy = -Math.sin(orbitAngle) * 46 * orbitScale;
        const orbitRx = orbitPitch * 46 * orbitScale;
        root.style.setProperty('--preview-orbit-x', `${orbitX}px`);
        root.style.setProperty('--preview-orbit-y', `${orbitY}px`);
        root.style.setProperty('--preview-orbit-z', `${orbitZ}px`);
        root.style.setProperty('--preview-orbit-ry', `${orbitRy}deg`);
        root.style.setProperty('--preview-orbit-rx', `${orbitRx}deg`);
        root.style.setProperty('--preview-tilt-scale', `${orbitScale}`);
      }
      camera.position.x += (targetX * 1.2 - camera.position.x) * 0.06;
      camera.position.y += (-targetY * 1.0 - camera.position.y) * 0.06;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointerleave', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      if (root) {
        root.style.removeProperty('--preview-tilt-x');
        root.style.removeProperty('--preview-tilt-y');
        root.style.removeProperty('--preview-orbit-x');
        root.style.removeProperty('--preview-orbit-y');
        root.style.removeProperty('--preview-orbit-z');
        root.style.removeProperty('--preview-orbit-ry');
        root.style.removeProperty('--preview-orbit-rx');
        root.style.removeProperty('--preview-tilt-scale');
      }
      resizeObserver.disconnect();
      group.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) {
          material.forEach((mat) => mat.dispose());
        } else {
          material.dispose();
        }
      });
      grid.geometry.dispose();
      const gridMaterial = grid.material as THREE.Material | THREE.Material[];
      if (Array.isArray(gridMaterial)) {
        gridMaterial.forEach((mat) => mat.dispose());
      } else {
        gridMaterial.dispose();
      }
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // -------------------------------------------------------------------------
  // 文件名展示（中间省略）
  // -------------------------------------------------------------------------
  const displayFilename = useMemo(
    () => (file?.original_filename ? truncateFilename(file.original_filename) : ''),
    [file]
  );

  // -------------------------------------------------------------------------
  // 图片控制回调
  // -------------------------------------------------------------------------
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => r + 90);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleDownload = async () => {
    if (!file) return;
    try {
      await fileService.downloadFile(file.id, file.original_filename);
    } catch {
      /* 静默 */
    }
  };

  const handleToggleLoop = () => {
    setIsLooping((prev) => !prev);
  };

  const handleToggleRotation = () => {
    setIsRotationPaused((prev) => !prev);
  };

  // -------------------------------------------------------------------------
  // 无文件时返回 null
  // -------------------------------------------------------------------------
  if (!file) return null;

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------
  return (
    <div
      ref={previewRootRef}
      className="preview-cyberpunk-root fixed inset-0 z-50 flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      {/* ---- 背景层（点击关闭） ---- */}
      <div
        className="absolute inset-0 z-0 backdrop-blur-xl"
        style={{ backgroundColor: 'rgba(var(--preview-ink), 0.92)' }}
        onClick={onClose}
        aria-hidden
      />

      <div ref={backdropRef} className="pointer-events-none absolute inset-0 z-[1]" />

      <div className="pointer-events-none absolute inset-0 z-[2]">
        <div
          className="absolute inset-0 opacity-45 mix-blend-screen"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(var(--preview-green), 0.26), rgba(var(--preview-purple), 0.18) 45%, rgba(var(--preview-ink), 0.55)), radial-gradient(circle at 50% 30%, rgba(var(--preview-green), 0.3), transparent 55%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(var(--preview-green), 0.25) 1px, transparent 1px)',
            backgroundSize: '100% 4px',
          }}
        />
        <div className="preview-neon-frame absolute left-[8%] top-[12%] h-10 w-24 rounded-sm" />
        <div className="preview-neon-frame alt absolute right-[10%] top-[18%] h-12 w-28 rounded-sm" />
        <div className="preview-neon-frame soft absolute left-[12%] bottom-[18%] h-8 w-20 rounded-sm" />
        <div className="preview-neon-frame alt soft absolute right-[14%] bottom-[12%] h-10 w-24 rounded-sm" />
        <div className="preview-neon-ring absolute left-1/2 top-[8%] h-[120px] w-[120px] -translate-x-1/2 rounded-full" />
      </div>

      {/* ---- 装饰渐变 ---- */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--preview-green), 0.22), transparent 65%)',
          }}
        />
        <div
          className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--preview-purple), 0.2), transparent 65%)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--preview-magenta), 0.16), transparent 65%)',
          }}
        />
      </div>

      {/* ---- 网格纹理 ---- */}
      <div className="preview-grid-pattern pointer-events-none absolute inset-0" />

      {/* ---- 左侧导航按钮 ---- */}
      {files.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          disabled={!canGoPrev}
          className={cn(
            'absolute z-20 top-1/2 -translate-y-1/2 left-[clamp(0.5rem,2vw,1rem)]',
            'flex items-center justify-center rounded-full w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]',
            'border-[clamp(1px,0.2vw,2px)] border-solid border-[rgba(255,255,255,0.25)]',
            'shadow-[0_clamp(0.25rem,1vw,0.75rem)_clamp(0.5rem,2.5vw,1.5rem)_rgba(15,23,42,0.75)]',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl text-white/80 transition-all duration-200',
            canGoPrev ? 'hover:from-white/20 hover:via-white/10 hover:text-white hover:scale-105 hover:border-white/40 cursor-pointer' : 'opacity-30 cursor-not-allowed'
          )}
          aria-label="上一个文件"
        >
          <svg className="shrink-0 w-[clamp(1rem,2.5vw,1.5rem)] h-[clamp(1rem,2.5vw,1.5rem)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="clamp(1.5, 0.4vw, 2.5)">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* ---- 顶部工具栏（文件计数器） ---- */}
      <div
        className="relative z-20 flex shrink-0 items-center justify-between bg-gradient-to-b from-black/70 via-black/40 to-transparent px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3" />
        <div className="flex items-center gap-2" />
        {file.mime_type.toLowerCase() === 'image/gif' && gifTranscodeInProgress && (
          <div className="pointer-events-none absolute left-1/2 top-[3.1rem] -translate-x-1/2">
            <div className="inline-flex flex-col items-center rounded-full bg-black/40 px-4 py-2 text-[11px] text-white/80 backdrop-blur-md shadow-lg border border-white/15">
              <span className="mb-1">
                正在为 GIF 生成视频预览，大文件可能需要几十秒…
              </span>
              {typeof gifTranscodeProgress === 'number' && (
                <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="preview-progress-fill absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(Math.max(gifTranscodeProgress, 5), 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {files.length > 1 && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
            <div
              className={cn(
                'inline-flex items-center rounded-full bg-white/10 backdrop-blur-xl border-solid',
                'gap-[clamp(0.25rem,0.8vw,0.5rem)] pl-[clamp(0.5rem,1.2vw,0.75rem)] pr-[clamp(0.5rem,1.2vw,0.75rem)]',
                'pt-[clamp(0.2rem,0.5vw,0.25rem)] pb-[clamp(0.2rem,0.5vw,0.25rem)]',
                'border-[clamp(1px,0.15vw,2px)] border-[rgba(255,255,255,0.2)] text-[clamp(0.6rem,1.2vw,0.7rem)]',
                'shadow-[0_clamp(0.25rem,0.8vw,0.6rem)_clamp(0.5rem,1.5vw,1rem)_rgba(15,23,42,0.85)]'
              )}
            >
              <span className="text-white/80">{currentIndex + 1} / {files.length}</span>
            </div>
          </div>
        )}
      </div>

      <FilePreviewToolbar
        section="upper"
        isImage={isImage}
        isVideo={isVideo}
        onClose={onClose}
        onDownload={handleDownload}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRotate={handleRotate}
        onResetView={handleResetView}
        onToggleLoop={handleToggleLoop}
        isLooping={isLooping}
        onToggleRotation={handleToggleRotation}
        isRotationPaused={isRotationPaused}
        className="absolute z-[100] right-[clamp(0.5rem,2vw,1rem)] bottom-[calc(50%+clamp(1rem,2.5vw,1.5rem)+clamp(0.75rem,1.8vw,1rem))]"
      />

      {files.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          disabled={!canGoNext}
          className={cn(
            'absolute z-[100] right-[clamp(0.5rem,2vw,1rem)] top-1/2 -translate-y-1/2',
            'flex items-center justify-center rounded-full w-[clamp(2rem,5vw,3rem)] h-[clamp(2rem,5vw,3rem)]',
            'border-[clamp(1px,0.2vw,2px)] border-solid border-[rgba(255,255,255,0.25)]',
            'shadow-[0_clamp(0.25rem,1vw,0.75rem)_clamp(0.5rem,2.5vw,1.5rem)_rgba(15,23,42,0.75)]',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl text-white/80 transition-all duration-200',
            canGoNext ? 'hover:from-white/20 hover:via-white/10 hover:text-white hover:scale-105 hover:border-white/40 cursor-pointer' : 'opacity-30 cursor-not-allowed'
          )}
          aria-label="下一个文件"
        >
          <svg className="shrink-0 w-[clamp(1rem,2.5vw,1.5rem)] h-[clamp(1rem,2.5vw,1.5rem)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="clamp(1.5, 0.4vw, 2.5)">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <FilePreviewToolbar
        section="lower"
        isImage={isImage}
        isVideo={isVideo}
        onClose={onClose}
        onDownload={handleDownload}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRotate={handleRotate}
        onResetView={handleResetView}
        onToggleLoop={handleToggleLoop}
        isLooping={isLooping}
        onToggleRotation={handleToggleRotation}
        isRotationPaused={isRotationPaused}
        className="absolute z-[100] right-[clamp(0.5rem,2vw,1rem)] top-[calc(50%+clamp(1rem,2.5vw,1.5rem)+clamp(0.75rem,1.8vw,1rem))]"
      />

      {/* ---- 主内容区 ---- */}
      <FilePreviewContent
        file={file}
        loading={loading}
        error={error}
        supported={supported}
        isImage={isImage}
        isPDF={isPDF}
        isVideo={isVideo}
        isAudio={isAudio}
        isText={isText}
        isMarkdown={isMarkdown}
        blobUrl={blobUrl}
        gifFirstFrameUrl={gifFirstFrameUrl}
        textContent={textContent}
        useHls={useHls}
        imageLoaded={imageLoaded}
        imageTransformRef={imageTransformRef}
        videoRef={videoRef}
        loop={isLooping}
        setImageLoaded={setImageLoaded}
        tryVideoAudioFallback={tryVideoAudioFallback}
        onImageError={onImageError}
        onClose={onClose}
        formatDate={formatPreviewDate}
      />

      {/* ---- 底部文件信息 ---- */}
      <div
        className="relative z-20 shrink-0 bg-gradient-to-t from-black/70 to-transparent px-[clamp(0.8rem,2vw,1rem)] py-[clamp(0.9rem,2.25vw,1.25rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-3xl">
          <div
            className={cn(
              'mx-auto max-w-2xl rounded-xl bg-white/5 text-center backdrop-blur-sm border-solid',
              'p-[clamp(0.5rem,1.2vw,0.75rem)]',
              'border-[clamp(1px,0.15vw,2px)] border-[rgba(255,255,255,0.1)]',
              'shadow-[0_clamp(0.2rem,0.6vw,0.4rem)_clamp(0.4rem,1.2vw,0.8rem)_rgba(0,0,0,0.2)]'
            )}
          >
            <h2 id="preview-title" className="truncate font-medium text-white text-[clamp(0.8rem,1.8vw,1rem)]" title={file.original_filename}>
              {displayFilename}
            </h2>
            <p className="text-white/55 mt-[clamp(0.2rem,0.5vw,0.25rem)] text-[clamp(0.65rem,1.4vw,0.75rem)]">
              {formatFileSize(file.file_size)} · {getMimeTypeLabel(file.mime_type, file.original_filename)} · {formatPreviewDate(file.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
