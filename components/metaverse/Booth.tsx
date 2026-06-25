import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { Html, useTexture, useVideoTexture, RoundedBox, useGLTF, Billboard } from '@react-three/drei';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import type { BoothTier, ExpoVisualStyle, MetaExpoEvent, MetaShopProduct, MetaverseBooth, MetaverseHotspot } from '../../types';
import { boothIsReservable, type BoothReservationSummary } from '../../utils/boothReservationUtils';
import { Language } from '../../App';
import { bi, expoPhrase, isVideoUrl, isVideoFile, isGif, isPdfFile, isHtmlFile, screenEmbed, boothEntranceFacingYaw, resolveSlideshowProducts, SLIDESHOW_PAGE_SIZE, slideshowPageCount, slideshowPageSlice } from './expoUtils';
import { Hotspot } from './Hotspot';
import { GltfModel } from './GltfModel';
import { BoothMeetBadge } from './BoothMeetBadge';
import { CanvasLabel } from './CanvasLabel';
import type { BoothFace } from '../../types';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

interface Props {
  booth: MetaverseBooth;
  index?: number;            // 0-based booth order → shown as a 1-based number on the header sign
  lang: Language;
  onSelectHotspot: (h: MetaverseHotspot) => void;
  onSelectBooth: (b: MetaverseBooth) => void;
  onTrack?: (type: MetaExpoEvent['type'], opts?: Partial<MetaExpoEvent>) => void;
  visualStyle?: ExpoVisualStyle;
  categoryName?: string;
  categoryColor?: string;
  hallDepth?: number;
  boothSummary?: BoothReservationSummary | null;
  onReserveBooth?: (b: MetaverseBooth) => void;
  shopProducts?: MetaShopProduct[];
  /** Default language for slideshow product text (expo / shop). */
  slideshowDefaultLang?: string;
  slideshowLangOptions?: string[];
}

// Latin → Persian digits for the booth number on the header sign.
const faDigits = (s: string | number) => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);

// Catches a failed texture/GLTF load (e.g. a Firebase Storage image without CORS headers, which
// WebGL refuses to use) so ONE bad image can't crash the whole exhibition — it just renders nothing.
export class TexBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — a missing booth image is non-fatal */ }
  render() { return this.state.failed ? null : this.props.children; }
}

type MediaProps = {
  url: string;
  width: number;
  height: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
};

const ThinPanelFrame: React.FC<{ width: number; height: number; z?: number; color?: string }> = ({ width, height, z = 0.05, color = '#0f172a' }) => {
  const t = 0.035;
  const mat = <meshStandardMaterial color={color} metalness={0.35} roughness={0.4} />;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, height / 2 + t / 2, 0]}><boxGeometry args={[width + t * 2, t, 0.018]} />{mat}</mesh>
      <mesh position={[0, -height / 2 - t / 2, 0]}><boxGeometry args={[width + t * 2, t, 0.018]} />{mat}</mesh>
      <mesh position={[-width / 2 - t / 2, 0, 0]}><boxGeometry args={[t, height + t * 2, 0.018]} />{mat}</mesh>
      <mesh position={[width / 2 + t / 2, 0, 0]}><boxGeometry args={[t, height + t * 2, 0.018]} />{mat}</mesh>
    </group>
  );
};

// Optional image-on-a-plane (logo / banner / wall panel). Loads lazily; absent → nothing.
const ImagePlane: React.FC<MediaProps> = ({ url, width, height, position, rotation, onClick }) => {
  const tex = useTexture(url);
  return (
    <mesh
      position={position}
      rotation={rotation}
      onClick={onClick}
      onPointerOver={() => { if (onClick) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex as THREE.Texture} transparent toneMapped={false} />
    </mesh>
  );
};

// ImagePlane guarded by its own error boundary + Suspense. `key={url}` retries when the URL changes.
const SafeImage: React.FC<MediaProps> = (props) => (
  <TexBoundary key={props.url}>
    <Suspense fallback={null}>
      <ImagePlane {...props} />
    </Suspense>
  </TexBoundary>
);

let pdfjsPromise: Promise<any> | null = null;
const getPdfjs = () => {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist').then(m => { m.GlobalWorkerOptions.workerSrc = pdfWorkerUrl; return m; });
  return pdfjsPromise;
};

const PdfArrowBtn: React.FC<{ x: number; glyph: string; onClick: () => void; color: string; btnW?: number; btnH?: number }> = ({ x, glyph, onClick, color, btnW = 0.34, btnH = 0.26 }) => {
  const fire = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); };
  return (
  <group position={[x, 0, 0]}>
    <mesh onClick={fire}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <planeGeometry args={[btnW, btnH]} />
      <meshStandardMaterial color={color} />
    </mesh>
    <CanvasLabel text={glyph} width={btnW - 0.04} height={btnH - 0.04} position={[0, 0, 0.01]} color="#fff" onClick={onClick} />
  </group>
  );
};

const PdfPanel: React.FC<MediaProps> = ({ url, width, height, position, rotation, onClick }) => {
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [cachedCount, setCachedCount] = useState(0);
  const bitmapsRef = useRef<(ImageBitmap | null)[]>([]);
  const [tex] = useState(() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

  useEffect(() => {
    let cancelled = false;
    setCount(0); setPage(1); setDims({ w: 0, h: 0 }); setCachedCount(0);
    bitmapsRef.current.forEach(b => b?.close?.()); bitmapsRef.current = [];
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        setCount(doc.numPages);
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const pg = await doc.getPage(i);
          const base = pg.getViewport({ scale: 1 });
          const vp = pg.getViewport({ scale: 1100 / base.width });
          const c = document.createElement('canvas');
          c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
          const ctx = c.getContext('2d')!;
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          if (cancelled) return;
          bitmapsRef.current[i] = await createImageBitmap(c);
          setCachedCount(i);
        }
      } catch { /* placeholder remains visible */ }
    })();
    return () => { cancelled = true; bitmapsRef.current.forEach(b => b?.close?.()); bitmapsRef.current = []; };
  }, [url]);

  useEffect(() => {
    const bmp = bitmapsRef.current[page];
    if (!bmp) return;
    const canvas = tex.image as HTMLCanvasElement;
    canvas.width = bmp.width; canvas.height = bmp.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    tex.needsUpdate = true;
    setDims({ w: bmp.width, h: bmp.height });
  }, [page, cachedCount, tex]);

  useEffect(() => () => tex.dispose(), [tex]);

  const ready = dims.w > 0;
  const ctrlH = 0.22;
  const viewH = height - ctrlH;
  const pageAspect = ready ? dims.h / dims.w : viewH / width;
  let pw = width, ph = width * pageAspect;
  if (ph > viewH) { ph = viewH; pw = viewH / pageAspect; }
  const prev = () => setPage(p => Math.max(1, p - 1));
  const next = () => setPage(p => Math.min(count || 1, p + 1));

  return (
    <group position={position} rotation={rotation}>
      {ready ? (
        <mesh position={[0, ctrlH / 2, 0.01]} onClick={onClick}>
          <planeGeometry args={[pw, ph]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ) : (
        <CanvasLabel text="PDF..." width={Math.min(width * 0.55, 1.6)} height={0.32} position={[0, ctrlH / 2, 0.02]} color="#ffffff" />
      )}
      <group position={[0, -height / 2 + ctrlH / 2, 0.03]}>
        <PdfArrowBtn x={-0.48} glyph="‹" onClick={prev} color="#1f2937" />
        <CanvasLabel text={count ? `${page}/${count}` : "..."} width={0.55} height={0.2} position={[0, 0, 0]} bg="rgba(15,23,42,.92)" color="#ffffff" />
        <PdfArrowBtn x={0.48} glyph="›" onClick={next} color="#1f2937" />
      </group>
    </group>
  );
};

// drei <Html> attaches its DOM layer to the R3F event target, which in this app sits OUTSIDE the
// z-100 expo container → it ends up BEHIND the WebGL canvas (invisible — only the CanvasLabel
// glyph showed). Portal it into the canvas's own parent instead so the transformed iframe paints
// on top of the scene where it belongs.
const useCanvasPortal = () => {
  const gl = useThree(s => s.gl);
  return useRef<HTMLElement | null>(gl.domElement.parentElement);
};

