import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { Html, useTexture, useVideoTexture, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { MetaverseBooth, MetaverseHotspot } from '../../types';
import { Language } from '../../App';
import { bi, isVideoUrl, isVideoFile, isGif, isHtmlFile, screenEmbed } from './expoUtils';
import { Hotspot } from './Hotspot';
import { GltfModel } from './GltfModel';
import { CanvasLabel } from './CanvasLabel';
import type { BoothFace } from '../../types';

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

type MediaProps = { url: string; width: number; height: number; position: [number, number, number]; rotation?: [number, number, number] };

// Optional image-on-a-plane (logo / banner / wall panel). Loads lazily; absent → nothing.
const ImagePlane: React.FC<MediaProps> = ({ url, width, height, position, rotation }) => {
  const tex = useTexture(url);
  return (
    <mesh position={position} rotation={rotation}>
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
  const anchorRef = useRef<THREE.Group>(null);
  const [el] = useState(() => document.createElement('div'));
  const rootRef = useRef<ReactDOM.Root | null>(null);
  const target = portal.current;
  const cornerRefs = useRef({
    tl: new THREE.Vector3(),
    tr: new THREE.Vector3(),
    bl: new THREE.Vector3(),
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

    anchor.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();

    const { tl, tr, bl, center, camPos, camDir } = cornerRefs.current;
    tl.set(-width / 2, height / 2, 0).applyMatrix4(anchor.matrixWorld);
    tr.set(width / 2, height / 2, 0).applyMatrix4(anchor.matrixWorld);
    bl.set(-width / 2, -height / 2, 0).applyMatrix4(anchor.matrixWorld);
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
    if (p0.z < -1 || p0.z > 1 || p1.z < -1 || p1.z > 1 || p2.z < -1 || p2.z > 1) {
      el.style.display = 'none';
      return;
    }

    const a = (p1.x - p0.x) / pxW;
    const b = (p1.y - p0.y) / pxW;
    const c = (p2.x - p0.x) / pxH;
    const d = (p2.y - p0.y) / pxH;
    const dist = center.distanceTo(camPos);
    el.style.display = 'block';
    el.style.zIndex = String(Math.max(5, Math.min(35, Math.round(36 - dist * 0.25))));
    el.style.transform = `matrix(${a},${b},${c},${d},${p0.x},${p0.y})`;
  });

  return <group ref={anchorRef} position={[0, 0, 0.035]} />;
};

// One wall surface, by source: HTML page → iframe panel, animated GIF → animated texture,
// video → LCD screen, anything else → a static image panel.
const PanelMedia: React.FC<MediaProps> = (props) =>
  isHtmlFile(props.url) ? <HtmlPanel {...props} />
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
      {/* VR-only fallback glyph (DOM can't render inside an immersive XR session) */}
      <CanvasLabel text="🌐" width={width * 0.32} height={width * 0.32} position={[0, 0, 0.004]} color="#ffffff" />
      <ProjectedHtmlPanel width={width} height={height} pxW={PX_W} pxH={PX_H} portal={portal}>
        {doc != null
          ? <iframe srcDoc={doc} style={{ display: 'block', border: 0, width: PX_W, height: PX_H, background: '#fff' }} title="booth-html" />
          : <iframe src={url} style={{ display: 'block', border: 0, width: PX_W, height: PX_H, background: '#fff' }} title="booth-html" />}
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
  const scale = booth.scale || 1;
  const W = 4, D = 4, wallH = 3.2;          // procedural booth footprint (meters)
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);
  const accentDark = useMemo(() => new THREE.Color(accent).multiplyScalar(0.6), [accent]);
  const enterShop = lang === 'fa' ? 'ورود به فروشگاه' : 'Enter shop';

  // Media for each of the 6 wall faces (3 inner + 3 outer). innerBack falls back to the legacy
  // screenUrl / bannerImage so older booths keep working.
  const P = booth.panels || {};
  const panelUrl = (face: BoothFace): string | undefined =>
    P[face] || (face === 'innerBack' ? (booth.screenUrl || booth.bannerImage) : undefined);
  const backW = W * 0.78, backH = backW * 9 / 16, sideW = 1.9, sideH = 1.15;
  const PANEL_SPECS: { face: BoothFace; position: [number, number, number]; rotation: [number, number, number]; w: number; h: number }[] = [
    { face: 'innerBack',  position: [0, 1.62, -D / 2 + 0.09], rotation: [0, 0, 0],             w: backW, h: backH },
    { face: 'outerBack',  position: [0, 1.62, -D / 2 - 0.09], rotation: [0, Math.PI, 0],       w: backW, h: backH },
    { face: 'innerLeft',  position: [-W / 2 + 0.09, 1.45, -D / 6], rotation: [0, Math.PI / 2, 0],  w: sideW, h: sideH },
    { face: 'outerLeft',  position: [-W / 2 - 0.09, 1.45, -D / 6], rotation: [0, -Math.PI / 2, 0], w: sideW, h: sideH },
    { face: 'innerRight', position: [W / 2 - 0.09, 1.45, -D / 6], rotation: [0, -Math.PI / 2, 0],  w: sideW, h: sideH },
    { face: 'outerRight', position: [W / 2 + 0.09, 1.45, -D / 6], rotation: [0, Math.PI / 2, 0],   w: sideW, h: sideH },
  ];

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
            <meshStandardMaterial color="#f7f8fa" roughness={0.9} />
          </mesh>

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

          {/* Side half-walls */}
          <mesh position={[-W / 2, wallH / 2.6, -D / 6]} castShadow receiveShadow>
            <boxGeometry args={[0.12, wallH / 1.3, D * 0.66]} />
            <meshStandardMaterial color="#eef0f3" roughness={0.85} />
          </mesh>
          <mesh position={[W / 2, wallH / 2.6, -D / 6]} castShadow receiveShadow>
            <boxGeometry args={[0.12, wallH / 1.3, D * 0.66]} />
            <meshStandardMaterial color="#eef0f3" roughness={0.85} />
          </mesh>

          {/* Lit header sign across the top */}
          <RoundedBox args={[W + 0.1, 0.56, 0.18]} radius={0.07} smoothness={3} position={[0, wallH + 0.12, -D / 2 + 0.06]} castShadow>
            <meshStandardMaterial color={accentColor} metalness={0.2} roughness={0.5} />
          </RoundedBox>
          {/* Emissive light strip under the header (booth glow) */}
          <mesh position={[0, wallH - 0.12, -D / 2 + 0.14]}>
            <boxGeometry args={[W * 0.92, 0.06, 0.04]} />
            <meshStandardMaterial color={'#ffffff'} emissive={accentColor} emissiveIntensity={1.4} toneMapped={false} />
          </mesh>

          {/* Reception desk / podium */}
          <RoundedBox args={[W * 0.52, 0.95, 0.6]} radius={0.05} smoothness={3} position={[0, 0.48, D / 2 - 0.5]} castShadow receiveShadow>
            <meshStandardMaterial color={accentDark} metalness={0.15} roughness={0.55} />
          </RoundedBox>
          <mesh position={[0, 0.98, D / 2 - 0.5]} castShadow>
            <boxGeometry args={[W * 0.54, 0.06, 0.66]} />
            <meshStandardMaterial color="#e8eaed" metalness={0.3} roughness={0.4} />
          </mesh>

          {/* Six wall panels (3 inner + 3 outer) — each an image or an in-world auto-playing video */}
          {PANEL_SPECS.map(s => { const u = panelUrl(s.face); return u ? <PanelMedia key={s.face} url={u} width={s.w} height={s.h} position={s.position} rotation={s.rotation} /> : null; })}

          {/* Logo plate above the reception desk */}
          {booth.logo && (
            <SafeImage url={booth.logo} width={0.8} height={0.8} position={[0, 1.5, D / 2 - 0.46]} />
          )}

          {/* Counter / desk front — a clickable 3D link into the booth's shop (works in VR too) */}
          {booth.shopSlug && (
            <group position={[0, 0.62, D / 2 - 0.19]}>
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

      {/* Interactive hotspots (positions are local offsets from the booth origin) */}
      {(booth.hotspots || []).map(h => (
        <Hotspot key={h.id} hotspot={h} lang={lang} onSelect={onSelectHotspot} />
      ))}
    </group>
  );
};
