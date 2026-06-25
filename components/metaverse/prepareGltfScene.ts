import * as THREE from 'three';

export interface PrepareGltfOptions {
  autoFit?: number;
  pickable?: boolean;
  /** Large hall GLBs: skip shadows for much better GPU performance. */
  shadows?: boolean;
}

/** Clone and prepare a GLTF scene for rendering / collision (centering, auto-fit, shadows). */
export const prepareGltfScene = (
  scene: THREE.Object3D,
  opts?: PrepareGltfOptions,
): THREE.Object3D => {
  const { autoFit, pickable = true, shadows = true } = opts || {};
  const c = scene.clone(true);
  c.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.frustumCulled = true;
    if (!pickable) mesh.raycast = () => null;
    if (!shadows && mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        if ('map' in m && m.map) m.map.anisotropy = 1;
        if ('normalMap' in m && m.normalMap) m.normalMap.anisotropy = 1;
      });
    }
  });
  if (autoFit && autoFit > 0) {
    const box = new THREE.Box3().setFromObject(c);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    c.position.sub(center);
    const footprint = Math.max(size.x, size.z, 0.0001);
    c.scale.setScalar(autoFit / footprint);
    const grounded = new THREE.Box3().setFromObject(c);
    c.position.y -= grounded.min.y;
  }
  return c;
};

export const collectMeshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.collisionProxy) out.push(m);
  });
  return out;
};

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _local = new THREE.Vector3();
const _invRoot = new THREE.Matrix4();

const removeOldProxies = (root: THREE.Object3D) => {
  const toRemove: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.userData.collisionProxy) toRemove.push(o);
  });
  toRemove.forEach((o) => {
    o.parent?.remove(o);
    (o as THREE.Mesh).geometry?.dispose();
  });
};

/**
 * Invisible box proxies for environment collision — ~12 tris each instead of millions.
 * Keeps the largest meshes (walls/floors/stairs) and skips tiny props.
 */
export const attachEnvCollisionProxies = (root: THREE.Object3D, maxBoxes = 72): THREE.Mesh[] => {
  removeOldProxies(root);
  root.updateMatrixWorld(true);
  _invRoot.copy(root.matrixWorld).invert();

  const candidates: { volume: number; box: THREE.Box3 }[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.collisionProxy || !m.geometry) return;
    _box.setFromObject(m);
    _box.getSize(_size);
    const vol = _size.x * _size.y * _size.z;
    if (vol < 0.02 || _size.y < 0.04) return;
    candidates.push({ volume: vol, box: _box.clone() });
  });

  candidates.sort((a, b) => b.volume - a.volume);
  const mat = new THREE.MeshBasicMaterial({ visible: false });
  mat.colorWrite = false;
  const proxies: THREE.Mesh[] = [];

  for (const c of candidates.slice(0, maxBoxes)) {
    c.box.getSize(_size);
    if (_size.x < 0.05 || _size.y < 0.05 || _size.z < 0.05) continue;
    c.box.getCenter(_center);
    _local.copy(_center).applyMatrix4(_invRoot);

    const geo = new THREE.BoxGeometry(_size.x, _size.y, _size.z);
    const proxy = new THREE.Mesh(geo, mat);
    proxy.position.copy(_local);
    proxy.userData.collisionProxy = true;
    proxy.frustumCulled = false;
    root.add(proxy);
    proxies.push(proxy);
  }

  root.updateMatrixWorld(true);
  return proxies;
};

export const detachEnvCollisionProxies = (root: THREE.Object3D) => {
  removeOldProxies(root);
};
