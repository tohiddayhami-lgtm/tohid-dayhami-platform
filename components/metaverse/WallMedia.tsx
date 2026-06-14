import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, useVideoTexture } from '@react-three/drei';
import * as THREE from 'three';
import { TexBoundary } from './Booth';
import { CanvasLabel } from './CanvasLabel';
import { isGif, isPdfFile, isVideoFile } from './expoUtils';
// Static asset URL for the pdf.js worker (Vite emits it); pdf.js core is loaded on demand below.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const openNewTab = (url?: string) => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); };

// ── Environmental wall advertisement ──────────────────────────────────────
const AdImage: React.FC<{ url: string; w: number; h: number; onClick?: () => void }> = ({ url, w, h, onClick }) => {
  const tex = useTexture(url);
  return (
    <mesh position={[0, 0, 0.04]} onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { if (onClick) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex as THREE.Texture} transparent toneMapped={false} />
    </mesh>
  );
};

const AdVideo: React.FC<{ url: string; w: number; h: number; onClick?: () => void }> = ({ url, w, h, onClick }) => {
  const tex = useVideoTexture(url, { muted: true, loop: true, start: true, crossOrigin: 'anonymous', playsInline: true } as any);
  return (
    <mesh position={[0, 0, 0.04]} onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { if (onClick) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex as THREE.Texture} toneMapped={false} />
    </mesh>
  );
};

const AdGif: React.FC<{ url: string; w: number; h: number; onClick?: () => void }> = ({ url, w, h, onClick }) => {
  const state = useState(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const o = { img, canvas, tex, ready: false };
    img.onload = () => { canvas.width = img.naturalWidth || 256; canvas.height = img.naturalHeight || 256; o.ready = true; };
    img.src = url;
    return o;
  })[0];
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (!state.ready) return;
    acc.current += dt;
    if (acc.current < 1 / 15) return;
    acc.current = 0;
    const ctx = state.canvas.getContext('2d');
    if (ctx) { ctx.drawImage(state.img, 0, 0, state.canvas.width, state.canvas.height); state.tex.needsUpdate = true; }
  });
  useEffect(() => () => state.tex.dispose(), [state]);
  return (
    <mesh position={[0, 0, 0.04]} onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { if (onClick) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={state.tex} transparent toneMapped={false} />
    </mesh>
  );
};

export const WallAd: React.FC<{
  url?: string; image?: string; title?: string; w: number; h: number;
  position: [number, number, number]; rotation: [number, number, number];
  onAdClick?: () => void;
}> = ({ url, image, title, w, h, position, rotation, onAdClick }) => {
  const media = image;
  const click = () => { onAdClick?.(); openNewTab(url); };
  return (
    <group position={position} rotation={rotation}>
      {/* frame border + light board (so a not-yet-loaded/blocked image shows as a blank board, not black) */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[w + 0.14, h + 0.14]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 0, 0.01]} onClick={(e) => { e.stopPropagation(); click(); }}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      {/* caption fallback (covered by media once it loads) */}
      <CanvasLabel text={title || (url ? 'بنر تبلیغاتی' : 'تبلیغات')} width={w * 0.85} height={Math.min(h * 0.4, 0.7)} position={[0, 0, 0.02]} color="#334155" onClick={click} />
      {media && (
        <TexBoundary key={media}>
          <Suspense fallback={null}>
            {isPdfFile(media) ? (
              <PresentationScreen url={media} w={w} h={h} position={[0, 0, 0.06]} rotation={[0, 0, 0]} />
            ) : isVideoFile(media) ? (
              <AdVideo url={media} w={w} h={h} onClick={click} />
            ) : isGif(media) ? (
              <AdGif url={media} w={w} h={h} onClick={click} />
            ) : (
              <AdImage url={media} w={w} h={h} onClick={click} />
            )}
          </Suspense>
        </TexBoundary>
      )}
      {/* tiny "link" hint when clickable */}
      {url && <CanvasLabel text="🔗" width={0.3} height={0.3} position={[w / 2 - 0.2, -h / 2 + 0.2, 0.08]} color="#1f6f43" onClick={click} />}
    </group>
  );
};

