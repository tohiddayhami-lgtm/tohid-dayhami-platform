import * as THREE from 'three';

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _normal = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

export const ENV_COLLISION = {
  playerRadius: 0.35,
  maxStepUp: 0.42,
  maxStepDown: 1.4,
  walkableNormalY: 0.32,
  bodyHeights: [0.3, 0.85, 1.45] as const,
  wallProbeDist: 0.38,
  groundRayStart: 12,
  groundRayMax: 16,
};

export const environmentCollisionEnabled = (expo: {
  environmentUrl?: string;
  environmentCollision?: boolean;
}) => !!expo.environmentUrl && expo.environmentCollision !== false;

export const syncCollisionMatrices = (root: THREE.Object3D | null) => {
  root?.updateMatrixWorld(true);
};

const isWalkableHit = (hit: THREE.Intersection): boolean => {
  if (!hit.face) return false;
  _normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  return _normal.y >= ENV_COLLISION.walkableNormalY;
};

const isWallHit = (hit: THREE.Intersection): boolean => {
  if (!hit.face) return true;
  _normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  return Math.abs(_normal.y) < 0.55;
};

/** Raycast downward to find walkable floor/stair surface at (x, z). */
export const sampleGroundY = (
  meshes: THREE.Mesh[],
  x: number,
  z: number,
  startY = ENV_COLLISION.groundRayStart,
): number | null => {
  if (!meshes.length) return null;
  _origin.set(x, startY, z);
  raycaster.set(_origin, DOWN);
  raycaster.far = ENV_COLLISION.groundRayMax;
  const hits = raycaster.intersectObjects(meshes, false);
  for (const hit of hits) {
    if (isWalkableHit(hit)) return hit.point.y;
  }
  return null;
};

const probeBlocked = (meshes: THREE.Mesh[], x: number, y: number, z: number, dx: number, dz: number): boolean => {
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return false;
  _dir.set(dx / len, 0, dz / len);
  _origin.set(x, y, z);
  raycaster.set(_origin, _dir);
  raycaster.far = ENV_COLLISION.wallProbeDist;
  const hits = raycaster.intersectObjects(meshes, false);
  return hits.length > 0 && hits[0].distance < ENV_COLLISION.wallProbeDist - 0.04 && isWallHit(hits[0]);
};

/** True when a capsule-sized body cannot stand at (x, z) with given feet Y. */
export const isPositionBlocked = (
  meshes: THREE.Mesh[],
  x: number,
  z: number,
  feetY: number,
): boolean => {
  const { playerRadius, bodyHeights } = ENV_COLLISION;
  const probes = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707],
  ];
  for (const h of bodyHeights) {
    const y = feetY + h;
    for (const [ux, uz] of probes) {
      if (probeBlocked(meshes, x + ux * playerRadius, y, z + uz * playerRadius, ux, uz)) return true;
    }
  }
  return false;
};

export const resolveHorizontalMove = (
  meshes: THREE.Mesh[],
  x: number,
  z: number,
  feetY: number,
  dx: number,
  dz: number,
): { x: number; z: number } => {
  const tx = x + dx;
  const tz = z + dz;
  if (!isPositionBlocked(meshes, tx, tz, feetY)) return { x: tx, z: tz };
  if (!isPositionBlocked(meshes, tx, z, feetY)) return { x: tx, z };
  if (!isPositionBlocked(meshes, x, tz, feetY)) return { x, z: tz };
  return { x, z };
};

export const applyGroundHeight = (
  meshes: THREE.Mesh[],
  x: number,
  z: number,
  currentFeetY: number,
  eyeHeight: number,
): { y: number; feetY: number } | null => {
  const ground = sampleGroundY(meshes, x, z, currentFeetY + eyeHeight + 4);
  if (ground == null) return null;
  const step = ground - currentFeetY;
  if (step > ENV_COLLISION.maxStepUp || step < -ENV_COLLISION.maxStepDown) return null;
  return { y: ground + eyeHeight, feetY: ground };
};

export const resolveEnvPosition = (
  meshes: THREE.Mesh[],
  pos: THREE.Vector3,
  eyeHeight: number,
  dx: number,
  dz: number,
): THREE.Vector3 => {
  const feetY = pos.y - eyeHeight;
  const moved = resolveHorizontalMove(meshes, pos.x, pos.z, feetY, dx, dz);
  const grounded = applyGroundHeight(meshes, moved.x, moved.z, feetY, eyeHeight);
  if (grounded) return new THREE.Vector3(moved.x, grounded.y, moved.z);
  if (!isPositionBlocked(meshes, moved.x, moved.z, feetY)) {
    return new THREE.Vector3(moved.x, pos.y, moved.z);
  }
  return pos.clone();
};

export const resolveEnvTeleport = (
  meshes: THREE.Mesh[],
  x: number,
  z: number,
  eyeHeight: number,
  fallbackY: number,
): THREE.Vector3 => {
  const ground = sampleGroundY(meshes, x, z);
  const y = ground != null ? ground + eyeHeight : fallbackY;
  if (isPositionBlocked(meshes, x, z, y - eyeHeight)) {
    return new THREE.Vector3(x, fallbackY, z);
  }
  return new THREE.Vector3(x, y, z);
};
