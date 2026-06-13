import React, { Suspense, useMemo } from 'react';
import { Html, useTexture, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { MetaverseBooth, MetaverseHotspot } from '../../types';
import { Language } from '../../App';
import { bi, screenEmbed, isVideoUrl } from './expoUtils';
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

// One wall surface: a video link → live LCD screen, anything else → an image panel.
const PanelMedia: React.FC<MediaProps> = (props) =>
  isVideoUrl(props.url)
    ? <BoothScreen {...props} />
    : <SafeImage {...props} />;

// In-world LCD screen that auto-plays a video link (YouTube / Vimeo / mp4), muted + looping.
// Rendered as a transformed HTML surface so any video source works in 3D space.
const BoothScreen: React.FC<{ url: string; width: number; height: number; position: [number, number, number]; rotation?: [number, number, number] }> = ({ url, width, height, position, rotation }) => {
  const v = useMemo(() => screenEmbed(url), [url]);
  if (!v) return null;
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
      {/* VR fallback: the Html iframe below is invisible in immersive XR, so show a ▶ glyph
          on the panel so headset users still see it's a video screen. */}
      <CanvasLabel text="▶" width={width * 0.4} height={width * 0.4} position={[0, 0, 0.005]} color="#ffffff" />
      <Html
        transform
        occlude
        position={[0, 0, 0.02]}
        scale={scale}
        zIndexRange={[12, 0]}
        style={{ width: PX_W, height: PX_H, background: '#000', overflow: 'hidden', borderRadius: 8, boxShadow: '0 0 24px rgba(80,140,255,.25)' }}
      >
        {v.kind === 'iframe' ? (
          <iframe src={v.src} width={PX_W} height={PX_H} frameBorder={0} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ display: 'block', border: 0 }} title="booth-screen" />
        ) : (
          <video src={v.src} width={PX_W} height={PX_H} autoPlay muted loop playsInline style={{ display: 'block', objectFit: 'cover', width: PX_W, height: PX_H }} />
        )}
      </Html>
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

          {/* Six wall panels (3 inner + 3 outer) — each an image or an auto-playing video */}
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
