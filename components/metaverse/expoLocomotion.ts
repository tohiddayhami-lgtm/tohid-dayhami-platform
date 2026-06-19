import * as THREE from 'three';

export const LOCO = {
  walkSpeed: 3.2,
  runSpeed: 6,
  flySpeed: 5.5,
  flyVerticalSpeed: 4.2,
  jumpSpeed: 5.2,
  gravity: 14,
  minY: 0.35,
  maxY: 80,
};

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const horizontalInput = (c: {
  keys: { forward: boolean; back: boolean; left: boolean; right: boolean };
  joy: { x: number; y: number };
}) => ({
  mf: (c.keys.forward ? 1 : 0) - (c.keys.back ? 1 : 0) - c.joy.y,
  ms: (c.keys.right ? 1 : 0) - (c.keys.left ? 1 : 0) + c.joy.x,
});

export const verticalInput = (c: {
  keys: { up: boolean; down: boolean };
  flyVertical: number;
}) => (c.keys.up ? 1 : 0) - (c.keys.down ? 1 : 0) + c.flyVertical;

/** Camera-relative horizontal move delta (XZ). */
export const horizontalDelta = (
  camera: THREE.Camera,
  mf: number,
  ms: number,
  speed: number,
  dt: number,
  out: THREE.Vector3,
): THREE.Vector3 => {
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _fwd.normalize();
  _right.crossVectors(_fwd, UP).normalize();
  return out.set(0, 0, 0)
    .addScaledVector(_fwd, mf * speed * dt)
    .addScaledVector(_right, ms * speed * dt);
};

/** Fly: move along look direction (full 3D) + explicit vertical. */
export const flyDelta = (
  camera: THREE.Camera,
  mf: number,
  ms: number,
  mv: number,
  speed: number,
  vSpeed: number,
  dt: number,
  out: THREE.Vector3,
): THREE.Vector3 => {
  camera.getWorldDirection(_fwd);
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _fwd.normalize();
  _right.crossVectors(_fwd, UP).normalize();
  return out.set(0, 0, 0)
    .addScaledVector(_fwd, mf * speed * dt)
    .addScaledVector(_right, ms * speed * dt)
    .addScaledVector(UP, mv * vSpeed * dt);
};

export const clampY = (y: number) => Math.max(LOCO.minY, Math.min(LOCO.maxY, y));
