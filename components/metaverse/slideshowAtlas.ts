import * as THREE from 'three';

/** One shared atlas for all booth slideshow LCDs — Quest WebGL allows ~16 textures total. */
export const SLIDESHOW_ATLAS_COLS = 4;
export const SLIDESHOW_ATLAS_ROWS = 10;
export const SLIDESHOW_ATLAS_CELL_W = 480;
export const SLIDESHOW_ATLAS_CELL_H = Math.round(SLIDESHOW_ATLAS_CELL_W * 0.75) + 40;

const MAX_SLOTS = SLIDESHOW_ATLAS_COLS * SLIDESHOW_ATLAS_ROWS;

let atlasCanvas: HTMLCanvasElement | null = null;
let atlasTexture: THREE.CanvasTexture | null = null;
const idToSlot = new Map<string, number>();
let nextSlot = 0;

const ensureAtlas = () => {
  if (atlasCanvas && atlasTexture) return;
  const W = SLIDESHOW_ATLAS_COLS * SLIDESHOW_ATLAS_CELL_W;
  const H = SLIDESHOW_ATLAS_ROWS * SLIDESHOW_ATLAS_CELL_H;
  atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = W;
  atlasCanvas.height = H;
  const ctx = atlasCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, W, H);
  }
  atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.generateMipmaps = false;
  atlasTexture.minFilter = THREE.LinearFilter;
  atlasTexture.anisotropy = 1;
};

export const registerSlideshowAtlasPanel = (panelId: string): number => {
  ensureAtlas();
  const hit = idToSlot.get(panelId);
  if (hit != null) return hit;
  const slot = Math.min(nextSlot++, MAX_SLOTS - 1);
  idToSlot.set(panelId, slot);
  return slot;
};

export const unregisterSlideshowAtlasPanel = (panelId: string) => {
  idToSlot.delete(panelId);
};

export const getSlideshowAtlasTexture = (): THREE.CanvasTexture => {
  ensureAtlas();
  return atlasTexture!;
};

export const paintSlideshowAtlasCell = (
  slot: number,
  draw: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void,
) => {
  ensureAtlas();
  const col = slot % SLIDESHOW_ATLAS_COLS;
  const row = Math.floor(slot / SLIDESHOW_ATLAS_COLS);
  const x = col * SLIDESHOW_ATLAS_CELL_W;
  const y = row * SLIDESHOW_ATLAS_CELL_H;
  const ctx = atlasCanvas!.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, SLIDESHOW_ATLAS_CELL_W, SLIDESHOW_ATLAS_CELL_H);
  draw(ctx, SLIDESHOW_ATLAS_CELL_W, SLIDESHOW_ATLAS_CELL_H);
  ctx.restore();
  atlasTexture!.needsUpdate = true;
};

export const createSlideshowAtlasPlaneGeometry = (
  slot: number,
  planeW: number,
  planeH: number,
): THREE.PlaneGeometry => {
  const cols = SLIDESHOW_ATLAS_COLS;
  const rows = SLIDESHOW_ATLAS_ROWS;
  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const u0 = col / cols;
  const u1 = (col + 1) / cols;
  const vBottom = 1 - (row + 1) / rows;
  const vTop = 1 - row / rows;
  const geo = new THREE.PlaneGeometry(planeW, planeH);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // PlaneGeometry: indices 0,1 = top (+y); 2,3 = bottom (-y). CanvasTexture flipY aligns canvas top → vTop.
  uv.setXY(0, u0, vTop);
  uv.setXY(1, u1, vTop);
  uv.setXY(2, u0, vBottom);
  uv.setXY(3, u1, vBottom);
  uv.needsUpdate = true;
  return geo;
};

/** Map mesh hit UV (atlas space) to 0–1 cell-local coords for toolbar hit zones. */
export const slideshowAtlasLocalUV = (
  slot: number,
  u: number,
  v: number,
): { lu: number; lv: number } => {
  const cols = SLIDESHOW_ATLAS_COLS;
  const rows = SLIDESHOW_ATLAS_ROWS;
  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const u0 = col / cols;
  const u1 = (col + 1) / cols;
  const vBottom = 1 - (row + 1) / rows;
  const vTop = 1 - row / rows;
  const lu = (u - u0) / (u1 - u0);
  const lv = (v - vBottom) / (vTop - vBottom);
  return {
    lu: Math.max(0, Math.min(1, lu)),
    lv: Math.max(0, Math.min(1, lv)),
  };
};