// ── Page-turnable PDF presentation ─────────────────────────────────────────
let pdfjsPromise: Promise<any> | null = null;
const getPdfjs = () => {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist').then(m => { m.GlobalWorkerOptions.workerSrc = pdfWorkerUrl; return m; });
  return pdfjsPromise;
};

const ArrowBtn: React.FC<{ x: number; glyph: string; onClick: () => void; color: string }> = ({ x, glyph, onClick, color }) => (
  <group position={[x, 0, 0]}>
    <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <planeGeometry args={[0.7, 0.55]} />
      <meshStandardMaterial color={color} />
    </mesh>
    <CanvasLabel text={glyph} width={0.6} height={0.5} position={[0, 0, 0.01]} color="#fff" onClick={onClick} />
  </group>
);

export const PresentationScreen: React.FC<{
  url: string; w: number; h: number; accent?: string;
  position: [number, number, number]; rotation: [number, number, number];
}> = ({ url, w, h, accent = '#1f6f43', position, rotation }) => {
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 }); // rendered page pixel size (for aspect)
  const [cachedCount, setCachedCount] = useState(0); // how many pages have been pre-rendered
  const docRef = useRef<any>(null);
  const bitmapsRef = useRef<(ImageBitmap | null)[]>([]); // pre-rendered page bitmaps (1-based)
  // ONE stable texture reused for every page — we redraw its canvas and flag needsUpdate so the
  // GPU re-uploads it. Swapping in a fresh texture object failed to update inside a WebXR session.
  const [tex] = useState(() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

  // Load + PRE-RENDER every page to an ImageBitmap up front. pdf.js rasterization needs
  // window.requestAnimationFrame, which is PAUSED inside an immersive WebXR session — so rendering
  // a page *during* VR stalls (the number changed but the slide stayed on page 1). By rasterizing
  // all pages here (on load, before VR), later flips only blit a cached bitmap, which works in VR.
  useEffect(() => {
    let cancelled = false;
    setCount(0); setPage(1); setDims({ w: 0, h: 0 }); setCachedCount(0);
    bitmapsRef.current.forEach(b => b?.close?.()); bitmapsRef.current = [];
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        docRef.current = doc; setCount(doc.numPages);
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const pg = await doc.getPage(i);
          const base = pg.getViewport({ scale: 1 });
          const vp = pg.getViewport({ scale: 1300 / base.width });
          const c = document.createElement('canvas');
          c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
          const ctx = c.getContext('2d')!;
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          if (cancelled) return;
          bitmapsRef.current[i] = await createImageBitmap(c);
          setCachedCount(i);
        }
      } catch { /* leave blank — handled by the placeholder */ }
    })();
    return () => { cancelled = true; docRef.current = null; bitmapsRef.current.forEach(b => b?.close?.()); bitmapsRef.current = []; };
  }, [url]);

  // Blit the cached bitmap for the current page onto the texture — plain canvas2D, works in VR.
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

  const prev = () => setPage(p => Math.max(1, p - 1));
  const next = () => setPage(p => Math.min(count || 1, p + 1));

  // Fit the page within w×h keeping its aspect ratio.
  const ready = dims.w > 0;
  const aspect = ready ? dims.h / dims.w : h / w;
  let pw = w, ph = w * aspect;
  if (ph > h) { ph = h; pw = h / aspect; }

  return (
    <group position={position} rotation={rotation}>
      {/* backboard */}
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[w + 0.4, h + 0.9]} />
        <meshStandardMaterial color="#0b0e14" metalness={0.4} roughness={0.5} />
      </mesh>
      {ready ? (
        <mesh position={[0, 0.25, 0]}>
          <planeGeometry args={[pw, ph]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ) : (
        <CanvasLabel text="PDF…" width={Math.min(w * 0.5, 3)} height={0.7} position={[0, 0.25, 0]} color="#ffffff" />
      )}
      {/* page controls below the slide */}
      <group position={[0, -h / 2 - 0.1, 0.02]}>
        <ArrowBtn x={-1.1} glyph="◀" onClick={prev} color={accent} />
        <CanvasLabel text={count ? `${page} / ${count}` : '…'} width={1.3} height={0.45} position={[0, 0, 0]} color="#ffffff" />
        <ArrowBtn x={1.1} glyph="▶" onClick={next} color={accent} />
      </group>
    </group>
  );
};