// A DOM iframe that is projected to the four corners of an in-world wall panel. drei <Html
// transform> can fail to paint live iframes in this scene, while non-transform Html floats as a
// billboard. This keeps the reliable DOM iframe path but pins it to the wall's screen projection.
const ProjectedHtmlPanel: React.FC<{
  width: number;
  height: number;
  pxW: number;
  pxH: number;
  portal: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}> = ({ width, height, pxW, pxH, portal, children }) => {
  const { camera, size } = useThree();
  const inXR = useXR((s) => !!s.session);
  const anchorRef = useRef<THREE.Group>(null);
  const [el] = useState(() => document.createElement('div'));
  const rootRef = useRef<ReactDOM.Root | null>(null);
  const target = portal.current;
  const cornerRefs = useRef({
    tl: new THREE.Vector3(),
    tr: new THREE.Vector3(),
    bl: new THREE.Vector3(),
    br: new THREE.Vector3(),
    center: new THREE.Vector3(),
    camPos: new THREE.Vector3(),
    camDir: new THREE.Vector3(),
  });

  useEffect(() => {
    el.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      `width:${pxW}px`,
      `height:${pxH}px`,
      'transform-origin:0 0',
      'overflow:hidden',
      'border-radius:10px',
      'background:#fff',
      'box-shadow:0 0 28px rgba(80,140,255,.3)',
      'pointer-events:auto',
      'will-change:transform',
      'backface-visibility:hidden',
    ].join(';');
    rootRef.current = ReactDOM.createRoot(el);
    target?.appendChild(el);
    return () => {
      target?.removeChild(el);
      rootRef.current?.unmount();
      rootRef.current = null;
    };
  }, [el, pxW, pxH, target]);

  useEffect(() => {
    rootRef.current?.render(<>{children}</>);
  }, [children]);

  useFrame(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    if (inXR) {
      el.style.display = 'none';
      return;
    }

    anchor.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();

    const { tl, tr, bl, br, center, camPos, camDir } = cornerRefs.current;
    tl.set(-width / 2, height / 2, 0).applyMatrix4(anchor.matrixWorld);
    tr.set(width / 2, height / 2, 0).applyMatrix4(anchor.matrixWorld);
    bl.set(-width / 2, -height / 2, 0).applyMatrix4(anchor.matrixWorld);
    br.set(width / 2, -height / 2, 0).applyMatrix4(anchor.matrixWorld);
    center.set(0, 0, 0).applyMatrix4(anchor.matrixWorld);

    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir);
    const toPanel = center.clone().sub(camPos);
    if (toPanel.dot(camDir) <= 0) {
      el.style.display = 'none';
      return;
    }

    const toScreen = (v: THREE.Vector3) => {
      v.project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * size.width,
        y: (-v.y * 0.5 + 0.5) * size.height,
        z: v.z,
      };
    };
    const p0 = toScreen(tl);
    const p1 = toScreen(tr);
    const p2 = toScreen(bl);
    const p3 = toScreen(br);
    if (p0.z < -1 || p0.z > 1 || p1.z < -1 || p1.z > 1 || p2.z < -1 || p2.z > 1 || p3.z < -1 || p3.z > 1) {
      el.style.display = 'none';
      return;
    }

    const dx1 = p1.x - p3.x;
    const dy1 = p1.y - p3.y;
    const dx2 = p2.x - p3.x;
    const dy2 = p2.y - p3.y;
    const sx = p0.x - p1.x + p3.x - p2.x;
    const sy = p0.y - p1.y + p3.y - p2.y;
    const denom = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(denom) < 1e-6) {
      el.style.display = 'none';
      return;
    }
    const g = (sx * dy2 - dx2 * sy) / denom;
    const h = (dx1 * sy - sx * dy1) / denom;
    const a = p1.x - p0.x + g * p1.x;
    const b = p1.y - p0.y + g * p1.y;
    const c = p2.x - p0.x + h * p2.x;
    const d = p2.y - p0.y + h * p2.y;
    const f = (n: number) => Math.round(n * 10000) / 10000;
    el.style.display = 'block';
    el.style.zIndex = '28';
    el.style.transform = `matrix3d(${f(a / pxW)},${f(b / pxW)},0,${f(g / pxW)},${f(c / pxH)},${f(d / pxH)},0,${f(h / pxH)},0,0,1,0,${f(p0.x)},${f(p0.y)},0,1)`;
  });

  return <group ref={anchorRef} position={[0, 0, 0.035]} />;
};

// Best-effort WebGL copy of the iframe for immersive VR. Browsers do not render DOM iframes inside
// WebXR, so this snapshots same-origin/srcDoc HTML into a texture that the headset can actually see.
const HtmlSnapshotPlane: React.FC<{
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  width: number;
  height: number;
}> = ({ iframeRef, width, height }) => {
  const [tex] = useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 8; canvas.height = 8;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
  const [ready, setReady] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    let html2canvasPromise: Promise<typeof import('html2canvas').default> | null = null;
    const capture = async () => {
      const frame = iframeRef.current;
      const doc = frame?.contentDocument;
      const body = doc?.body;
      if (!frame || !body || busy.current) return;
      busy.current = true;
      try {
        html2canvasPromise ||= import('html2canvas').then(m => m.default);
        const html2canvas = await html2canvasPromise;
        const w = frame.clientWidth || 900;
        const h = frame.clientHeight || Math.round((w * height) / width);
        const snap = await html2canvas(body, {
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
          width: w,
          height: h,
          windowWidth: w,
          windowHeight: h,
          scale: 1,
        });
        if (!alive) return;
        const dst = tex.image as HTMLCanvasElement;
        dst.width = snap.width; dst.height = snap.height;
        const ctx = dst.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, dst.width, dst.height);
          ctx.drawImage(snap, 0, 0);
          tex.needsUpdate = true;
          setReady(true);
        }
      } catch {
        // Cross-origin or complex pages may not snapshot; keep the static VR fallback visible.
      } finally {
        busy.current = false;
      }
    };
    const timer = window.setInterval(capture, 1600);
    const first = window.setTimeout(capture, 700);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, [height, iframeRef, tex, width]);

  useEffect(() => () => tex.dispose(), [tex]);

  return ready ? (
    <mesh position={[0, 0, 0.012]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  ) : null;
};

const productLabel = (p: MetaShopProduct, code: string) =>
  (p.i18n?.[code]?.name || p.name || '').trim() || '—';

const productDesc = (p: MetaShopProduct, code: string) =>
  (p.i18n?.[code]?.description || p.description || '').trim();

const isRtlCode = (code: string) => code === 'fa' || code === 'ar';

const wrapCanvasLines = (ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] => {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const flush = () => { if (line) { lines.push(line); line = ''; } };
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      flush();
      if (lines.length >= maxLines) break;
      line = w;
    } else line = test;
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (!lines.length && text) {
    let chunk = '';
    for (const ch of text) {
      const test = chunk + ch;
      if (ctx.measureText(test).width > maxW && chunk) {
        lines.push(chunk);
        chunk = ch;
        if (lines.length >= maxLines) break;
      } else chunk = test;
    }
    if (chunk && lines.length < maxLines) lines.push(chunk);
  }
  return lines.slice(0, maxLines);
};

const SLIDE_BITMAP_CACHE = new Map<string, Promise<ImageBitmap | null>>();
const SLIDE_BITMAP_MAX = 480;
const SLIDESHOW_NEAR_DIST = 28;

