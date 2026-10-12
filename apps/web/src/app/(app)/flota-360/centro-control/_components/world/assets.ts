// ============================================================
// Carga de modelos 3D (glTF + meshopt) con caché.
// Assets: Grab3D "Cozy" kits (CC0) y Kenney Mini Characters (CC0).
// ============================================================
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export const ASSET_BASE = '/cc-assets/3d';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();

// Respuesta física por tipo de superficie, inferida del nombre del material.
// Se aplica una sola vez por material (los clones lo comparten).
const tuned = new WeakSet<THREE.Material>();
function tunePBR(sm: THREE.MeshStandardMaterial) {
  if (!sm || !sm.isMeshStandardMaterial || tuned.has(sm)) return;
  tuned.add(sm);
  if (sm.map) sm.map.anisotropy = 8;
  const n = (sm.name || '').toLowerCase();
  const vehicle = /^(semi-truck|delivery-truck|tow-truck|pickup-truck|hatchback|delivery-van|forklift)_/.test(n);
  if (/tree|bush|hedge|leaf|foliage/.test(n)) {
    sm.roughness = 0.9; sm.envMapIntensity = 0.5;
  } else if (/glass|window|windshield/.test(n)) {
    sm.roughness = 0.06; sm.metalness = 0.25; sm.envMapIntensity = 1.8;
    sm.color.multiplyScalar(0.55);
  } else if (/tire|rubber/.test(n)) {
    sm.roughness = 0.9; sm.metalness = 0; sm.envMapIntensity = 0.4;
  } else if (vehicle && /paint|stripe|body|trailer/.test(n)) {
    sm.roughness = Math.min(sm.roughness, 0.38); sm.envMapIntensity = 1.15;
  } else if (/chrome|steel|metal|rim/.test(n)) {
    sm.roughness = Math.min(sm.roughness, 0.35); sm.metalness = Math.max(sm.metalness, 0.6);
  } else if (/concrete|shell|facade/.test(n)) {
    sm.roughness = Math.max(sm.roughness, 0.85); sm.envMapIntensity = 0.7;
  }
}

export function loadModel(name: string): Promise<GLTF> {
  let p = cache.get(name);
  if (!p) {
    p = loader.loadAsync(`${ASSET_BASE}/${name}.glb`).then((g) => {
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => tunePBR(mat as THREE.MeshStandardMaterial));
        }
      });
      return g;
    });
    cache.set(name, p);
  }
  return p;
}

export async function preload(names: string[], onProgress?: (done: number, total: number) => void) {
  let done = 0;
  await Promise.all(names.map((n) => loadModel(n).catch(() => null).finally(() => onProgress?.(++done, names.length))));
}

// Clon estático (geometría y materiales compartidos)
export async function instance(name: string): Promise<THREE.Object3D> {
  const g = await loadModel(name);
  return g.scene.clone(true);
}

// Clon con esqueleto (personajes animados)
export async function instanceSkinned(name: string): Promise<{ obj: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  const g = await loadModel(name);
  return { obj: SkeletonUtils.clone(g.scene), clips: g.animations };
}

// Ubica un objeto con su base en y=0 y centrado en (x,z)
export function placeOnGround(obj: THREE.Object3D, x: number, z: number, rot = 0, scale = 1) {
  obj.rotation.y = rot;
  obj.scale.setScalar(scale);
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3());
  obj.position.set(x - c.x, -b.min.y, z - c.z);
  return obj;
}

// Material compartido para clones que necesitan tinte propio
export function cloneMaterials(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
  });
}

export const MODEL_LIST = [
  'semi-truck', 'delivery-truck', 'tow-truck', 'pickup-truck', 'forklift', 'pallet-jack',
  'warehouse', 'factory', 'office-building', 'car-wash', 'site-office', 'gas-station',
  'pallet-rack', 'wooden-pallet', 'cardboard-box-stack', 'street-light', 'fuel-tank', 'dumpster',
  'traffic-barrel', 'jersey-barrier', 'bollard', 'stop-sign', 'water-tower',
  'oak-tree', 'pine-tree', 'bush', 'hedge', 'cypress-tree', 'toolbox', 'workbench', 'air-compressor',
  'hatchback', 'delivery-van', 'steel-beam-stack', 'concrete-pipe', 'gas-cylinder', 'conveyor-belt',
];

export const PEOPLE = ['people/character-male-a', 'people/character-male-c', 'people/character-male-e', 'people/character-female-b'];
