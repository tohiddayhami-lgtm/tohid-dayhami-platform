import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { TexBoundary } from './Booth';
import { CanvasLabel } from './CanvasLabel';
// Static asset URL for the pdf.js worker (Vite emits it); pdf.js core is loaded on demand below.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const openNewTab = (url?: string) => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); };

// ── Environmental wall advertisement ──────────────────────────────────────
const AdImage: React.FC<{ url: string; w: number; h: number; onClick?: () => void }> = ({ url, w, h, onClick }) => {
  const tex = useTexture(url);
  return (
    <mesh position={[0, 0, 0.02]} onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { if (onClick) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex as THREE.Texture} transparent toneMapped={false} />
    </mesh>
  );
};

export const WallAd: React.FC<{
  url?: string; image?: string; title?: string; w: number; h: number;
  position: [number, number, number]; rotation: [number, number, number];
}> = ({ url, image, title, w, h, position, rotation }) => (
  <group position={position} rotation={rotation}>
    {/* dark frame */}
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[w + 0.12, h + 0.12]} />
      <meshStandardMaterial color="#11161f" />
    </mesh>
    {image ? (
      <TexBoundary key={image}>
        <Suspense fallback={null}>
          <AdImage url={image} w={w} h={h} onClick={() => openNewTab(url)} />
        </Suspense>
      </TexBoundary>
    ) : (
      <CanvasLabel text={title || (url || 'تبلیغات')} width={w * 0.9} height={Math.min(h * 0.6, 0.6)} position={[0, 0, 0.02]} color="#fff" onClick={() => openNewTab(url)} />
    )}
    {/* tiny "link" hint when clickable */}
    {url && <CanvasLabel text="🔗" width={0.28} height={0.28} position={[w / 2 - 0.18, -h / 2 + 0.18, 0.03]} color="#fff" onClick={() => openNewTab(url)} />}
  </group>
);

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
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  const docRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);

  // Load the document once per URL.
  useEffect(() => {
    let cancelled = false;
    setCount(0); setPage(1); setTex(null);
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setCount(doc.numPages);
      } catch { /* leave blank — handled by the placeholder */ }
    })();
    return () => { cancelled = true; docRef.current = null; };
  }, [url]);

  // Render the current page to a canvas texture.
  useEffect(() => {
    if (!count) return;
    let cancelled = false;
    (async () => {
      const doc = docRef.current; if (!doc) return;
      try {
        const pg = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
        if (cancelled) return;
        const base = pg.getViewport({ scale: 1 });
        const scale = 1400 / base.width;
        const vp = pg.getViewport({ scale });
        const canvas = canvasRef.current || document.createElement('canvas');
        canvasRef.current = canvas;
        canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
        if (cancelled) return;
        const t = new THREE.CanvasTexture(canvas);
        t.anisotropy = 4; t.needsUpdate = true;
        texRef.current?.dispose();
        texRef.current = t;
        setTex(t);
      } catch { /* ignore a failed page */ }
    })();
    return () => { cancelled = true; };
  }, [page, count]);

  useEffect(() => () => { texRef.current?.dispose(); }, []);

  const prev = () => setPage(p => Math.max(1, p - 1));
  const next = () => setPage(p => Math.min(count || 1, p + 1));

  // Fit the page within w×h keeping its aspect ratio.
  const aspect = tex?.image ? (tex.image as HTMLCanvasElement).height / (tex.image as HTMLCanvasElement).width : h / w;
  let pw = w, ph = w * aspect;
  if (ph > h) { ph = h; pw = h / aspect; }

  return (
    <group position={position} rotation={rotation}>
      {/* backboard */}
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[w + 0.4, h + 0.9]} />
        <meshStandardMaterial color="#0b0e14" metalness={0.4} roughness={0.5} />
      </mesh>
      {tex ? (
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
