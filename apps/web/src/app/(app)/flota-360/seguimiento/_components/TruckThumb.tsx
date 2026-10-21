'use client';

// Thumbnail 3D del semi — renderiza semi-truck.glb (mismo modelo
// del Centro de Control) una sola vez a un canvas pequeño.
import { useEffect, useRef, useState } from 'react';

export default function TruckThumb() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let renderer: any = null;
    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        if (disposed || !ref.current) return;

        const W = 220, H = 84;
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        ref.current.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(3, 5, 4);
        scene.add(key);
        scene.add(new THREE.AmbientLight(0x8fb4e0, 1.1));

        const gltf = await new GLTFLoader().loadAsync('/cc-assets/3d/semi-truck.glb');
        if (disposed) return;
        const model = gltf.scene;
        // tinte azul corporativo suave
        model.traverse((o: any) => {
          if (o.isMesh && o.material?.color) {
            o.material.color.lerp(new THREE.Color('#3b82f6'), 0.18);
          }
        });
        // encuadrar: medir bounding box y centrar
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        scene.add(model);

        const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
        const maxDim = Math.max(size.x, size.y, size.z);
        cam.position.set(maxDim * 0.9, maxDim * 0.45, maxDim * 0.9);
        cam.lookAt(0, size.y * 0.05, 0);
        renderer.render(scene, cam);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      try { renderer?.dispose?.(); } catch {}
    };
  }, []);

  if (failed) return <div ref={ref} className="h-[84px]" />;
  return <div ref={ref} className="flex h-[84px] items-center justify-center [&>canvas]:rounded-lg" />;
}
