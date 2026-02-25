import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FilePreviewBackground3DProps {
  isRotationPaused: boolean;
}

export default function FilePreviewBackground3D({ isRotationPaused }: FilePreviewBackground3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isRotationPausedRef = useRef(isRotationPaused);

  useEffect(() => {
    isRotationPausedRef.current = isRotationPaused;
  }, [isRotationPaused]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initialize Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    camera.position.set(0, 0, 8);

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

    // Objects
    const coreGeometry = new THREE.SphereGeometry(1.6, 32, 32); // Reduced segments
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b1d18,
      metalness: 0.25,
      roughness: 0.4,
      emissive: 0x08211b,
      emissiveIntensity: 0.6,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const atmosphereGeometry = new THREE.SphereGeometry(1.72, 32, 32); // Reduced segments
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

    const animate = () => {
      // 无论是否暂停，clock.getDelta() 都必须每帧调用以更新内部时间
      const delta = clock.getDelta();
      
      // Update motion time only if not paused
      if (!isRotationPausedRef.current) {
        motionTime += delta;
      }
      
      const elapsed = motionTime;

      // Simple rotations
      core.rotation.y = elapsed * 0.25;
      core.rotation.x = elapsed * 0.1;
      atmosphere.rotation.y = -elapsed * 0.18;
      ring.rotation.z = elapsed * 0.35;
      
      const orbitAngle = elapsed * 0.45;
      orbitGroup.rotation.y = orbitAngle;

      particles.rotation.y = elapsed * 0.05;
      particles.rotation.x = elapsed * 0.02;

      pulseLight.intensity = 1 + Math.sin(elapsed * 1.4) * 0.35;
      group.position.y = Math.sin(elapsed * 0.7) * 0.15;

      if (!previewContentEl) {
        previewContentEl = document.querySelector('[data-preview-content]') as HTMLElement | null;
      }
      if (previewContentEl) {
        const w = container.clientWidth || 0;
        const h = container.clientHeight || 0;
        const base = Math.min(w, h);

        const targetBlend = isRotationPausedRef.current ? 0 : 1;
        const k = 1 - Math.exp(-delta * 6);
        orbitBlend += (targetBlend - orbitBlend) * k;

        core.getWorldPosition(tmpWorld);
        tmpNdc.copy(tmpWorld).project(camera);
        const cx = (tmpNdc.x * 0.5) * w;
        const cy = (-tmpNdc.y * 0.5) * h;

        const radiusX = Math.min(380, Math.max(80, base * 0.35));
        const radiusY = Math.min(240, Math.max(50, base * 0.2));
        const t = elapsed * 0.15;
        const ox = Math.cos(t) * radiusX;
        const oy = Math.sin(t) * radiusY;

        const x = (cx + ox) * orbitBlend;
        const y = (cy + oy) * orbitBlend;
        const z = (Math.sin(t * 0.9) * Math.min(120, Math.max(30, base * 0.15))) * orbitBlend;
        const rx = (Math.sin(t * 1.1) * 12) * orbitBlend;
        const ry = elapsed * 12; // 降低自转速度，让厚度展示更清晰且不晕
        previewContentEl.style.setProperty('--preview-orbit-x', `${x.toFixed(2)}px`);
        previewContentEl.style.setProperty('--preview-orbit-y', `${y.toFixed(2)}px`);
        previewContentEl.style.setProperty('--preview-orbit-z', `${z.toFixed(2)}px`);
        previewContentEl.style.setProperty('--preview-orbit-rx', `${rx.toFixed(2)}deg`);
        previewContentEl.style.setProperty('--preview-orbit-ry', `${ry.toFixed(2)}deg`);
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.cancelAnimationFrame(frameId);
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
      coreGeometry.dispose();
      coreMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, []); // Run only once on mount

  return <div ref={containerRef} className="absolute inset-0 z-[1] pointer-events-none" />;
}
