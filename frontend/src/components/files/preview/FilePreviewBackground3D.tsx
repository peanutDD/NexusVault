import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FilePreviewBackground3DProps {
  isRotationPaused: boolean;
}

export default function FilePreviewBackground3D({ isRotationPaused }: FilePreviewBackground3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isRotationPausedRef = useRef(isRotationPaused);
  const prefersReducedMotionRef = useRef(false);

  useEffect(() => {
    isRotationPausedRef.current = isRotationPaused;
  }, [isRotationPaused]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = Boolean(mql?.matches);

    // Initialize Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, prefersReducedMotionRef.current ? 1 : 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Initialize Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    // 增加相机距离，从 8 改为 14，确保在移动端小屏幕上也能看到完整场景
    camera.position.set(0, 0, 14);

    // Lighting
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

    const galaxyGroup = new THREE.Group();
    galaxyGroup.rotation.x = 0.58;
    group.add(galaxyGroup);

    const galaxyCoreGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const galaxyCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0xd946ef,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const galaxyCore = new THREE.Mesh(galaxyCoreGeometry, galaxyCoreMaterial);
    galaxyGroup.add(galaxyCore);

    const galaxyGlowGeometry = new THREE.CircleGeometry(2.4, 64);
    const galaxyGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x22f3a6,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const galaxyGlow = new THREE.Mesh(galaxyGlowGeometry, galaxyGlowMaterial);
    galaxyGlow.rotation.x = Math.PI / 2;
    galaxyGroup.add(galaxyGlow);

    const spiralCount = 750;
    const spiralPositions = new Float32Array(spiralCount * 3);
    const spiralColors = new Float32Array(spiralCount * 3);
    const cyan = new THREE.Color(0x22f3a6);
    const magenta = new THREE.Color(0xb455ff);
    const tmpColor = new THREE.Color();
    for (let i = 0; i < spiralCount; i += 1) {
      const arm = i % 2;
      const r = Math.pow(Math.random(), 1.65) * 3.0;
      const swirl = r * 2.6;
      const jitter = (Math.random() - 0.5) * 0.55;
      const angle = swirl + arm * Math.PI + jitter;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = (Math.random() - 0.5) * (0.18 * (1 - r / 3.0));

      const i3 = i * 3;
      spiralPositions[i3] = x;
      spiralPositions[i3 + 1] = y;
      spiralPositions[i3 + 2] = z;

      const t = Math.min(1, Math.max(0, r / 3.0));
      tmpColor.copy(arm === 0 ? cyan : magenta).lerp(arm === 0 ? magenta : cyan, t * 0.35);
      tmpColor.multiplyScalar(1 - t * 0.6);
      spiralColors[i3] = tmpColor.r;
      spiralColors[i3 + 1] = tmpColor.g;
      spiralColors[i3 + 2] = tmpColor.b;
    }
    const spiralGeometry = new THREE.BufferGeometry();
    spiralGeometry.setAttribute('position', new THREE.BufferAttribute(spiralPositions, 3));
    spiralGeometry.setAttribute('color', new THREE.BufferAttribute(spiralColors, 3));
    const spiralMaterial = new THREE.PointsMaterial({
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    const spiral = new THREE.Points(spiralGeometry, spiralMaterial);
    galaxyGroup.add(spiral);

    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.x = 0.42;
    group.add(orbitGroup);

    const moonOrbitRadius = 3.4;
    const orbitMarker = new THREE.Object3D();
    orbitMarker.position.set(moonOrbitRadius, 0, 0);
    orbitGroup.add(orbitMarker);

    const ringGeometry = new THREE.TorusGeometry(2.2, 0.06, 12, 48); // Reduced segments
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

    const orbitPathGeometry = new THREE.TorusGeometry(moonOrbitRadius, 0.03, 10, 96);
    const orbitPathMaterial = new THREE.MeshStandardMaterial({
      color: 0x22f3a6,
      metalness: 0.35,
      roughness: 0.6,
      emissive: 0x061a12,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.25,
    });
    const orbitPath = new THREE.Mesh(orbitPathGeometry, orbitPathMaterial);
    orbitPath.rotation.x = Math.PI / 2 + orbitGroup.rotation.x;
    group.add(orbitPath);

    // Particles (Reduced count)
    const particleCount = 100; // Reduced from 320
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

    // Aurora Ribbons (Simplified - removed vertex animation)
    const auroraGroup = new THREE.Group();
    auroraGroup.position.set(0.6, 2.6, -3.1);
    auroraGroup.rotation.set(-0.48, 0.25, 0.05);
    scene.add(auroraGroup);
    
    // Create static aurora ribbons instead of dynamic ones
    for (let i = 0; i < 2; i += 1) { // Reduced from 3
        const width = 16;
        const height = 3.6;
        const geometry = new THREE.PlaneGeometry(width, height, 20, 4); // Reduced segments
        const material = new THREE.MeshBasicMaterial({
            color: i === 0 ? 0x2bffb9 : 0xb455ff,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(-2.2 + i * 0.9, 0.1 + i * 0.18, -i * 0.8);
        mesh.rotation.y = -0.18 + i * 0.1;
        mesh.rotation.z = 0.12 - i * 0.07;
        auroraGroup.add(mesh);
    }

    // Resize Handler
    const resize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (prefersReducedMotionRef.current) {
        renderer.render(scene, camera);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    // Animation Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let motionTime = 0;
    let previewContentEl: HTMLElement | null = null;
    const tmpWorld = new THREE.Vector3();
    const tmpNdc = new THREE.Vector3();
    let orbitBlend = 0;
    let isRunning = false;

    const renderFrame = (delta: number) => {
      if (prefersReducedMotionRef.current) {
        motionTime = 0;
        orbitBlend = 0;
      } else if (!isRotationPausedRef.current) {
        motionTime += delta;
      }

      const elapsed = motionTime;
      const loopSeconds = 24;
      const phase = ((elapsed % loopSeconds) / loopSeconds) * Math.PI * 2;

      galaxyGroup.rotation.y = phase * 0.65;
      ring.rotation.z = phase * 1.6;

      orbitGroup.rotation.y = phase;

      particles.rotation.y = phase;
      particles.rotation.x = Math.sin(phase * 2) * 0.08;

      pulseLight.intensity = 1 + Math.sin(phase * 2) * 0.35;
      group.position.y = Math.sin(phase) * 0.15;

      if (!previewContentEl) {
        previewContentEl = document.querySelector('[data-preview-content]') as HTMLElement | null;
      }
      if (previewContentEl) {
        const w = container.clientWidth || 0;
        const h = container.clientHeight || 0;
        const base = Math.min(w, h);

        const k = 1 - Math.exp(-delta * 6);
        if (prefersReducedMotionRef.current) {
          orbitBlend = 0;
        } else if (!isRotationPausedRef.current) {
          orbitBlend += (1 - orbitBlend) * k;
        }

        orbitMarker.getWorldPosition(tmpWorld);
        tmpNdc.copy(tmpWorld).project(camera);
        const cx = (tmpNdc.x * 0.5) * w;
        const cy = (-tmpNdc.y * 0.5) * h;

        const x = cx * orbitBlend;
        const y = cy * orbitBlend;
        const z = (Math.sin(phase * 2) * Math.min(90, Math.max(24, base * 0.12))) * orbitBlend;
        const rx = 0;
        const ry = 0;
        previewContentEl.style.setProperty('--preview-orbit-x', `${x.toFixed(2)}px`);
        previewContentEl.style.setProperty('--preview-orbit-y', `${y.toFixed(2)}px`);
        previewContentEl.style.setProperty('--preview-orbit-z', `${z.toFixed(2)}px`);
        previewContentEl.style.setProperty('--preview-orbit-rx', `${rx.toFixed(2)}deg`);
        previewContentEl.style.setProperty('--preview-orbit-ry', `${ry.toFixed(2)}deg`);
      }

      renderer.render(scene, camera);
    };

    const animate = () => {
      // 无论是否暂停，clock.getDelta() 都必须每帧调用以更新内部时间
      const delta = clock.getDelta();
      renderFrame(delta);
      if (!prefersReducedMotionRef.current) {
        frameId = window.requestAnimationFrame(animate);
      } else {
        isRunning = false;
      }
    };

    const start = () => {
      if (isRunning) return;
      isRunning = true;
      frameId = window.requestAnimationFrame(animate);
    };

    const stop = () => {
      if (!isRunning) return;
      isRunning = false;
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const onReducedMotionChange = () => {
      prefersReducedMotionRef.current = Boolean(mql?.matches);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, prefersReducedMotionRef.current ? 1 : 2));
      if (prefersReducedMotionRef.current) {
        stop();
        renderFrame(0);
        return;
      }
      start();
    };

    if (mql) {
      mql.addEventListener('change', onReducedMotionChange);
    }

    start();

    // Cleanup
    return () => {
      if (mql) {
        mql.removeEventListener('change', onReducedMotionChange);
      }
      stop();
      resizeObserver.disconnect();
      
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
      }
      
      renderer.dispose();

      if (previewContentEl) {
        previewContentEl.style.removeProperty('--preview-orbit-x');
        previewContentEl.style.removeProperty('--preview-orbit-y');
        previewContentEl.style.removeProperty('--preview-orbit-z');
        previewContentEl.style.removeProperty('--preview-orbit-rx');
        previewContentEl.style.removeProperty('--preview-orbit-ry');
      }
      
      // Dispose geometries and materials
      galaxyCoreGeometry.dispose();
      galaxyCoreMaterial.dispose();
      galaxyGlowGeometry.dispose();
      galaxyGlowMaterial.dispose();
      spiralGeometry.dispose();
      spiralMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      orbitPathGeometry.dispose();
      orbitPathMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, []); // Run only once on mount

  return <div ref={containerRef} className="absolute inset-0 z-[1] pointer-events-none" />;
}
