import * as THREE from 'three';

/** Clone and prepare a GLTF scene for rendering / collision (centering, auto-fit, shadows). */
export const prepareGltfScene = (
  scene: THREE.Object3D,
  opts?: { autoFit?: number; pickable?: boolean },
): THREE.Object3D => {
  const { autoFit, pickable = true } = opts || {};
  const c = scene.clone(true);
  c.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!pickable) mesh.raycast = () => null;
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
    if (m.isMesh) out.push(m);
  });
  return out;
};