const loadSlideBitmap = (url: string): Promise<ImageBitmap | null> => {
  const key = url.trim();
  if (!key) return Promise.resolve(null);
  let pending = SLIDE_BITMAP_CACHE.get(key);
  if (!pending) {
    pending = new Promise(resolve => {
      const img = new Image();
      if (!key.startsWith('data:') && !key.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = async () => {
        try {
          const max = Math.max(img.width, img.height);
          const scale = max > SLIDE_BITMAP_MAX ? SLIDE_BITMAP_MAX / max : 1;
          const rw = Math.max(1, Math.round(img.width * scale));
          const rh = Math.max(1, Math.round(img.height * scale));
          if (scale < 1) {
            try {
              resolve(await createImageBitmap(img, { resizeWidth: rw, resizeHeight: rh }));
              return;
            } catch { /* fall through */ }
          }
          resolve(await createImageBitmap(img));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = key;
    });
    SLIDE_BITMAP_CACHE.set(key, pending);
  }
  return pending;
};

const nearbySlideIndexes = (index: number, count: number): number[] => {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const set = new Set([index, (index + 1) % count, (index - 1 + count) % count]);
  return [...set];
};

type SlideshowToolbarLayout = {
  playX: number;
  pagePrevX?: number;
  slidePrevX: number;
  slideNextX: number;
  pageNextX?: number;
  langX?: number;
  counterW: number;
  btnW: number;
};

/** Fit slideshow transport buttons inside panel width — scales down on narrow walls. */
const layoutSlideshowToolbar = (width: number, multiPage: boolean, showLang: boolean): SlideshowToolbarLayout => {
  const avail = Math.max(1.1, width * 0.9);
  const leftBtns = multiPage ? 3 : 2;
  const rightBtns = 1 + (multiPage ? 1 : 0) + (showLang ? 1 : 0);
  const baseBtn = 0.26;
  const baseCounter = multiPage ? 0.46 : 0.34;
  const basePad = 0.05;
  const rawSpan = baseCounter + (leftBtns + rightBtns) * (baseBtn + basePad);
  const scale = Math.min(1, avail / rawSpan);
  const btnW = Math.max(0.2, baseBtn * scale);
  const counterW = Math.max(0.28, baseCounter * scale);
  const pad = Math.max(0.035, basePad * scale);
  const step = btnW + pad;
  const slidePrevX = -(counterW / 2 + pad + btnW / 2);
  const slideNextX = counterW / 2 + pad + btnW / 2;
  if (multiPage) {
    const pagePrevX = slidePrevX - step;
    const playX = pagePrevX - step;
    const pageNextX = slideNextX + step;
    const langX = showLang ? pageNextX + step : undefined;
    return { playX, pagePrevX, slidePrevX, slideNextX, pageNextX, langX, counterW, btnW };
  }
  const playX = slidePrevX - step;
  const langX = showLang ? slideNextX + step : undefined;
  return { playX, slidePrevX, slideNextX, langX, counterW, btnW };
};

/** Wall-mounted LCD cycling through linked shop products with prev/next/play and language. */
const ProductSlideshowPanel: React.FC<{
  products: MetaShopProduct[];
  width: number;
  height: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  autoPlaySec?: number;
  defaultLang: string;
  langOptions: string[];
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}> = React.memo(({ products, width, height, position, rotation, autoPlaySec = 5, defaultLang, langOptions, onClick }) => {
  const rootRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const inXR = useXR(s => !!s.session);
  const totalCount = products.length;
  const pageCount = slideshowPageCount(totalCount);
  const langs = langOptions.length ? langOptions : [defaultLang || 'fa'];
  const [page, setPage] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const nearbyRef = useRef(true);
  const [displayLang, setDisplayLang] = useState(defaultLang || langs[0] || 'fa');
  const [bitmapTick, setBitmapTick] = useState(0);
  const bitmapRef = useRef<Map<number, ImageBitmap | null>>(new Map());
  const nearCheck = useRef(0);
  const playAcc = useRef(0);
  const playingRef = useRef(playing);
  const advanceRef = useRef<(dir: 1 | -1) => void>(() => {});
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  playingRef.current = playing;

  const pageProducts = useMemo(
    () => slideshowPageSlice(products, page),
    [products, page],
  );
  const count = pageProducts.length;
  const globalIndex = page * SLIDESHOW_PAGE_SIZE + index;
  const canNavigate = totalCount > 1;
  const multiPage = pageCount > 1;
  const showLang = langs.length > 1;

  const [tex] = useState(() => {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 1;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return t;
  });

  const urls = useMemo(
    () => pageProducts.map(p => String((p.images || []).find(Boolean) || '')),
    [pageProducts],
  );
  const urlsKey = `${page}|${products.map(p => p.id).join(',')}`;

  const productsKey = useMemo(() => products.map(p => p.id).join(','), [products]);

  useEffect(() => {
    setPage(0);
    setIndex(0);
    setPlaying(true);
    bitmapRef.current.clear();
    setBitmapTick(t => t + 1);
  }, [productsKey]);

  useEffect(() => {
    setIndex(i => Math.min(i, Math.max(0, count - 1)));
    bitmapRef.current.clear();
    setBitmapTick(t => t + 1);
  }, [page, count]);

  useEffect(() => {
    setDisplayLang(defaultLang || langs[0] || 'fa');
  }, [defaultLang, langs.join('|')]);

  useEffect(() => {
    if (!count) return;
    let cancelled = false;
    const loadNearby = async () => {
      const keep = new Set(nearbySlideIndexes(index, count));
      for (const i of bitmapRef.current.keys()) {
        if (!keep.has(i)) bitmapRef.current.delete(i);
      }
      await Promise.all([...keep].map(async i => {
        if (bitmapRef.current.has(i)) return;
        const url = urls[i];
        if (!url) { bitmapRef.current.set(i, null); return; }
        const bmp = await loadSlideBitmap(url);
        if (cancelled) return;
        bitmapRef.current.set(i, bmp);
      }));
      if (!cancelled) setBitmapTick(t => t + 1);
    };
    loadNearby();
    return () => { cancelled = true; };
  }, [index, count, urlsKey, urls]);

  useEffect(() => () => { bitmapRef.current.clear(); }, [urlsKey]);

  const paintSlide = useCallback((idx: number, code: string) => {
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = 640;
    const ch = Math.round(cw * 0.75);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, cw, ch);
    const footerH = 132;
    const imgMaxH = ch - footerH - 10;
    const bmp = bitmapRef.current.get(idx) ?? null;
    const p = pageProducts[idx];
    if (bmp) {
      const ar = bmp.width / bmp.height;
      let dw = cw * 0.98;
      let dh = dw / ar;
      if (dh > imgMaxH * 0.98) { dh = imgMaxH * 0.98; dw = dh * ar; }
      const dx = (cw - dw) / 2;
      const dy = Math.max(6, (imgMaxH - dh) / 2);
      ctx.drawImage(bmp, dx, dy, dw, dh);
    }
    if (p) {
      const rtl = isRtlCode(code);
      const pad = 18;
      const maxW = cw - pad * 2;
      ctx.fillStyle = 'rgba(8,12,24,.94)';
      ctx.fillRect(0, ch - footerH, cw, footerH);
      const name = productLabel(p, code);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Vazirmatn, Tahoma, sans-serif';
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.textBaseline = 'top';
      ctx.direction = rtl ? 'rtl' : 'ltr';
      const nameLine = name.length > 48 ? `${name.slice(0, 46)}…` : name;
      ctx.fillText(nameLine, rtl ? cw - pad : pad, ch - footerH + 10);
      const desc = productDesc(p, code);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '18px Vazirmatn, Tahoma, sans-serif';
      wrapCanvasLines(ctx, desc, maxW, 3).forEach((ln, i) => {
        ctx.fillText(ln, rtl ? cw - pad : pad, ch - footerH + 40 + i * 24);
      });
      ctx.direction = 'ltr';
    }
    tex.needsUpdate = true;
  }, [pageProducts, tex]);

  useEffect(() => {
    if (!count) return;
    paintSlide(Math.min(index, count - 1), displayLang);
  }, [index, count, displayLang, bitmapTick, paintSlide, page]);

  useEffect(() => () => tex.dispose(), [tex]);

  const advanceSlide = useCallback((dir: 1 | -1) => {
    if (!totalCount) return;
    if (dir === 1) {
      if (index < count - 1) setIndex(i => i + 1);
      else if (page < pageCount - 1) { setPage(p => p + 1); setIndex(0); }
      else { setPage(0); setIndex(0); }
      return;
    }
    if (index > 0) setIndex(i => i - 1);
    else if (page > 0) {
      const prevPage = page - 1;
      const prevLen = slideshowPageSlice(products, prevPage).length;
      setPage(prevPage);
      setIndex(Math.max(0, prevLen - 1));
    } else {
      const lastPage = pageCount - 1;
      const lastLen = slideshowPageSlice(products, lastPage).length;
      setPage(lastPage);
      setIndex(Math.max(0, lastLen - 1));
    }
  }, [index, count, page, pageCount, products, totalCount]);
  advanceRef.current = advanceSlide;

  useFrame((_, dt) => {
    nearCheck.current += 1;
    if (nearCheck.current % 24 === 0) {
      const g = rootRef.current;
      if (g) {
        g.getWorldPosition(worldPos);
        const d = worldPos.distanceTo(camera.position);
        const next = d < SLIDESHOW_NEAR_DIST;
        nearbyRef.current = next;
      }
    }
    if (!playingRef.current || totalCount < 2) return;
    if (!inXR && !nearbyRef.current) return;
    playAcc.current += dt;
    if (playAcc.current >= Math.max(2, autoPlaySec)) {
      playAcc.current = 0;
      advanceRef.current(1);
    }
  });

  const prev = () => { playAcc.current = 0; setPlaying(false); advanceSlide(-1); };
  const next = () => { playAcc.current = 0; setPlaying(false); advanceSlide(1); };
  const pagePrev = () => {
    playAcc.current = 0;
    setPlaying(false);
    setPage(p => (p - 1 + pageCount) % pageCount);
    setIndex(0);
  };
  const pageNext = () => {
    playAcc.current = 0;
    setPlaying(false);
    setPage(p => (p + 1) % pageCount);
    setIndex(0);
  };
  const togglePlay = () => {
    playAcc.current = 0;
    setPlaying(p => !p);
  };
  const cycleLang = () => {
    if (langs.length < 2) return;
    setDisplayLang(prev => langs[(langs.indexOf(prev) + 1) % langs.length] || prev);
  };

  const ctrlH = 0.34;
  const viewH = height - ctrlH;
  const bezel = 0.05;
  const toolbar = useMemo(
    () => layoutSlideshowToolbar(width, multiPage, showLang),
    [width, multiPage, showLang],
  );
  const btnH = Math.max(0.16, toolbar.btnW * 0.72);
  const counterLabel = totalCount
    ? (multiPage ? `${globalIndex + 1}/${totalCount} · ${page + 1}/${pageCount}` : `${globalIndex + 1}/${totalCount}`)
    : '—';

  return (
    <group ref={rootRef} position={position} rotation={rotation}>
      <RoundedBox args={[width + bezel, height + bezel, 0.035]} radius={0.02} smoothness={2} position={[0, 0, -0.028]}>
        <meshStandardMaterial color="#1a1f2e" metalness={0.45} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, ctrlH / 2, -0.008]}>
        <planeGeometry args={[width + 0.008, viewH + 0.008]} />
        <meshStandardMaterial color="#030712" emissive="#0a1626" emissiveIntensity={0.35} />
      </mesh>
      {totalCount > 0 ? (
        <mesh position={[0, ctrlH / 2, 0.006]} onClick={onClick}>
          <planeGeometry args={[width, viewH]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ) : (
        <CanvasLabel
          text={displayLang === 'fa' || displayLang === 'ar' ? 'بدون محصول' : 'No products'}
          width={width * 0.7}
          height={0.32}
          position={[0, ctrlH / 2, 0.012]}
          color="#ffffff"
        />
      )}
      <group position={[0, -height / 2 + ctrlH / 2, 0.022]}>
        <PdfArrowBtn x={toolbar.playX} btnW={toolbar.btnW} btnH={btnH} glyph={playing ? '⏸' : '▶'} onClick={togglePlay} color={canNavigate ? '#0f766e' : '#94a3b8'} />
        {multiPage && toolbar.pagePrevX != null && (
          <PdfArrowBtn x={toolbar.pagePrevX} btnW={toolbar.btnW} btnH={btnH} glyph="«" onClick={pagePrev} color="#475569" />
        )}
        <PdfArrowBtn x={toolbar.slidePrevX} btnW={toolbar.btnW} btnH={btnH} glyph="‹" onClick={prev} color={canNavigate ? '#1f2937' : '#94a3b8'} />
        <CanvasLabel
          text={counterLabel}
          width={toolbar.counterW}
          height={btnH}
          position={[0, 0, 0]}
          bg="rgba(15,23,42,.92)"
          color="#ffffff"
        />
        <PdfArrowBtn x={toolbar.slideNextX} btnW={toolbar.btnW} btnH={btnH} glyph="›" onClick={next} color={canNavigate ? '#1f2937' : '#94a3b8'} />
        {multiPage && toolbar.pageNextX != null && (
          <PdfArrowBtn x={toolbar.pageNextX} btnW={toolbar.btnW} btnH={btnH} glyph="»" onClick={pageNext} color="#475569" />
        )}
        {showLang && toolbar.langX != null && (
          <group position={[toolbar.langX, 0, 0]}>
            <mesh
              onClick={(e) => { e.stopPropagation(); cycleLang(); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <planeGeometry args={[toolbar.btnW, btnH]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <CanvasLabel
              text={displayLang.toUpperCase()}
              width={toolbar.btnW - 0.04}
              height={btnH - 0.04}
              position={[0, 0, 0.01]}
              color="#f8fafc"
              onClick={cycleLang}
            />
          </group>
        )}
      </group>
    </group>
  );
});

// One wall surface, by source: HTML page → iframe panel, animated GIF → animated texture,
// video → LCD screen, anything else → a static image panel.
const PanelMedia: React.FC<MediaProps> = (props) =>
  isHtmlFile(props.url) ? <HtmlPanel {...props} />
    : isPdfFile(props.url) ? <PdfPanel {...props} />
    : isGif(props.url) ? <GifPlane {...props} />
    : isVideoUrl(props.url) ? <BoothScreen {...props} />
    : <SafeImage {...props} />;

// An animated GIF painted onto the wall as a real WebGL texture (so it shows in VR too): an
// off-DOM <img> animates natively, and we copy its current frame onto a CanvasTexture each tick.
const GifPlane: React.FC<MediaProps> = ({ url, width, height, position, rotation, onClick }) => {
  const state = useMemo(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const o = { img, canvas, tex, ready: false };
    img.onload = () => { canvas.width = img.naturalWidth || 256; canvas.height = img.naturalHeight || 256; o.ready = true; };
    img.src = url;
    return o;
  }, [url]);
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (!state.ready) return;
    acc.current += dt;
    if (acc.current < 1 / 15) return;           // ~15fps redraw is plenty for a GIF and cheap
    acc.current = 0;
    const ctx = state.canvas.getContext('2d');
    if (ctx) { ctx.drawImage(state.img, 0, 0, state.canvas.width, state.canvas.height); state.tex.needsUpdate = true; }
  });
  useEffect(() => () => state.tex.dispose(), [state]);
  return (
    <mesh position={position} rotation={rotation} onClick={onClick}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={state.tex} transparent toneMapped={false} />
    </mesh>
  );
};

// An uploaded HTML page shown on the wall as a LIVE, interactive iframe (so even a self-unpacking
// JS bundle runs and renders for real, and the page scrolls natively). Keep this in non-transform
// mode: CSS3D transform iframes are unreliable in this scene and can leave only the fallback glyph
// visible. The markup is fetched and inlined via srcDoc (no Storage content-type / X-Frame issues)
// and run unsandboxed so its scripts work.
const HtmlPanel: React.FC<MediaProps> = ({ url, width, height, position, rotation, onClick }) => {
  const portal = useCanvasPortal();
  const [doc, setDoc] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let cancel = false;
    setDoc(null);
    fetch(url)
      .then(r => r.ok ? r.text() : Promise.reject(new Error('fetch failed')))
      .then(html => {
        if (cancel) return;
        if (!/<base\b/i.test(html)) {
          const tag = `<base href="${url.replace(/[^/]*$/, '')}">`;
          html = /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${tag}`) : `${tag}${html}`;
        }
        setDoc(html);
      })
      .catch(() => { /* fall back to a direct src below */ });
    return () => { cancel = true; };
  }, [url]);

  const PX_W = 1100;
  const PX_H = Math.max(2, Math.round((PX_W * height) / width));
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[width + 0.16, height + 0.16, 0.1]} radius={0.05} smoothness={3} position={[0, 0, -0.08]} castShadow>
        <meshStandardMaterial color="#0b0e14" metalness={0.55} roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 0.02, height + 0.02]} />
        <meshStandardMaterial color="#0b1220" emissive={'#0a1626'} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.035]} onClick={onClick}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <HtmlSnapshotPlane iframeRef={iframeRef} width={width} height={height} />
      {/* VR/static fallback glyph (covered once the snapshot or live iframe paints). */}
      <CanvasLabel text="HTML" width={width * 0.44} height={width * 0.16} position={[0, 0, 0.006]} bg="rgba(15,23,42,.72)" color="#ffffff" />
      <ThinPanelFrame width={width + 0.02} height={height + 0.02} />
      <ProjectedHtmlPanel width={width} height={height} pxW={PX_W} pxH={PX_H} portal={portal}>
        {doc != null
          ? <iframe ref={iframeRef} srcDoc={doc} style={{ display: 'block', border: 0, width: PX_W, height: PX_H, background: '#fff' }} title="booth-html" />
          : <iframe ref={iframeRef} src={url} style={{ display: 'block', border: 0, width: PX_W, height: PX_H, background: '#fff' }} title="booth-html" />}
      </ProjectedHtmlPanel>
    </group>
  );
};

// A small 3D push-button (rounded plate + glyph). Works with mouse AND a VR controller ray.
const CtrlBtn: React.FC<{ x: number; size: number; glyph: string; onClick: (e: ThreeEvent<MouseEvent>) => void }> = ({ x, size, glyph, onClick }) => (
  <group position={[x, 0, 0]}>
    <mesh onClick={onClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial color="#1b2230" transparent opacity={0.92} toneMapped={false} />
    </mesh>
    <CanvasLabel text={glyph} width={size * 0.78} height={size * 0.78} position={[0, 0, 0.002]} color="#ffffff" onClick={onClick} />
  </group>
);

// In-world transport controls overlaid on the bottom of a wall video: rewind/forward 10s,
// play/pause, a scrub bar (click anywhere to seek), and mute. All raycast-clickable, so they
// work both on desktop and with a VR controller pointer.
const VideoControls: React.FC<{ video: HTMLVideoElement; width: number; height: number; onActivity: () => void }> = ({ video, width, height, onActivity }) => {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const fillRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);

  const ch = Math.min(Math.max(height * 0.14, 0.075), 0.15);   // control-row height
  const gap = ch * 0.28;
  const by = -height / 2 + ch * 0.9;                            // row centre, just inside the bottom edge
  const prevX = -width / 2 + ch * 0.75;
  const playX = prevX + ch + gap;
  const nextX = playX + ch + gap;
  const muteX = width / 2 - ch * 0.75;
  const trackL = nextX + ch / 2 + gap;
  const trackR = muteX - ch / 2 - gap;
  const trackW = Math.max(0.2, trackR - trackL);
  const trackCx = (trackL + trackR) / 2;
  const trackH = ch * 0.26;
  const Z = 0.03;

  // Drive the fill width + playhead from the video clock each frame (refs only — no re-render).
  useFrame(() => {
    const d = video.duration || 0;
    const f = d ? Math.min(1, Math.max(0, (video.currentTime || 0) / d)) : 0;
    if (fillRef.current) { fillRef.current.scale.x = Math.max(0.0001, f); fillRef.current.position.x = trackL + (trackW * f) / 2; }
    if (headRef.current) headRef.current.position.x = trackL + trackW * f;
  });

  const toggle = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onActivity(); if (video.paused) video.play().catch(() => {}); else video.pause(); setPaused(video.paused); };
  const skip = (s: number) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onActivity(); const d = video.duration || 0; video.currentTime = Math.min(d ? d - 0.1 : 1e9, Math.max(0, (video.currentTime || 0) + s)); };
  const toggleMute = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onActivity(); video.muted = !video.muted; setMuted(video.muted); };
  const seek = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onActivity(); const d = video.duration || 0; if (d && e.uv) video.currentTime = Math.min(d - 0.1, Math.max(0, e.uv.x * d)); };

  return (
    <group position={[0, by, Z]}>
      {/* translucent backdrop so the controls stay legible over any video frame */}
      <mesh position={[0, 0, -0.004]}>
        <planeGeometry args={[width * 0.98, ch * 1.7]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.42} toneMapped={false} />
      </mesh>

      <CtrlBtn x={prevX} size={ch} glyph="⏪" onClick={skip(-10)} />
      <CtrlBtn x={playX} size={ch} glyph={paused ? '▶' : '⏸'} onClick={toggle} />
      <CtrlBtn x={nextX} size={ch} glyph="⏩" onClick={skip(10)} />
      <CtrlBtn x={muteX} size={ch} glyph={muted ? '🔇' : '🔊'} onClick={toggleMute} />

      {/* scrub bar: dark groove + green fill + playhead, with a transparent click target on top */}
      <mesh position={[trackCx, 0, 0]}>
        <planeGeometry args={[trackW, trackH]} />
        <meshBasicMaterial color="#3a4458" toneMapped={false} />
      </mesh>
      <mesh ref={fillRef} position={[trackCx, 0, 0.002]}>
        <planeGeometry args={[trackW, trackH]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
      <group ref={headRef} position={[trackCx, 0, 0.004]}>
        <mesh>
          <circleGeometry args={[trackH * 0.85, 20]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </group>
      {/* frontmost transparent hit area → click/drag anywhere on the bar to seek */}
      <mesh position={[trackCx, 0, 0.006]} onClick={seek}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
        <planeGeometry args={[trackW, trackH * 2.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
};

// A real <video> textured straight onto the 3D plane — looping in-world playback with transport
// controls. Used ONLY for direct video files (mp4/webm/ogg); YouTube/Vimeo can't be textured (CORS).
const VideoScreen: React.FC<MediaProps> = ({ url, width, height, position, rotation, onClick }) => {
  const tex = useVideoTexture(url, { muted: true, loop: true, start: true, crossOrigin: 'anonymous', playsInline: true } as any);
  const video = tex.image as HTMLVideoElement;
  // The controls auto-hide a few seconds after the last interaction so they don't sit over the
  // video's subtitles; tapping the picture brings them back.
  const [show, setShow] = useState(true);
  const timer = useRef<number | undefined>(undefined);
  const reveal = () => {
    setShow(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 3500);
  };
  useEffect(() => { reveal(); return () => { if (timer.current) window.clearTimeout(timer.current); }; }, []);
  const onPic = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick?.(e); reveal(); };
  return (
    <group position={position} rotation={rotation}>
      <mesh onClick={onPic}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex as THREE.Texture} toneMapped={false} />
      </mesh>
      {show && <VideoControls video={video} width={width} height={height} onActivity={reveal} />}
    </group>
  );
};

const RotatingPremiumLcd: React.FC<{ text: string; color: string; position: [number, number, number] }> = ({ text, color, position }) => {
  const ref = useRef<THREE.Group>(null);
  const bg = useMemo(() => {
    const c = new THREE.Color(color);
    return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},.96)`;
  }, [color]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.75;
  });
  return (
    <group ref={ref} position={position}>
      <RoundedBox args={[2.45, 0.72, 0.12]} radius={0.06} smoothness={3} castShadow>
        <meshStandardMaterial color="#05070b" metalness={0.55} roughness={0.35} emissive={color} emissiveIntensity={0.25} />
      </RoundedBox>
      <CanvasLabel text={text} width={2.25} height={0.5} position={[0, 0, 0.075]} bg={bg} color="#ffffff" />
      <CanvasLabel text={text} width={2.25} height={0.5} position={[0, 0, -0.075]} rotation={[0, Math.PI, 0]} bg={bg} color="#ffffff" />
      <mesh position={[0, -0.48, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 12]} />
        <meshStandardMaterial color="#111827" metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  );
};

const ShelfStockFace: React.FC<{
  width: number;
  height: number;
  seed: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ width, height, seed, position, rotation }) => {
  const texture = useMemo(() => {
    const W = 1024;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    const colors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16'];
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < 5; row++) {
      const top = 34 + row * 92;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(42, top + 66, W - 84, 10);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(62, top + 78, W - 124, 9);
      for (let i = 0; i < 12; i++) {
        const x = 70 + i * 74;
        const h = 42 + ((i + row + seed) % 3) * 12;
        ctx.fillStyle = colors[(i + row + seed) % colors.length];
        if ((i + row + seed) % 4 === 0) {
          ctx.beginPath();
          ctx.ellipse(x + 26, top + 64 - h / 2, 22, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(x, top + 64 - h, 46, h);
        }
        ctx.fillStyle = 'rgba(255,255,255,.86)';
        ctx.fillRect(x + 8, top + 53, 30, 8);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [seed]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};

const CounterMiniatureGlb: React.FC<{ url: string; position: [number, number, number]; onGrab?: () => void }> = ({ url, position, onGrab }) => {
  const { camera } = useThree();
  const inXR = useXR((s) => !!s.session);
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);
  const [grabbed, setGrabbed] = useState(false);
  const grabbedRef = useRef(false);
  const pointerTargetReady = useRef(false);
  const home = useMemo(() => new THREE.Vector3(...position), [position]);
  const tmp = useMemo(() => ({
    camPos: new THREE.Vector3(),
    camDir: new THREE.Vector3(),
    worldTarget: new THREE.Vector3(),
    pointerWorldTarget: new THREE.Vector3(),
    localTarget: new THREE.Vector3(),
  }), []);
  const { object, scale, offset } = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // Keep controller/mouse raycasts cheap in VR: the visible GLB can contain thousands
        // of triangles, so interaction is handled by the small collider below instead.
        o.raycast = () => null;
      }
    });
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxFootprint = Math.max(size.x, size.z);
    const fitScale = Math.min(
      size.y > 0 ? 0.42 / size.y : 0.16,
      maxFootprint > 0 ? 0.34 / maxFootprint : 0.16,
    );
    return {
      object: cloned,
      scale: Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 0.16,
      offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
    };
  }, [scene]);

  const setHeld = (held: boolean) => {
    grabbedRef.current = held;
    if (!held) pointerTargetReady.current = false;
    setGrabbed(held);
  };

  const updateControllerGrabTarget = (e: ThreeEvent<PointerEvent>) => {
    if (!e.ray) return;
    // In WebXR this ray comes from the controller, not from the headset camera. Holding the
    // miniature therefore feels like it is in the visitor's hand instead of glued to gaze.
    tmp.pointerWorldTarget.copy(e.ray.origin).addScaledVector(e.ray.direction, inXR ? 0.42 : 1.05);
    tmp.pointerWorldTarget.y -= inXR ? 0.03 : 0.12;
    pointerTargetReady.current = true;
  };

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (grabbedRef.current) {
      if (inXR && pointerTargetReady.current) {
        tmp.worldTarget.copy(tmp.pointerWorldTarget);
      } else {
        camera.getWorldPosition(tmp.camPos);
        camera.getWorldDirection(tmp.camDir);
        tmp.worldTarget.copy(tmp.camPos).addScaledVector(tmp.camDir, 1.05);
        tmp.worldTarget.y -= 0.12;
      }
      tmp.localTarget.copy(tmp.worldTarget);
      g.parent?.worldToLocal(tmp.localTarget);
      g.position.lerp(tmp.localTarget, inXR ? 0.46 : 0.32);
      g.rotation.y += dt * 1.35;
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.18, 0.1);
      return;
    }
    g.position.lerp(home, 0.24);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0, 0.18);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0, 0.18);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0, 0.18);
  });

  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.008, 0]} receiveShadow>
        <cylinderGeometry args={[0.19, 0.21, 0.035, 32]} />
        <meshStandardMaterial color={grabbed ? '#1d4ed8' : '#111827'} metalness={0.35} roughness={0.45} emissive={grabbed ? '#1d4ed8' : '#000000'} emissiveIntensity={grabbed ? 0.25 : 0} />
      </mesh>
      <primitive object={object} position={[offset.x * scale, 0.035 + offset.y * scale, offset.z * scale]} scale={scale} />
      <mesh
        position={[0, 0.25, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          updateControllerGrabTarget(e);
          onGrab?.();
          setHeld(true);
        }}
        onPointerMove={(e) => {
          if (!grabbedRef.current) return;
          e.stopPropagation();
          updateControllerGrabTarget(e);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          setHeld(false);
        }}
        onPointerCancel={() => setHeld(false)}
        onLostPointerCapture={() => setHeld(false)}
        onPointerOver={() => { document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      >
        <boxGeometry args={[0.42, 0.52, 0.42]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
};

// In-world LCD screen that plays a video ON the wall, muted + looping. Direct files are painted
// as a real WebGL texture; YouTube/Vimeo are shown through an iframe transformed onto the wall
// surface (the only way to embed them in 3D — they can't be textured due to CORS).
const BoothScreen: React.FC<MediaProps> = ({ url, width, height, position, rotation, onClick }) => {
  const portal = useCanvasPortal();
  const file = isVideoFile(url);
  const v = useMemo(() => {
    if (file) return null;
    const e = screenEmbed(url);
    // YouTube ignores postMessage play commands (enablejsapi) unless the embed carries an
    // `origin` matching the host page — without it, forced autoplay in the 3D iframe stays paused.
    if (e?.kind === 'iframe' && /youtube\.com\/embed/.test(e.src) && typeof window !== 'undefined') {
      e.src += `&origin=${encodeURIComponent(window.location.origin)}`;
    }
    return e;
  }, [url, file]);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  // YouTube/Vimeo in a CSS-3D-transformed iframe often refuse to autoplay (the player thinks it's
  // "not visible"). Send the IFrame-API handshake + a play command a few times to force it.
  React.useEffect(() => {
    if (!v || v.kind !== 'iframe') return;
    const isVimeo = /vimeo\.com/.test(v.src);
    const listen = JSON.stringify({ event: 'listening', id: 1 });
    const play = isVimeo ? JSON.stringify({ method: 'play' }) : JSON.stringify({ event: 'command', func: 'playVideo', args: [] });
    let n = 0;
    const id = window.setInterval(() => {
      const w = iframeRef.current?.contentWindow;
      try { if (!isVimeo) w?.postMessage(listen, '*'); w?.postMessage(play, '*'); } catch {}
      if (++n > 12) window.clearInterval(id);
    }, 700);
    return () => window.clearInterval(id);
  }, [v]);

  const PX_W = 900, PX_H = Math.round((PX_W * height) / width);
  const scale = width / PX_W;
  return (
    <group position={position} rotation={rotation}>
      {/* Dark bezel + a faint emissive backlight so the screen reads as a real panel */}
      <RoundedBox args={[width + 0.18, height + 0.18, 0.1]} radius={0.05} smoothness={3} position={[0, 0, -0.06]} castShadow>
        <meshStandardMaterial color="#0b0e14" metalness={0.55} roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0, -0.005]} onClick={onClick}>
        <planeGeometry args={[width + 0.02, height + 0.02]} />
        <meshStandardMaterial color="#05070b" emissive={'#0a1626'} emissiveIntensity={0.6} />
      </mesh>
      {/* VR fallback glyph (the Html iframe is invisible in immersive XR); also shows under a
          still-loading texture. Sits behind the media so it's hidden once the video paints. */}
      <CanvasLabel text="▶" width={width * 0.4} height={width * 0.4} position={[0, 0, 0.004]} color="#ffffff" />

      {file ? (
        // Direct video file → genuine playback painted onto the wall, with transport controls.
        <TexBoundary key={url}>
          <Suspense fallback={null}>
            <VideoScreen url={url} width={width} height={height} position={[0, 0, 0.01]} onClick={onClick} />
          </Suspense>
        </TexBoundary>
      ) : v ? (
        // YouTube/Vimeo → iframe transformed onto the wall surface, autoplaying muted.
        <Html
          transform
          portal={portal}
          position={[0, 0, 0.02]}
          scale={scale}
          zIndexRange={[12, 0]}
          style={{ width: PX_W, height: PX_H, background: '#000', overflow: 'hidden', borderRadius: 8, boxShadow: '0 0 24px rgba(80,140,255,.25)' }}
        >
          {v.kind === 'iframe' ? (
            <iframe ref={iframeRef} src={v.src} width={PX_W} height={PX_H} frameBorder={0} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ display: 'block', border: 0 }} title="booth-screen" />
          ) : (
            <video src={v.src} width={PX_W} height={PX_H} autoPlay muted loop playsInline style={{ display: 'block', objectFit: 'cover', width: PX_W, height: PX_H }} />
          )}
        </Html>
      ) : null}
    </group>
  );
};

