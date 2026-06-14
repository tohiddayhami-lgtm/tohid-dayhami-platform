import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { Html, useTexture, useVideoTexture, RoundedBox, useGLTF } from '@react-three/drei';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import type { BoothTier, MetaverseBooth, MetaverseHotspot } from '../../types';
import { Language } from '../../App';
import { bi, isVideoUrl, isVideoFile, isGif, isPdfFile, isHtmlFile, screenEmbed } from './expoUtils';
import { Hotspot } from './Hotspot';
import { GltfModel } from './GltfModel';
import { CanvasLabel } from './CanvasLabel';
import type { BoothFace } from '../../types';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

interface Props {
  booth: MetaverseBooth;
  index?: number;            // 0-based booth order → shown as a 1-based number on the header sign
  lang: Language;
  onSelectHotspot: (h: MetaverseHotspot) => void;
  onSelectBooth: (b: MetaverseBooth) => void;
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

const PdfArrowBtn: React.FC<{ x: number; glyph: string; onClick: () => void; color: string }> = ({ x, glyph, onClick, color }) => (
  <group position={[x, 0, 0]}>
    <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <planeGeometry args={[0.34, 0.26]} />
      <meshStandardMaterial color={color} />
    </mesh>
    <CanvasLabel text={glyph} width={0.28} height={0.22} position={[0, 0, 0.01]} color="#fff" onClick={onClick} />
  </group>
);

const PdfPanel: React.FC<MediaProps> = ({ url, width, height, position, rotation }) => {
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
  const aspect = ready ? dims.h / dims.w : height / width;
  let pw = width, ph = width * aspect;
  if (ph > height) { ph = height; pw = height / aspect; }
  const prev = () => setPage(p => Math.max(1, p - 1));
  const next = () => setPage(p => Math.min(count || 1, p + 1));

  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[width + 0.16, height + 0.42, 0.1]} radius={0.05} smoothness={3} position={[0, -0.08, -0.06]} castShadow>
        <meshStandardMaterial color="#0b0e14" metalness={0.45} roughness={0.45} />
      </RoundedBox>
      {ready ? (
        <mesh position={[0, 0.08, 0.01]}>
          <planeGeometry args={[pw, ph]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ) : (
        <CanvasLabel text="PDF..." width={Math.min(width * 0.55, 1.6)} height={0.32} position={[0, 0.08, 0.02]} color="#ffffff" />
      )}
      <group position={[0, -height / 2 - 0.11, 0.03]}>
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
const GifPlane: React.FC<MediaProps> = ({ url, width, height, position, rotation }) => {
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
    <mesh position={position} rotation={rotation}>
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
const HtmlPanel: React.FC<MediaProps> = ({ url, width, height, position, rotation }) => {
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
const VideoScreen: React.FC<MediaProps> = ({ url, width, height, position, rotation }) => {
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
  const onPic = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); reveal(); };
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

const CounterMiniatureGlb: React.FC<{ url: string; position: [number, number, number] }> = ({ url, position }) => {
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
const BoothScreen: React.FC<MediaProps> = ({ url, width, height, position, rotation }) => {
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
      <mesh position={[0, 0, -0.005]}>
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
            <VideoScreen url={url} width={width} height={height} position={[0, 0, 0.01]} />
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
export const Booth: React.FC<Props> = ({ booth, index, lang, onSelectHotspot, onSelectBooth }) => {
  const accent = booth.color || '#2d4a1a';
  const name = bi(booth.name, lang, lang === 'fa' ? 'غرفه' : 'Booth');
  const num = index != null ? (lang === 'fa' ? faDigits(index + 1) : String(index + 1)) : null;
  const tier: BoothTier = booth.tier || 'basic';
  const tierSpec = {
    basic: { panel: 1, side: 1, glow: 1.4, trim: 0 },
    standard: { panel: 1.12, side: 1.12, glow: 1.9, trim: 0.12 },
    premium: { panel: 1.2, side: 1.18, glow: 2.5, trim: 0.2 },
  }[tier];
  const scale = booth.scale || 1;
  const W = 4, D = 4, wallH = 3.2;          // keep the core footprint stable so layout/buttons don't shift
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);
  const accentDark = useMemo(() => new THREE.Color(accent).multiplyScalar(0.6), [accent]);
  const enterShop = lang === 'fa' ? 'ورود به فروشگاه' : 'Enter shop';
  const premiumSignText = bi(booth.premiumSignText, lang, name);
  const premiumSignColor = booth.premiumSignColor || accent;

  // Media for each of the 6 wall faces (3 inner + 3 outer). innerBack falls back to the legacy
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
  const managerSlots = [0, 1, 2, 3, 4];
  const managerXs = [-1.45, -0.72, 0, 0.72, 1.45];
  const managerPngs = managerSlots.map(i => booth.managerPngs?.[i] || '');
  const managerNames = managerSlots.map(i => bi(booth.managerNames?.[i], lang, ''));
  const legacyWhatsapps = (booth as any).managerWhatsapps as string[] | undefined;
  const managerLinks = managerSlots.map(i => booth.managerLinks?.[i] || legacyWhatsapps?.[i] || '');
  const managerAudios = managerSlots.map(i => (
    lang === 'fa'
      ? (booth.managerAudiosFa?.[i] || booth.managerAudios?.[i] || booth.managerAudiosEn?.[i] || '')
      : (booth.managerAudiosEn?.[i] || booth.managerAudios?.[i] || booth.managerAudiosFa?.[i] || '')
  ));
  const managerAudioRefs = useRef<(HTMLAudioElement | null)[]>([null, null, null, null, null]);
  const counterGlbs = managerSlots.map(i => booth.counterGlbs?.[i] || '');
  const counterGlbXs = [-0.82, -0.41, 0, 0.41, 0.82];
  useEffect(() => () => {
    managerAudioRefs.current.forEach(a => { if (a) { a.pause(); a.src = ''; } });
  }, []);
  const openManagerLink = (raw?: string) => {
    const v = (raw || '').trim();
    if (!v) return;
    const href = /^https?:\/\//i.test(v) ? v : /^\+?\d[\d\s-]+$/.test(v) ? `https://wa.me/${v.replace(/[^\d]/g, '')}` : `https://${v}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };
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

  return (
    <group position={[booth.x || 0, booth.y || 0, booth.z || 0]} rotation={[0, booth.ry || 0, 0]} scale={scale}>
      {booth.modelUrl ? (
        <TexBoundary key={booth.modelUrl}>
          <Suspense fallback={null}>
            <GltfModel url={booth.modelUrl} />
          </Suspense>
        </TexBoundary>
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
          {counterGlbs.map((url, i) => url ? (
            <TexBoundary key={`${url}-${i}`}>
              <Suspense fallback={null}>
                <CounterMiniatureGlb url={url} position={[counterGlbXs[i], 1.02, D / 2 - 0.5]} />
              </Suspense>
            </TexBoundary>
          ) : null)}

          {/* Six wall panels (3 inner + 3 outer) — each an image or an in-world auto-playing video */}
          {PANEL_SPECS.map(s => { const u = panelUrl(s.face); return u ? <PanelMedia key={s.face} url={u} width={s.w} height={s.h} position={s.position} rotation={s.rotation} /> : null; })}

          {/* Logo plate above the reception desk */}
          {booth.logo && (
            <SafeImage url={booth.logo} width={0.8} height={0.8} position={[0, 1.5, D / 2 - 0.46]} />
          )}

          {/* Counter / desk front — a clickable 3D link into the booth's shop (works in VR too) */}
          {booth.shopSlug && (
            <group position={[0, 0.62, D / 2 - 0.12]}>
              <mesh onClick={(e) => { e.stopPropagation(); onSelectBooth(booth); }}
                onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
                <planeGeometry args={[1.74, 0.42]} />
                <meshStandardMaterial color={accentColor} />
              </mesh>
              <CanvasLabel text={`🛍 ${enterShop}`} width={1.66} height={0.36} position={[0, 0, 0.01]} color="#ffffff"
                onClick={(e) => { e.stopPropagation(); onSelectBooth(booth); }} />
            </group>
          )}

          {/* Booth header sign: number + name. A baked 3D label so it renders in VR. Click → shop. */}
          <CanvasLabel
            text={num ? `${num} · ${name}` : name}
            width={W * 0.92} height={0.42}
            position={[0, wallH + 0.12, -D / 2 + 0.17]}
            color="#ffffff"
            onClick={(e) => { e.stopPropagation(); onSelectBooth(booth); }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          />
        </group>
      )}

      {/* Optional life-size transparent PNG people standing behind the reception counter. */}
      {managerPngs.map((url, i) => url ? (
        <SafeImage
          key={`${url}-${i}`}
          url={url}
          width={1.12}
          height={2.1}
          position={[managerXs[i], 1.05, D / 2 - 1.08]}
          onClick={(managerAudios[i] || managerLinks[i]) ? (e) => {
            e.stopPropagation();
            if (managerAudios[i]) toggleManagerAudio(i, managerAudios[i]);
            else openManagerLink(managerLinks[i]);
          } : undefined}
        />
      ) : null)}
      {managerPngs.map((url, i) => (url && managerNames[i]) ? (
        <CanvasLabel
          key={`name-${url}-${i}`}
          text={managerNames[i]}
          width={0.68}
          height={0.22}
          position={[managerXs[i], 2.5, D / 2 - 1.055]}
          bg="rgba(15,23,42,.82)"
          color="#ffffff"
        />
      ) : null)}
      {managerPngs.map((url, i) => (url && managerAudios[i]) ? (
        <group key={`audio-${url}-${i}`} position={[managerXs[i], 2.26, D / 2 - 1.06]}>
          <group position={[-0.3, 0, 0]}>
            <mesh
              onClick={(e) => { e.stopPropagation(); seekManagerAudio(i, managerAudios[i], -5); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <circleGeometry args={[0.13, 24]} />
              <meshBasicMaterial color="#0f172a" transparent opacity={0.76} toneMapped={false} />
            </mesh>
            <CanvasLabel text="-5" width={0.2} height={0.16} position={[0, 0, 0.01]} color="#ffffff" onClick={(e) => { e.stopPropagation(); seekManagerAudio(i, managerAudios[i], -5); }} />
          </group>
          <mesh
            onClick={(e) => { e.stopPropagation(); toggleManagerAudio(i, managerAudios[i]); }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            <circleGeometry args={[0.17, 32]} />
            <meshBasicMaterial color="#0f172a" transparent opacity={0.86} toneMapped={false} />
          </mesh>
          <CanvasLabel text="♪" width={0.24} height={0.24} position={[0, 0, 0.01]} color="#ffffff" onClick={(e) => { e.stopPropagation(); toggleManagerAudio(i, managerAudios[i]); }} />
          <group position={[0.3, 0, 0]}>
            <mesh
              onClick={(e) => { e.stopPropagation(); seekManagerAudio(i, managerAudios[i], 5); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <circleGeometry args={[0.13, 24]} />
              <meshBasicMaterial color="#0f172a" transparent opacity={0.76} toneMapped={false} />
            </mesh>
            <CanvasLabel text="+5" width={0.2} height={0.16} position={[0, 0, 0.01]} color="#ffffff" onClick={(e) => { e.stopPropagation(); seekManagerAudio(i, managerAudios[i], 5); }} />
          </group>
        </group>
      ) : null)}

      {/* Interactive hotspots (positions are local offsets from the booth origin) */}
      {(booth.hotspots || []).map(h => (
        <Hotspot key={h.id} hotspot={h} lang={lang} onSelect={onSelectHotspot} />
      ))}
    </group>
  );
};
