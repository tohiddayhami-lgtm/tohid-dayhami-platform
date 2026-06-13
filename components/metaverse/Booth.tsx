import React, { Suspense, useMemo } from 'react';
import { useTexture, useVideoTexture, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { MetaverseBooth, MetaverseHotspot } from '../../types';
import { Language } from '../../App';
import { bi, isVideoUrl, isVideoFile, videoPoster } from './expoUtils';
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

// One wall surface: a video link → LCD screen, anything else → an image panel.
const PanelMedia: React.FC<MediaProps & { onPlay?: () => void }> = ({ onPlay, ...props }) =>
  isVideoUrl(props.url)
    ? <BoothScreen {...props} onPlay={onPlay} />
    : <SafeImage {...props} />;

// A real <video> textured straight onto the 3D plane — muted, looping in-world playback.
// Used ONLY for direct video files (mp4/webm/ogg); YouTube/Vimeo can't be textured (CORS).
const VideoPlane: React.FC<MediaProps> = ({ url, width, height, position, rotation }) => {
  const tex = useVideoTexture(url, { muted: true, loop: true, start: true, crossOrigin: 'anonymous', playsInline: true } as any);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex as THREE.Texture} toneMapped={false} />
    </mesh>
  );
};

// In-world LCD screen for a video link. Direct files play on the wall; YouTube/Vimeo show a
// clickable poster (▶) that opens the full 2D video player — reliable, unlike autoplaying an
// iframe inside a CSS-3D-transformed surface (which silently fails to play and isn't clickable).
const BoothScreen: React.FC<{ url: string; width: number; height: number; position: [number, number, number]; rotation?: [number, number, number]; onPlay?: () => void }> = ({ url, width, height, position, rotation, onPlay }) => {
  const file = isVideoFile(url);
  const poster = useMemo(() => videoPoster(url), [url]);
  const click = (e: any) => { e.stopPropagation(); onPlay?.(); };
  const hoverable = !file && !!onPlay;
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

      {file ? (
        // Direct video file → genuine playback on the wall.
        <TexBoundary key={url}>
          <Suspense fallback={null}>
            <VideoPlane url={url} width={width} height={height} position={[0, 0, 0.01]} />
          </Suspense>
        </TexBoundary>
      ) : (
        // YouTube/Vimeo → poster thumbnail + clickable ▶ that opens the full-screen player.
        <group
          onClick={hoverable ? click : undefined}
          onPointerOver={hoverable ? () => { document.body.style.cursor = 'pointer'; } : undefined}
          onPointerOut={hoverable ? () => { document.body.style.cursor = 'auto'; } : undefined}
        >
          {poster && (
            <SafeImage url={poster} width={width} height={height} position={[0, 0, 0.005]} />
          )}
          {/* Dim scrim + big play glyph so it clearly reads as a tappable video */}
          <mesh position={[0, 0, 0.012]}>
            <circleGeometry args={[Math.min(width, height) * 0.18, 32]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.5} toneMapped={false} />
          </mesh>
          <CanvasLabel text="▶" width={width * 0.34} height={width * 0.34} position={[0, 0, 0.02]} color="#ffffff" onClick={hoverable ? click : undefined} />
        </group>
      )}
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

  // Clicking a booth video screen opens the full 2D player (HotspotModal) — reliable autoplay
  // with sound, instead of a flaky in-iframe autoplay on a CSS-3D surface.
  const playVideo = (face: BoothFace, url: string) => onSelectHotspot({
    id: `${booth.id}-screen-${face}`, x: 0, y: 0, z: 0, type: 'video', url, title: booth.name,
  });
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

          {/* Six wall panels (3 inner + 3 outer) — each an image, an in-world video, or a clickable poster */}
          {PANEL_SPECS.map(s => { const u = panelUrl(s.face); return u ? <PanelMedia key={s.face} url={u} width={s.w} height={s.h} position={s.position} rotation={s.rotation} onPlay={() => playVideo(s.face, u)} /> : null; })}

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