// One exhibition booth — a custom GLB when provided, otherwise a polished procedural stand
// (carpet + accent border, framed back wall, lit header sign, reception desk, logo/banner,
// and an optional auto-playing LCD screen).
export const Booth: React.FC<Props> = ({ booth, index, lang, onSelectHotspot, onSelectBooth, onTrack, visualStyle = 'exhibition', categoryName, categoryColor, hallDepth = 30, boothSummary, onReserveBooth, shopProducts = [], slideshowDefaultLang = 'fa', slideshowLangOptions = ['fa', 'en'] }) => {
  const accent = booth.color || '#2d4a1a';
  const name = bi(booth.name, lang, expoPhrase(lang, 'booth'));
  const num = index != null ? (lang === 'fa' ? faDigits(index + 1) : String(index + 1)) : null;
  const tier: BoothTier = booth.tier || 'basic';
  const tierSpec = {
    basic: { panel: 1, side: 1, glow: 1.4, trim: 0 },
    standard: { panel: 1.12, side: 1.12, glow: 1.9, trim: 0.12 },
    premium: { panel: 1.2, side: 1.18, glow: 2.5, trim: 0.2 },
  }[tier];
  const scale = booth.modelUrl ? 1 : (booth.scale || 1);
  const W = 4, D = 4, wallH = 3.2;          // keep the core footprint stable so layout/buttons don't shift
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);
  const accentDark = useMemo(() => new THREE.Color(accent).multiplyScalar(0.6), [accent]);
  const enterShop = expoPhrase(lang, 'enterShop');
  const reserveBooth = expoPhrase(lang, 'reserveBooth');
  const reservedPending = expoPhrase(lang, 'reservedPending');
  const reservedConfirmed = expoPhrase(lang, 'reservedConfirmed');
  const showReservationBadge = boothSummary && boothSummary.status !== 'available';
  const reservationBadgeText = showReservationBadge
    ? (boothSummary!.status === 'confirmed' && boothSummary!.confirmed
      ? `${reservedConfirmed} · ${boothSummary!.confirmed.company}`
      : boothSummary!.pendingCount > 1
        ? `${reservedPending} (${boothSummary!.pendingCount})`
        : reservedPending)
    : '';
  const canReserve = onReserveBooth && boothIsReservable(boothSummary);
  const storefront = visualStyle === 'storefront' || visualStyle === 'supermarket' || visualStyle === 'business_center';
  const signText = bi(booth.storefrontSignText, lang, name);
  const glassText = bi(booth.storefrontGlassText, lang, expoPhrase(lang, 'glassDefault'));
  const premiumSignText = bi(booth.premiumSignText, lang, name);
  const premiumSignColor = booth.premiumSignColor || accent;

  const entranceFacingYaw = useMemo(() => (
    booth.entranceFacing
      ? boothEntranceFacingYaw(booth.ry || 0, booth.entranceFacing)
      : 0
  ), [booth.entranceFacing, booth.ry]);

  // Media for each of the 6 wall faces
  // screenUrl / bannerImage so older booths keep working.
  const P = booth.panels || {};
  const panelUrl = (face: BoothFace): string | undefined =>
    P[face] || (face === 'innerBack' ? (booth.screenUrl || booth.bannerImage) : undefined);
  const backW = Math.min(W * 0.9, W * 0.78 * tierSpec.panel);
  const backH = backW * 9 / 16;
  const sideW = Math.min(D * 0.62, 1.9 * tierSpec.side);
  const sideH = 1.15 * tierSpec.side;
  const backY = Math.min(wallH - backH / 2 - 0.35, 1.62 + tierSpec.trim * 1.4);
  const sideY = Math.min(wallH - sideH / 2 - 0.35, 1.45 + tierSpec.trim);
  const PANEL_SPECS: { face: BoothFace; position: [number, number, number]; rotation: [number, number, number]; w: number; h: number }[] = [
    { face: 'innerBack',  position: [0, backY, -D / 2 + 0.09], rotation: [0, 0, 0],             w: backW, h: backH },
    { face: 'outerBack',  position: [0, backY, -D / 2 - 0.09], rotation: [0, Math.PI, 0],       w: backW, h: backH },
    { face: 'innerLeft',  position: [-W / 2 + 0.09, sideY, -D / 6], rotation: [0, Math.PI / 2, 0],  w: sideW, h: sideH },
    { face: 'outerLeft',  position: [-W / 2 - 0.09, sideY, -D / 6], rotation: [0, -Math.PI / 2, 0], w: sideW, h: sideH },
    { face: 'innerRight', position: [W / 2 - 0.09, sideY, -D / 6], rotation: [0, -Math.PI / 2, 0],  w: sideW, h: sideH },
    { face: 'outerRight', position: [W / 2 + 0.09, sideY, -D / 6], rotation: [0, Math.PI / 2, 0],   w: sideW, h: sideH },
  ];
  const slideshowProductsByFace = useMemo(() => {
    const out = new Map<BoothFace, MetaShopProduct[]>();
    for (const s of PANEL_SPECS) {
      const cfg = booth.productSlideshows?.[s.face];
      if (cfg?.enabled) out.set(s.face, resolveSlideshowProducts(shopProducts, cfg));
    }
    return out;
  }, [booth.productSlideshows, shopProducts]);
  const managerSlots = [0, 1, 2, 3, 4];
  const managerPngs = managerSlots.map(i => booth.managerPngs?.[i] || '');
  const managerVisible = managerSlots.map(i => booth.managerEnabled?.[i] !== false);
  const managerNames = managerSlots.map(i => bi(booth.managerNames?.[i], lang, ''));
  const legacyWhatsapps = (booth as any).managerWhatsapps as string[] | undefined;
  const managerLinks = managerSlots.map(i => booth.managerLinks?.[i] || legacyWhatsapps?.[i] || '');
  const managerAudios = managerSlots.map(i => (
    (lang === 'fa' || lang === 'ar')
      ? (booth.managerAudiosFa?.[i] || booth.managerAudios?.[i] || booth.managerAudiosEn?.[i] || '')
      : (booth.managerAudiosEn?.[i] || booth.managerAudios?.[i] || booth.managerAudiosFa?.[i] || '')
  ));
  const managerAudioRefs = useRef<(HTMLAudioElement | null)[]>([null, null, null, null, null]);
  const activeManagers = managerSlots
    .filter(i => managerPngs[i] && managerVisible[i])
    .map((slot, order, arr) => {
      const spacing = arr.length <= 2 ? 1.55 : arr.length === 3 ? 1.05 : arr.length === 4 ? 0.82 : 0.68;
      return { slot, x: (order - (arr.length - 1) / 2) * spacing };
    });
  const counterGlbs = managerSlots.map(i => booth.counterGlbs?.[i] || '');
  const counterGlbXs = [-0.82, -0.41, 0, 0.41, 0.82];
  const trackBase = { boothId: booth.id, boothName: name, boothIndex: index };
  const trackBoothSelect = (side: string) => {
    onTrack?.('booth_click', { ...trackBase, targetType: 'shop_entry', side });
    onSelectBooth(booth);
  };
  const trackManager = (i: number, targetType: string) => onTrack?.('booth_character_click', {
    ...trackBase,
    targetId: `${booth.id}-manager-${i + 1}`,
    targetName: managerNames[i] || `Manager ${i + 1}`,
    targetType,
    side: 'counter',
  });
  useEffect(() => () => {
    managerAudioRefs.current.forEach(a => { if (a) { a.pause(); a.src = ''; } });
  }, []);
  const openManagerLink = (raw?: string) => {
    const v = (raw || '').trim();
    if (!v) return;
    const href = /^https?:\/\//i.test(v) ? v : /^\+?\d[\d\s-]+$/.test(v) ? `https://wa.me/${v.replace(/[^\d]/g, '')}` : `https://${v}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };
  const waCaption = bi(booth.meetTitle, lang, lang === 'fa' || lang === 'ar' ? 'واتساپ' : 'WhatsApp');
  const openBoothWhatsApp = () => {
    if (!booth.meetUrl) return;
    onTrack?.('hotspot_click', { ...trackBase, targetType: 'whatsapp', targetName: waCaption, side: 'booth_whatsapp' });
    openManagerLink(booth.meetUrl);
  };
  const whatsappBadgeEl = (bw: number, bd: number, opts?: { y?: number; frontZ?: number }) => booth.meetEnabled && booth.meetUrl ? (
    <BoothMeetBadge
      side={booth.meetSide || 'left'}
      boothW={bw}
      boothD={bd}
      y={opts?.y}
      frontZ={opts?.frontZ}
      label={waCaption || undefined}
      onClick={openBoothWhatsApp}
    />
  ) : null;
  const toggleManagerAudio = (index: number, raw?: string) => {
    const url = (raw || '').trim();
    if (!url) return;
    managerAudioRefs.current.forEach((a, i) => { if (a && i !== index) a.pause(); });
    let audio = managerAudioRefs.current[index];
    if (!audio || audio.src !== url) {
      audio?.pause();
      audio = new Audio(url);
      managerAudioRefs.current[index] = audio;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };
  const seekManagerAudio = (index: number, raw: string | undefined, delta: number) => {
    const url = (raw || '').trim();
    if (!url) return;
    let audio = managerAudioRefs.current[index];
    if (!audio || audio.src !== url) {
      audio?.pause();
      audio = new Audio(url);
      managerAudioRefs.current[index] = audio;
    }
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number.POSITIVE_INFINITY;
    audio.currentTime = Math.min(max, Math.max(0, audio.currentTime + delta));
  };

  if (visualStyle === 'supermarket') {
    const shelfW = 5.2;
    const shelfD = 1.38;
    const shelfH = 2.35;
    const productColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16'];
    const categoryLabel = categoryName || expoPhrase(lang, 'department');
    const shopAction = expoPhrase(lang, 'brandProducts');
    const brandMark = (name || 'B').trim().slice(0, 2);
    const signColor = categoryColor || accent;
    return (
      <group position={[booth.x || 0, booth.y || 0, booth.z || 0]} rotation={[0, booth.ry || 0, 0]} scale={scale}>
        <group rotation={[0, entranceFacingYaw, 0]}>
        <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[shelfW + 1.1, shelfD + 1.45]} />
          <meshStandardMaterial color={categoryColor || accent} transparent opacity={0.13} roughness={0.82} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>

        {/* Double-sided supermarket gondola shelf with end caps, price rails and stocked rows. */}
        <RoundedBox args={[shelfW, shelfH, 0.22]} radius={0.055} smoothness={3} position={[0, shelfH / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#e5e7eb" roughness={0.46} metalness={0.12} />
        </RoundedBox>
        <RoundedBox args={[shelfW + 0.18, 0.18, shelfD + 0.12]} radius={0.045} smoothness={3} position={[0, 0.12, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#64748b" roughness={0.42} metalness={0.18} />
        </RoundedBox>
        <ShelfStockFace width={shelfW * 0.92} height={shelfH * 0.78} seed={index ?? 0} position={[0, shelfH * 0.5, -shelfD / 2 - 0.035]} rotation={[0, Math.PI, 0]} />
        <ShelfStockFace width={shelfW * 0.92} height={shelfH * 0.78} seed={(index ?? 0) + 3} position={[0, shelfH * 0.5, shelfD / 2 + 0.035]} />
        {[-1, 1].map(x => (
          <group key={x} position={[x * (shelfW / 2 + 0.16), 0, 0]}>
            <RoundedBox args={[0.36, shelfH * 0.88, shelfD + 0.22]} radius={0.055} smoothness={3} position={[0, shelfH * 0.45, 0]} castShadow>
              <meshStandardMaterial color="#f8fafc" roughness={0.48} metalness={0.08} />
            </RoundedBox>
            {[0.56, 1.02, 1.48].map((y, row) => (
              <mesh key={row} position={[0, y, 0]}>
                <boxGeometry args={[0.28, 0.24, shelfD * 0.72]} />
                <meshStandardMaterial color={productColors[(row + (index ?? 0)) % productColors.length]} roughness={0.5} />
              </mesh>
            ))}
          </group>
        ))}

        <mesh position={[0, shelfH + 0.12, 0]}>
          <boxGeometry args={[shelfW + 0.36, 0.16, shelfD + 0.24]} />
          <meshStandardMaterial color={signColor} emissive={signColor} emissiveIntensity={0.25} toneMapped={false} />
        </mesh>

        <CanvasLabel
          text={name}
          width={shelfW * 0.68}
          height={0.3}
          position={[0, shelfH + 0.16, -shelfD / 2 - 0.21]}
          rotation={[0, Math.PI, 0]}
          bg="rgba(15,23,42,.9)"
          color="#ffffff"
          onClick={(e) => { e.stopPropagation(); trackBoothSelect('supermarket_shelf_sign'); }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        />
        <CanvasLabel
          text={name}
          width={shelfW * 0.68}
          height={0.3}
          position={[0, shelfH + 0.16, shelfD / 2 + 0.21]}
          bg="rgba(15,23,42,.9)"
          color="#ffffff"
          onClick={(e) => { e.stopPropagation(); trackBoothSelect('supermarket_shelf_sign_back'); }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        />
        {booth.logo && (
          <>
            <mesh position={[-shelfW / 2 + 0.42, shelfH + 0.14, -shelfD / 2 - 0.215]} rotation={[0, Math.PI, 0]}>
              <circleGeometry args={[0.34, 32]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
            <SafeImage url={booth.logo} width={0.48} height={0.48} position={[-shelfW / 2 + 0.42, shelfH + 0.14, -shelfD / 2 - 0.23]} rotation={[0, Math.PI, 0]} />
            <mesh position={[shelfW / 2 - 0.42, shelfH + 0.14, shelfD / 2 + 0.215]}>
              <circleGeometry args={[0.34, 32]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
            <SafeImage url={booth.logo} width={0.48} height={0.48} position={[shelfW / 2 - 0.42, shelfH + 0.14, shelfD / 2 + 0.23]} />
          </>
        )}
        {!booth.logo && (
          <>
            <CanvasLabel text={brandMark} width={0.62} height={0.46} position={[-shelfW / 2 + 0.42, shelfH + 0.14, -shelfD / 2 - 0.23]} rotation={[0, Math.PI, 0]} bg="rgba(255,255,255,.96)" color={categoryColor || accent} />
            <CanvasLabel text={brandMark} width={0.62} height={0.46} position={[shelfW / 2 - 0.42, shelfH + 0.14, shelfD / 2 + 0.23]} bg="rgba(255,255,255,.96)" color={categoryColor || accent} />
          </>
        )}
        {booth.shopSlug && (
          [-1, 1].map(side => (
            <group key={side} position={[0, 0.16, side * (shelfD / 2 + 0.42)]}>
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={(e) => { e.stopPropagation(); trackBoothSelect(side < 0 ? 'supermarket_shelf_front' : 'supermarket_shelf_back'); }}
                onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { document.body.style.cursor = 'auto'; }}
              >
                <planeGeometry args={[2.35, 0.54]} />
                <meshStandardMaterial color="#ffffff" emissive={categoryColor || accent} emissiveIntensity={0.2} roughness={0.42} />
              </mesh>
              <CanvasLabel text={shopAction} width={2.02} height={0.28} position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]} bg="rgba(255,255,255,.94)" color="#0f172a" onClick={(e) => { e.stopPropagation(); trackBoothSelect(side < 0 ? 'supermarket_shelf_front' : 'supermarket_shelf_back'); }} />
            </group>
          ))
        )}

        {(booth.hotspots || []).map(h => (
          <Hotspot
            key={h.id}
            hotspot={h}
            lang={lang}
            onSelect={(hotspot) => {
              onTrack?.('hotspot_click', {
                ...trackBase,
                targetId: hotspot.id,
                targetName: bi(hotspot.title, lang, ''),
                targetType: hotspot.type,
                side: 'shelf_hotspot',
                x: hotspot.x,
                z: hotspot.z,
              });
              onSelectHotspot(hotspot);
            }}
          />
        ))}
        {whatsappBadgeEl(shelfW, shelfD, { y: shelfH * 0.46, frontZ: shelfD / 2 + 0.28 })}
        </group>
      </group>
    );
  }

  return (
    <group position={[booth.x || 0, booth.y || 0, booth.z || 0]} rotation={[0, booth.ry || 0, 0]} scale={scale}>
      <group rotation={[0, entranceFacingYaw, 0]}>
      {booth.modelUrl ? (
        <group rotation={[0, booth.modelRy || 0, 0]}>
          <TexBoundary key={booth.modelUrl}>
            <Suspense fallback={null}>
              <GltfModel url={booth.modelUrl} scale={booth.modelScale ?? 1} autoFit={4} />
            </Suspense>
          </TexBoundary>
        </group>
      ) : (
        <group>
          {/* Carpet base + accent inlay */}
          <mesh position={[0, 0.02, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W, D]} />
            <meshStandardMaterial color="#eceef2" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W * 0.86, D * 0.86]} />
            <meshStandardMaterial color={accentColor} roughness={0.8} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W * 0.74, D * 0.74]} />
            <meshStandardMaterial color={tier === 'premium' ? '#fff7ed' : '#f7f8fa'} roughness={0.9} />
          </mesh>
          {tier === 'premium' && (
            <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[W * 0.34, W * 0.39, 80]} />
              <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.45} toneMapped={false} />
            </mesh>
          )}

          {/* Back wall (framed) */}
          <mesh position={[0, wallH / 2, -D / 2]} castShadow receiveShadow>
            <boxGeometry args={[W, wallH, 0.12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.85} />
          </mesh>
          {/* Accent baseboard + top trim on the back wall */}
          <mesh position={[0, 0.12, -D / 2 + 0.07]}>
            <boxGeometry args={[W, 0.16, 0.04]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          {tier !== 'basic' && (
            <mesh position={[0, wallH / 2, -D / 2 + 0.065]}>
              <planeGeometry args={[W * 0.96, wallH * 0.9]} />
              <meshStandardMaterial color={tier === 'premium' ? '#fff7ed' : '#f8fafc'} emissive={accentColor} emissiveIntensity={tier === 'premium' ? 0.16 : 0.06} roughness={0.7} />
            </mesh>
          )}

          {/* Side half-walls */}
          <mesh position={[-W / 2, wallH / 2.6, -D / 6]} castShadow receiveShadow>
            <boxGeometry args={[0.12, wallH / 1.3, D * 0.66]} />
            <meshStandardMaterial color="#eef0f3" roughness={0.85} />
          </mesh>
          <mesh position={[W / 2, wallH / 2.6, -D / 6]} castShadow receiveShadow>
            <boxGeometry args={[0.12, wallH / 1.3, D * 0.66]} />
            <meshStandardMaterial color="#eef0f3" roughness={0.85} />
          </mesh>
          {tier !== 'basic' && (
            <>
              <RoundedBox args={[0.18, wallH * 0.78, 0.18]} radius={0.04} smoothness={3} position={[-W / 2 + 0.12, wallH * 0.39, D / 2 - 0.32]} castShadow>
                <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={tier === 'premium' ? 0.55 : 0.25} metalness={0.2} roughness={0.45} />
              </RoundedBox>
              <RoundedBox args={[0.18, wallH * 0.78, 0.18]} radius={0.04} smoothness={3} position={[W / 2 - 0.12, wallH * 0.39, D / 2 - 0.32]} castShadow>
                <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={tier === 'premium' ? 0.55 : 0.25} metalness={0.2} roughness={0.45} />
              </RoundedBox>
            </>
          )}
          {tier === 'premium' && (
            <>
              <RoundedBox args={[W + 0.45, 0.16, D * 0.92]} radius={0.08} smoothness={3} position={[0, wallH + 0.42, -D / 6]} castShadow>
                <meshStandardMaterial color="#111827" emissive={accentColor} emissiveIntensity={0.35} metalness={0.55} roughness={0.35} />
              </RoundedBox>
              <mesh position={[0, wallH + 0.33, D / 2 - 0.55]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[W * 0.9, 0.16]} />
                <meshStandardMaterial color="#ffffff" emissive="#fbbf24" emissiveIntensity={1.3} toneMapped={false} />
              </mesh>
            </>
          )}

          {/* Lit header sign across the top */}
          <RoundedBox args={[W + 0.1 + tierSpec.trim * 2, 0.56 + tierSpec.trim, 0.18 + tierSpec.trim * 0.4]} radius={0.07} smoothness={3} position={[0, wallH + 0.12, -D / 2 + 0.06]} castShadow>
            <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={tier === 'premium' ? 0.35 : 0.08} metalness={tier === 'premium' ? 0.4 : 0.2} roughness={0.5} />
          </RoundedBox>
          {/* Emissive light strip under the header (booth glow) */}
          <mesh position={[0, wallH - 0.12, -D / 2 + 0.14]}>
            <boxGeometry args={[W * 0.92, 0.06, 0.04]} />
            <meshStandardMaterial color={'#ffffff'} emissive={accentColor} emissiveIntensity={tierSpec.glow} toneMapped={false} />
          </mesh>
          {tier === 'premium' && (
            <mesh position={[0, wallH + 0.52, -D / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[W * 0.38, 0.025, 8, 80]} />
              <meshStandardMaterial color="#f8fafc" emissive={accentColor} emissiveIntensity={0.8} toneMapped={false} />
            </mesh>
          )}
          {tier === 'premium' && (
            <RotatingPremiumLcd text={premiumSignText} color={premiumSignColor} position={[0, wallH + 0.9, D / 2 - 0.75]} />
          )}

          {/* Reception desk / podium */}
          <RoundedBox args={[W * 0.52, 0.95, 0.6]} radius={0.05} smoothness={3} position={[0, 0.48, D / 2 - 0.5]} castShadow receiveShadow>
            <meshStandardMaterial color={accentDark} metalness={0.15} roughness={0.55} />
          </RoundedBox>
          <mesh position={[0, 0.98, D / 2 - 0.5]} castShadow>
            <boxGeometry args={[W * 0.54, 0.06, 0.66]} />
            <meshStandardMaterial color="#e8eaed" metalness={0.3} roughness={0.4} />
          </mesh>

          {storefront && (
            <group>
              {/* Glass storefront facade: side panes + central clickable door. */}
              <RoundedBox args={[W + 0.18, 0.72, 0.2]} radius={0.08} smoothness={3} position={[0, wallH + 0.54, D / 2 - 0.16]} castShadow>
                <meshStandardMaterial color="#111827" emissive={accentColor} emissiveIntensity={0.22} metalness={0.48} roughness={0.32} />
              </RoundedBox>
              <CanvasLabel text={signText} width={W * 0.92} height={0.48} position={[0, wallH + 0.54, D / 2 - 0.045]} bg="rgba(15,23,42,.92)" color="#ffffff" onClick={(e) => { e.stopPropagation(); trackBoothSelect('storefront_sign'); }} />
              {[-1, 1].map(side => (
                <mesh key={side} position={[side * 1.28, 1.72, D / 2 - 0.08]} onClick={(e) => { e.stopPropagation(); trackBoothSelect('glass'); }}>
                  <planeGeometry args={[1.18, 2.34]} />
                  <meshStandardMaterial color="#bff3ff" transparent opacity={0.28} roughness={0.05} metalness={0.12} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
              ))}
              <mesh
                position={[0, 1.58, D / 2 - 0.06]}
                onClick={(e) => { e.stopPropagation(); trackBoothSelect('glass_door'); }}
                onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { document.body.style.cursor = 'auto'; }}
              >
                <planeGeometry args={[1.12, 2.1]} />
                <meshStandardMaterial color="#e0fbff" transparent opacity={0.34} roughness={0.03} metalness={0.18} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
              <mesh position={[0, 0.56, D / 2 - 0.035]}>
                <boxGeometry args={[0.045, 1.76, 0.025]} />
                <meshStandardMaterial color="#f8fafc" emissive="#dbeafe" emissiveIntensity={0.3} toneMapped={false} />
              </mesh>
              <mesh position={[0.42, 1.45, D / 2 - 0.02]}>
                <sphereGeometry args={[0.045, 16, 8]} />
                <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.8} toneMapped={false} />
              </mesh>
              <CanvasLabel text={glassText} width={2.45} height={0.34} position={[0, 2.06, D / 2 - 0.01]} bg="rgba(255,255,255,.72)" color="#0f172a" onClick={(e) => { e.stopPropagation(); trackBoothSelect('glass_text'); }} />
              {visualStyle === 'supermarket' && categoryName && (
                <CanvasLabel text={categoryName} width={2.25} height={0.28} position={[0, 2.48, D / 2 - 0.005]} bg={categoryColor || 'rgba(22,163,74,.9)'} color="#ffffff" />
              )}
            </group>
          )}
        </group>
      )}

      {/* Configurable overlays — panels, shop entry, logo, managers, hotspots (procedural & GLB). */}
      {PANEL_SPECS.map(s => {
        const slideshow = booth.productSlideshows?.[s.face];
        if (slideshow?.enabled) {
          const slides = slideshowProductsByFace.get(s.face) || [];
          return (
            <ProductSlideshowPanel
              key={`ss-${s.face}`}
              products={slides}
              width={s.w}
              height={s.h}
              position={s.position}
              rotation={s.rotation}
              autoPlaySec={slideshow.autoPlaySec ?? 5}
              defaultLang={slideshowDefaultLang}
              langOptions={slideshowLangOptions}
              onClick={(e) => {
                e.stopPropagation();
                onTrack?.('booth_panel_click', { ...trackBase, targetType: 'product_slideshow', targetId: s.face, side: s.face });
              }}
            />
          );
        }
        const u = panelUrl(s.face);
        return u ? (
          <PanelMedia
            key={s.face}
            url={u}
            width={s.w}
            height={s.h}
            position={s.position}
            rotation={s.rotation}
            onClick={(e) => {
              e.stopPropagation();
              onTrack?.('booth_panel_click', { ...trackBase, targetType: 'booth_panel', targetId: s.face, side: s.face });
            }}
          />
        ) : null;
      })}

      {booth.logo && (
        <group position={[0, 1.5, D / 2 - 0.46]}>
          <Billboard>
            <SafeImage url={booth.logo} width={0.8} height={0.8} position={[0, 0, 0]} />
          </Billboard>
        </group>
      )}

      {booth.shopSlug && (
        <group position={[0, 0.62, D / 2 - 0.12]}>
          <mesh onClick={(e) => { e.stopPropagation(); trackBoothSelect('counter'); }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
            <planeGeometry args={[1.74, 0.42]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          <CanvasLabel text={`🛍 ${enterShop}`} width={1.66} height={0.36} position={[0, 0, 0.01]} color="#ffffff"
            onClick={(e) => { e.stopPropagation(); trackBoothSelect('counter'); }} />
        </group>
      )}

      {showReservationBadge ? (
        <group position={[0, canReserve ? 0.52 : 0.38, D / 2 + 0.06]}>
          <CanvasLabel
            text={reservationBadgeText}
            width={boothSummary!.status === 'confirmed' ? 1.55 : 1.2}
            height={0.22}
            bg={boothSummary!.status === 'confirmed' ? 'rgba(220,38,38,.88)' : 'rgba(234,179,8,.88)'}
            color="#ffffff"
            bold={false}
          />
        </group>
      ) : null}
      {canReserve ? (
        <group position={[0, 0.38, D / 2 + 0.06]}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onTrack?.('booth_reserve_click', { ...trackBase, targetType: 'booth_reserve', side: 'booth_reserve' });
              onReserveBooth(booth);
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            <planeGeometry args={[0.92, 0.22]} />
            <meshBasicMaterial color="#b45309" transparent opacity={0.92} toneMapped={false} depthWrite={false} />
          </mesh>
          <CanvasLabel
            text={reserveBooth}
            width={0.86}
            height={0.18}
            position={[0, 0, 0.01]}
            color="#ffffff"
            bold={false}
            onClick={(e) => {
              e.stopPropagation();
              onTrack?.('booth_reserve_click', { ...trackBase, targetType: 'booth_reserve', side: 'booth_reserve' });
              onReserveBooth(booth);
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          />
        </group>
      ) : null}

      <CanvasLabel
        text={num ? `${num} · ${name}` : name}
        width={W * 0.92}
        height={0.42}
        position={[0, wallH + 0.12, -D / 2 + 0.17]}
        color="#ffffff"
        onClick={(e) => { e.stopPropagation(); trackBoothSelect('header'); }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      />

      {counterGlbs.map((url, i) => url ? (
        <TexBoundary key={`shared-counter-glb-${url}-${i}`}>
          <Suspense fallback={null}>
            <CounterMiniatureGlb
              url={url}
              position={[counterGlbXs[i], 1.02, D / 2 - 0.5]}
              onGrab={() => onTrack?.('counter_glb_grab', {
                ...trackBase,
                targetId: `${booth.id}-counter-glb-${i + 1}`,
                targetName: `Counter GLB ${i + 1}`,
                targetType: 'counter_glb',
                side: 'counter',
              })}
            />
          </Suspense>
        </TexBoundary>
      ) : null)}

      {whatsappBadgeEl(W, D)}

      {/* Life-size PNG people behind the reception counter. */}
      {activeManagers.map(({ slot: i, x }) => (
        <group key={`${managerPngs[i]}-${i}`} position={[x, 1.05, D / 2 - 0.88]}>
          <Billboard>
            <SafeImage
              url={managerPngs[i]}
              width={1.12}
              height={2.1}
              position={[0, 0, 0]}
              onClick={(managerAudios[i] || managerLinks[i]) ? (e) => {
                e.stopPropagation();
                trackManager(i, managerAudios[i] ? 'manager_audio' : 'manager_link');
                if (managerAudios[i]) toggleManagerAudio(i, managerAudios[i]);
                else openManagerLink(managerLinks[i]);
              } : undefined}
            />
          </Billboard>
        </group>
      ))}
      {activeManagers.map(({ slot: i, x }) => managerNames[i] ? (
        <CanvasLabel
          key={`name-${managerPngs[i]}-${i}`}
          text={managerNames[i]}
          width={0.68}
          height={0.22}
          position={[x, 2.5, D / 2 - 0.86]}
          bg="rgba(15,23,42,.82)"
          color="#ffffff"
        />
      ) : null)}
      {activeManagers.map(({ slot: i, x }) => managerAudios[i] ? (
        <group key={`audio-${managerPngs[i]}-${i}`} position={[x, 2.26, D / 2 - 0.86]}>
          <group position={[-0.3, 0, 0]}>
            <mesh
              onClick={(e) => { e.stopPropagation(); trackManager(i, 'manager_audio_seek'); seekManagerAudio(i, managerAudios[i], -5); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <circleGeometry args={[0.13, 24]} />
              <meshBasicMaterial color="#0f172a" transparent opacity={0.76} toneMapped={false} />
            </mesh>
            <CanvasLabel text="-5" width={0.2} height={0.16} position={[0, 0, 0.01]} color="#ffffff" onClick={(e) => { e.stopPropagation(); trackManager(i, 'manager_audio_seek'); seekManagerAudio(i, managerAudios[i], -5); }} />
          </group>
          <mesh
            onClick={(e) => { e.stopPropagation(); trackManager(i, 'manager_audio'); toggleManagerAudio(i, managerAudios[i]); }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            <circleGeometry args={[0.17, 32]} />
            <meshBasicMaterial color="#0f172a" transparent opacity={0.86} toneMapped={false} />
          </mesh>
          <CanvasLabel text="♪" width={0.24} height={0.24} position={[0, 0, 0.01]} color="#ffffff" onClick={(e) => { e.stopPropagation(); trackManager(i, 'manager_audio'); toggleManagerAudio(i, managerAudios[i]); }} />
          <group position={[0.3, 0, 0]}>
            <mesh
              onClick={(e) => { e.stopPropagation(); trackManager(i, 'manager_audio_seek'); seekManagerAudio(i, managerAudios[i], 5); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <circleGeometry args={[0.13, 24]} />
              <meshBasicMaterial color="#0f172a" transparent opacity={0.76} toneMapped={false} />
            </mesh>
            <CanvasLabel text="+5" width={0.2} height={0.16} position={[0, 0, 0.01]} color="#ffffff" onClick={(e) => { e.stopPropagation(); trackManager(i, 'manager_audio_seek'); seekManagerAudio(i, managerAudios[i], 5); }} />
          </group>
        </group>
      ) : null)}

      {/* Interactive hotspots (positions are local offsets from the booth origin) */}
      {(booth.hotspots || []).map(h => (
        <Hotspot
          key={h.id}
          hotspot={h}
          lang={lang}
          onSelect={(hotspot) => {
            onTrack?.('hotspot_click', {
              ...trackBase,
              targetId: hotspot.id,
              targetName: bi(hotspot.title, lang, ''),
              targetType: hotspot.type,
              side: 'hotspot',
              x: hotspot.x,
              z: hotspot.z,
            });
            onSelectHotspot(hotspot);
          }}
        />
      ))}
      </group>
    </group>
  );
};
