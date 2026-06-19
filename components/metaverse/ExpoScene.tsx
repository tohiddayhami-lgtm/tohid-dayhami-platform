import React, { Suspense, useCallback, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Sky, Grid, RoundedBox, useTexture } from '@react-three/drei';
import { TeleportTarget } from '@react-three/xr';
import * as THREE from 'three';
import type { ExpoEntranceAd, ExpoEnvironmentMedia, ExpoEnvironmentMediaKind, ExpoRetailCategory, MetaExpoEvent, MetaShop, MetaverseExpo, MetaverseBooth, MetaverseHotspot } from '../../types';
import type { BoothReservationSummary } from '../../utils/boothReservationUtils';
import { Language } from '../../App';
import { hallDims, EXPO_DEFAULTS, wallTransform, layoutCarpetRects, normalizeBoothLayout, EXPO_CARPET } from './expoUtils';
import { Booth, TexBoundary } from './Booth';
import { GltfModel } from './GltfModel';
import { ExpoDecorationMesh } from './ExpoDecoration';
import { useEnvironmentCollision } from './EnvironmentCollisionContext';
import { environmentCollisionEnabled, syncCollisionMatrices } from './expoEnvironmentCollision';
import { WallAd, PresentationScreen } from './WallMedia';
import { bi, expoPhrase } from './expoUtils';
import { CanvasLabel } from './CanvasLabel';
import { EnvironmentMediaItem } from './EnvironmentMediaItem';
import { EnvironmentEditGizmos } from './EnvironmentEditMode';

interface Props {
  expo: MetaverseExpo;
  shops?: MetaShop[];
  lang: Language;
  onSelectHotspot: (h: MetaverseHotspot) => void;
  onSelectBooth: (b: MetaverseBooth) => void;
  onFloorTeleport: (x: number, z: number) => void;   // desktop double-click teleport
  onVrTeleport: (v: THREE.Vector3) => void;           // WebXR controller teleport
  onTrack?: (type: MetaExpoEvent['type'], opts?: Partial<MetaExpoEvent>) => void;
  onRegistrationKioskClick?: () => void;
  boothSummaries?: Record<string, BoothReservationSummary>;
  onReserveBooth?: (b: MetaverseBooth) => void;
  environmentEditMode?: boolean;
  environmentMedia?: ExpoEnvironmentMedia[];
  selectedEnvMediaId?: string | null;
  onSelectEnvMedia?: (id: string | null) => void;
  onUpdateEnvMedia?: (id: string, patch: Partial<ExpoEnvironmentMedia>) => void;
  onAddEnvMedia?: (kind: ExpoEnvironmentMediaKind, at: { x: number; y: number; z: number }) => void;
}

const Wall: React.FC<{ args: [number, number, number]; position: [number, number, number]; color: string }> = ({ args, position, color }) => (
  <mesh position={position} receiveShadow castShadow>
    <boxGeometry args={args} />
    <meshStandardMaterial color={color} side={THREE.DoubleSide} />
  </mesh>
);

const DoormanImage: React.FC<{ url: string; position: [number, number, number]; mirror?: boolean }> = ({ url, position, mirror }) => {
  const tex = useTexture(url);
  return (
    <mesh position={position} scale={[mirror ? -1 : 1, 1, 1]}>
      <planeGeometry args={[1.35, 2.55]} />
      <meshBasicMaterial map={tex as THREE.Texture} transparent toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

const ExpoEntrance: React.FC<{
  expo: MetaverseExpo;
  lang: Language;
  width: number;
  depth: number;
  onTrack?: Props['onTrack'];
  onRegistrationKioskClick?: () => void;
}> = ({ expo, lang, width, depth, onTrack, onRegistrationKioskClick }) => {
  const z0 = depth / 2 + 7.2;
  const z1 = depth / 2 + 0.55;
  const organizer = bi(expo.entranceOrganizer || expo.title, lang, expoPhrase(lang, 'organizer'));
  const title = bi(expo.title, lang, expoPhrase(lang, 'enterExpo'));
  const primary = expo.wallColor || EXPO_DEFAULTS.wallColor;
  const entranceAds = (expo.entranceAds || []).filter(ad => ad.enabled !== false);
  const apronStart = depth / 2 + 0.18;
  const apronEnd = z0 + 0.55;
  const apronLen = apronEnd - apronStart;
  const apronZ = (apronStart + apronEnd) / 2;
  const carpetStart = depth / 2 + 0.24;
  const carpetEnd = z0 + 0.32;
  const carpetLen = carpetEnd - carpetStart;
  const carpetZ = (carpetStart + carpetEnd) / 2;
  const railTotals = entranceAds.reduce<Record<string, number>>((acc, ad) => {
    if (ad.position === 'railLeft' || ad.position === 'railRight') acc[ad.position] = (acc[ad.position] || 0) + 1;
    return acc;
  }, {});
  const railSeen: Record<string, number> = {};
  const showRegKiosk = expo.entranceRegistration?.enabled !== false;
  const kioskLabel = bi(expo.entranceRegistration?.title, lang, expoPhrase(lang, 'register'));
  const kioskZ = z1 + 1.75;
  const openKiosk = () => {
    onTrack?.('entrance_kiosk_click', { targetType: 'registration_kiosk', side: 'entrance_gate' });
    onRegistrationKioskClick?.();
  };
  const entranceAdTransform = (ad: ExpoEntranceAd): { position: [number, number, number]; rotation: [number, number, number] } => {
    const w = ad.w || 2;
    const h = ad.h || 3.5;
    const y = h / 2 + 0.18;
    if (ad.position === 'aboveArch') {
      return { position: [0, 3.65 + h / 2 + (ad.lift ?? 0.75), depth / 2 + 0.24], rotation: [0, 0, 0] };
    }
    if (ad.position === 'archLeft' || ad.position === 'archRight') {
      const side = ad.position === 'archLeft' ? -1 : 1;
      const x = side * Math.min(width / 2 - w / 2 - 0.45, 5.7);
      return { position: [x, y + 0.15, depth / 2 + 0.32], rotation: [0, 0, 0] };
    }
    const side = ad.position === 'railLeft' ? -1 : 1;
    const total = Math.max(1, railTotals[ad.position] || 1);
    const i = railSeen[ad.position] || 0;
    railSeen[ad.position] = i + 1;
    const z = z1 + ((i + 1) / (total + 1)) * (z0 - z1);
    return { position: [side * 3.55, y, z], rotation: [0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0] };
  };
  return (
    <group>
      {/* Light entrance apron covers the whole outside corridor, including behind the rails. */}
      <mesh position={[0, 0.026, apronZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[Math.min(width, 9.5), apronLen]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.62} metalness={0} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      {/* Welcome red carpet — exterior corridor leading to the doorway */}
      <mesh position={[0, 0.07, carpetZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.6, carpetLen]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.72} metalness={0.05} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh position={[0, 0.092, carpetZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, Math.max(0.1, carpetLen - 0.35)]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.45} toneMapped={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
      </mesh>
      {/* Low side rails keep the corridor readable without blocking walking. */}
      {[-2.55, 2.55].map(x => (
        <group key={x}>
          <RoundedBox args={[0.12, 0.72, Math.abs(z0 - z1) + 0.6]} radius={0.04} smoothness={3} position={[x, 0.38, (z0 + z1) / 2]} castShadow>
            <meshStandardMaterial color="#064e3b" metalness={0.2} roughness={0.5} />
          </RoundedBox>
          <mesh position={[x, 0.78, (z0 + z1) / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, Math.abs(z0 - z1) + 0.9, 16]} />
            <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.28} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Professional arch with organizer information. */}
      <RoundedBox args={[5.8, 0.38, 0.34]} radius={0.08} smoothness={4} position={[0, 3.25, z1]} castShadow>
        <meshStandardMaterial color="#064e3b" emissive="#052e1f" emissiveIntensity={0.18} metalness={0.25} roughness={0.4} />
      </RoundedBox>
      {[-2.72, 2.72].map(x => (
        <RoundedBox key={x} args={[0.32, 3.1, 0.32]} radius={0.08} smoothness={4} position={[x, 1.68, z1]} castShadow>
          <meshStandardMaterial color="#064e3b" metalness={0.25} roughness={0.45} />
        </RoundedBox>
      ))}
      <CanvasLabel text={organizer} width={5.35} height={0.33} position={[0, 3.25, z1 + 0.19]} bg="rgba(15,23,42,.86)" color="#ffffff" />
      <CanvasLabel text={title} width={3.8} height={0.3} position={[0, 2.78, z1 + 0.2]} bg="rgba(251,191,36,.92)" color="#102015" />
      <mesh position={[0, 1.55, z1 + 0.03]}>
        <planeGeometry args={[4.8, 2.55]} />
        <meshStandardMaterial color={primary} transparent opacity={0.34} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      {entranceAds.map(ad => {
        const { position, rotation } = entranceAdTransform(ad);
        return (
          <WallAd
            key={ad.id}
            image={ad.image}
            url={ad.url}
            title={bi(ad.title, lang, expoPhrase(lang, 'entranceAd'))}
            w={ad.w || 2}
            h={ad.h || 3.5}
            position={position}
            rotation={rotation}
            onAdClick={() => onTrack?.('entrance_ad_click', {
              targetId: ad.id,
              targetName: bi(ad.title, lang, ''),
              targetType: 'entrance_ad',
              side: ad.position,
            })}
          />
        );
      })}
      {expo.entranceDoormanImage && (
        <TexBoundary key={expo.entranceDoormanImage}>
          <Suspense fallback={null}>
            <DoormanImage url={expo.entranceDoormanImage} position={[-3.35, 1.34, z1 + 0.42]} />
            <DoormanImage url={expo.entranceDoormanImage} position={[3.35, 1.34, z1 + 0.42]} mirror />
          </Suspense>
        </TexBoundary>
      )}
      {showRegKiosk && onRegistrationKioskClick && (
        <group position={[0, 0, kioskZ]}>
          {/* Small entrance registration gate */}
          <RoundedBox args={[0.14, 1.05, 0.14]} radius={0.03} smoothness={3} position={[-0.52, 0.52, 0]} castShadow>
            <meshStandardMaterial color="#064e3b" metalness={0.22} roughness={0.45} />
          </RoundedBox>
          <RoundedBox args={[0.14, 1.05, 0.14]} radius={0.03} smoothness={3} position={[0.52, 0.52, 0]} castShadow>
            <meshStandardMaterial color="#064e3b" metalness={0.22} roughness={0.45} />
          </RoundedBox>
          <RoundedBox args={[1.18, 0.1, 0.12]} radius={0.03} smoothness={3} position={[0, 1.02, 0]} castShadow>
            <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.35} toneMapped={false} metalness={0.15} roughness={0.4} />
          </RoundedBox>
          <mesh
            position={[0, 0.62, 0.12]}
            onClick={(e) => { e.stopPropagation(); openKiosk(); }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            <boxGeometry args={[0.92, 0.78, 0.08]} />
            <meshStandardMaterial color="#ecfdf5" emissive="#10b981" emissiveIntensity={0.18} roughness={0.55} />
          </mesh>
          <CanvasLabel
            text={`📝 ${kioskLabel}`}
            width={0.88}
            height={0.24}
            position={[0, 0.62, 0.18]}
            bg="rgba(6,78,59,.9)"
            color="#ffffff"
            onClick={(e) => { e.stopPropagation(); openKiosk(); }}
          />
        </group>
      )}
    </group>
  );
};

// Ceiling + a regular grid of glowing light panels, so the hall reads as a real lit exhibition
// space rather than an open box. Pure emissive planes (no extra real lights → cheap).
const Ceiling: React.FC<{ width: number; depth: number; height: number }> = ({ width, depth, height }) => {
  const cols = Math.max(2, Math.round(width / 6));
  const rows = Math.max(2, Math.round(depth / 6));
  const panels: { x: number; z: number }[] = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    panels.push({ x: (i - (cols - 1) / 2) * (width / cols), z: (j - (rows - 1) / 2) * (depth / rows) });
  }
  const pw = (width / cols) * 0.5, pd = (depth / rows) * 0.5;
  return (
    <group>
      {/* White, lightly-glossy exhibition ceiling slab */}
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f5f7fa" roughness={0.45} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Soft recessed light panels (warm white, gentle glow — reads as ceiling fixtures) */}
      {panels.map((p, i) => (
        <mesh key={i} position={[p.x, height - 0.05, p.z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[pw, pd]} />
          <meshStandardMaterial color="#ffffff" emissive={'#fff6e8'} emissiveIntensity={0.85} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

const retailZoneFrame = (cat: ExpoRetailCategory, index: number, total: number, width: number, depth: number) => {
  const cols = Math.min(2, Math.max(1, total));
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const zoneW = cat.w || Math.max(7.2, (width - 8) / cols - 1.5);
  const zoneD = cat.d || Math.max(7.4, (depth - 10) / rows - 1.8);
  const x = cat.x ?? ((col - (cols - 1) / 2) * (zoneW + 1.8));
  const z = cat.z ?? (depth / 2 - 7.8 - row * (zoneD + 2.1));
  return { x, z, zoneW, zoneD, col, row, rows, cols };
};

const RotatingDepartmentSign: React.FC<{ title: string; subtitle?: string; color: string; position: [number, number, number] }> = ({ title, subtitle, color, position }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.45;
  });
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 1.35, 14]} />
        <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.35} />
      </mesh>
      <RoundedBox args={[5.6, 0.7, 0.22]} radius={0.08} smoothness={3} position={[0, 0, 0]} castShadow>
        <meshStandardMaterial color="#0f172a" emissive={color} emissiveIntensity={0.38} metalness={0.45} roughness={0.32} />
      </RoundedBox>
      <CanvasLabel text={title} width={5.25} height={0.5} position={[0, 0.06, 0.13]} bg={color} color="#ffffff" />
      <CanvasLabel text={title} width={5.25} height={0.5} position={[0, 0.06, -0.13]} rotation={[0, Math.PI, 0]} bg={color} color="#ffffff" />
      {subtitle && <CanvasLabel text={subtitle} width={3.8} height={0.22} position={[0, -0.48, 0.14]} bg="rgba(255,255,255,.9)" color="#0f172a" bold={false} />}
      {subtitle && <CanvasLabel text={subtitle} width={3.8} height={0.22} position={[0, -0.48, -0.14]} rotation={[0, Math.PI, 0]} bg="rgba(255,255,255,.9)" color="#0f172a" bold={false} />}
    </group>
  );
};

const RetailCategoryZone: React.FC<{
  cat: ExpoRetailCategory;
  index: number;
  total: number;
  width: number;
  depth: number;
  lang: Language;
}> = ({ cat, index, total, width, depth, lang }) => {
  const { x, z, zoneW, zoneD } = retailZoneFrame(cat, index, total, width, depth);
  const color = cat.color || '#16a34a';
  const title = bi(cat.title, lang, expoPhrase(lang, 'category'));
  const desc = bi(cat.description, lang, '');
  const aisleLabel = `${expoPhrase(lang, 'aisle')} ${index + 1}`;
  return (
    <group position={[x, 0.025, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[zoneW, zoneD]} />
        <meshStandardMaterial color={color} transparent opacity={0.2} roughness={0.72} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh position={[0, 0.045, -zoneD / 2]}><boxGeometry args={[zoneW, 0.045, 0.08]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} /></mesh>
      <mesh position={[0, 0.045, zoneD / 2]}><boxGeometry args={[zoneW, 0.045, 0.08]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} /></mesh>
      <mesh position={[-zoneW / 2, 0.045, 0]}><boxGeometry args={[0.08, 0.045, zoneD]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} /></mesh>
      <mesh position={[zoneW / 2, 0.045, 0]}><boxGeometry args={[0.08, 0.045, zoneD]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} /></mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(zoneW, zoneD) * 0.18, Math.min(zoneW, zoneD) * 0.22, 72]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.45} transparent opacity={0.58} toneMapped={false} />
      </mesh>
      <RotatingDepartmentSign title={`${aisleLabel} · ${title}`} subtitle={desc} color={color} position={[0, 3.35, 0]} />
      <CanvasLabel text={aisleLabel} width={1.35} height={0.3} position={[-zoneW / 2 + 0.8, 0.055, -zoneD / 2 + 0.55]} rotation={[-Math.PI / 2, 0, 0]} bg={color} color="#ffffff" />
      <CanvasLabel text={title} width={Math.min(zoneW * 0.55, 3.8)} height={0.34} position={[0, 0.06, zoneD / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]} bg="rgba(255,255,255,.88)" color="#0f172a" />
    </group>
  );
};

const SupermarketDirectory: React.FC<{ categories: ExpoRetailCategory[]; width: number; depth: number; lang: Language }> = ({ categories, width, depth, lang }) => {
  if (categories.length === 0) return null;
  const title = expoPhrase(lang, 'deptGuide');
  const z = depth / 2 - 2.15;
  return (
    <group position={[Math.min(width / 2 - 2.1, 5.4), 0, z]} rotation={[0, Math.PI, 0]}>
      <RoundedBox args={[4.8, 3.05, 0.24]} radius={0.08} smoothness={3} position={[0, 1.78, 0]} castShadow>
        <meshStandardMaterial color="#0f172a" emissive="#0f172a" emissiveIntensity={0.18} metalness={0.35} roughness={0.38} />
      </RoundedBox>
      <CanvasLabel text={title} width={4.25} height={0.44} position={[0, 3.02, -0.145]} rotation={[0, Math.PI, 0]} bg="rgba(255,255,255,.1)" color="#ffffff" />
      <CanvasLabel text={title} width={4.25} height={0.44} position={[0, 3.02, 0.145]} bg="rgba(255,255,255,.1)" color="#ffffff" />
      {categories.slice(0, 8).map((cat, i) => {
        const y = 2.46 - i * 0.28;
        const label = `${expoPhrase(lang, 'aisle')} ${i + 1} · ${bi(cat.title, lang, '')}`;
        return (
          <group key={cat.id} position={[0, y, 0]}>
            <mesh position={[-2.0, 0, -0.15]}>
              <circleGeometry args={[0.065, 18]} />
              <meshBasicMaterial color={cat.color || '#16a34a'} toneMapped={false} />
            </mesh>
            <mesh position={[2.0, 0, 0.15]}>
              <circleGeometry args={[0.065, 18]} />
              <meshBasicMaterial color={cat.color || '#16a34a'} toneMapped={false} />
            </mesh>
            <CanvasLabel text={label} width={3.65} height={0.22} position={[0.12, 0, -0.155]} rotation={[0, Math.PI, 0]} bg="rgba(255,255,255,.92)" color="#0f172a" bold={false} />
            <CanvasLabel text={label} width={3.65} height={0.22} position={[-0.12, 0, 0.155]} bg="rgba(255,255,255,.92)" color="#0f172a" bold={false} />
          </group>
        );
      })}
      <mesh position={[0, 0.17, 0]}>
        <boxGeometry args={[4.45, 0.12, 0.2]} />
        <meshStandardMaterial color="#334155" metalness={0.25} roughness={0.4} />
      </mesh>
    </group>
  );
};

// The full 3D environment: image-based lighting, sky, floor + perimeter walls sized to the
// hall dimensions, an optional custom environment GLB, and every booth.
export const ExpoScene: React.FC<Props> = ({
  expo, shops = [], lang, onSelectHotspot, onSelectBooth, onFloorTeleport, onVrTeleport, onTrack,
  onRegistrationKioskClick, boothSummaries = {}, onReserveBooth,
  environmentEditMode, environmentMedia, selectedEnvMediaId, onSelectEnvMedia, onUpdateEnvMedia, onAddEnvMedia,
}) => {
  const { width, depth, height } = hallDims(expo);
  const ground = expo.groundColor || EXPO_DEFAULTS.groundColor;
  const wall = expo.wallColor || EXPO_DEFAULTS.wallColor;
  const useCustomHall = !!expo.environmentUrl && expo.environmentReplacesHall !== false;
  const envAutoFit = expo.environmentAutoFit !== false ? Math.max(width, depth) : undefined;
  const envCollision = useEnvironmentCollision();
  const registerEnvCollision = useCallback((meshes: THREE.Mesh[]) => {
    if (!envCollision) return;
    envCollision.meshesRef.current = meshes;
    envCollision.ready.current = meshes.length > 0;
    if (meshes.length) syncCollisionMatrices(envCollision.rootRef.current);
  }, [envCollision]);

  const envCollisionOn = environmentCollisionEnabled(expo);
  useEffect(() => {
    if (!envCollisionOn || !envCollision?.ready.current) return;
    syncCollisionMatrices(envCollision.rootRef.current);
  }, [
    envCollisionOn,
    envCollision,
    expo.environmentUrl,
    expo.environmentX,
    expo.environmentY,
    expo.environmentZ,
    expo.environmentRy,
    expo.environmentScale,
    expo.environmentAutoFit,
    width,
    depth,
  ]);
  const t = 0.2; // wall thickness
  const visualStyle = expo.visualStyle || 'exhibition';
  const boothVisualStyle = visualStyle === 'business_center' ? 'storefront' : visualStyle;
  const retailCategories = expo.retailCategories || [];
  const categoryById = new Map(retailCategories.map(c => [c.id, c]));
  const categoryIndexById = new Map(retailCategories.map((c, i) => [c.id, i]));
  const shopBySlug = new Map(shops.map(s => [s.slug, s]));
  const boothBySlug = new Map((expo.booths || []).filter(b => b.shopSlug).map(b => [b.shopSlug!, b]));
  const supermarketShelves: MetaverseBooth[] = (() => {
    if (visualStyle !== 'supermarket') return expo.booths || [];
    const used = new Set<string>();
    const shelves: MetaverseBooth[] = [];
    retailCategories.forEach(cat => {
      const slugs = [
        ...(cat.shopSlugs || []),
        ...(expo.booths || []).filter(b => b.categoryId === cat.id && b.shopSlug).map(b => b.shopSlug!),
      ].filter(slug => {
        if (!slug || used.has(`${cat.id}:${slug}`)) return false;
        used.add(`${cat.id}:${slug}`);
        return true;
      });
      slugs.forEach(slug => {
        const shop = shopBySlug.get(slug);
        const existing = boothBySlug.get(slug);
        const name = existing?.name || {
          fa: (shop as any)?.i18n?.fa?.title || shop?.name || shop?.title || slug,
          en: shop?.title || shop?.name || slug,
        };
        shelves.push({
          ...(existing || {}),
          id: existing?.id || `brand-shelf-${cat.id}-${slug}`,
          name,
          shopSlug: slug,
          categoryId: cat.id,
          x: existing?.x ?? 0,
          y: existing?.y ?? 0,
          z: existing?.z ?? 0,
          ry: existing?.ry ?? Math.PI,
          color: existing?.color || shop?.storefrontColor || shop?.theme?.primary || cat.color || '#16a34a',
          logo: existing?.logo || shop?.logo || undefined,
          hotspots: existing?.hotspots || [],
        });
      });
    });
    if (shelves.length) return shelves;
    return expo.booths || [];
  })();
  const boothForRender = (b: MetaverseBooth, index: number): MetaverseBooth => {
    if (visualStyle !== 'supermarket' || !b.categoryId) return b;
    const catIndex = categoryIndexById.get(b.categoryId);
    const cat = categoryById.get(b.categoryId);
    if (catIndex == null || !cat) return b;
    const zone = retailZoneFrame(cat, catIndex, retailCategories.length, width, depth);
    const categoryBooths = supermarketShelves.filter(item => item.categoryId === b.categoryId);
    const localIndex = Math.max(0, categoryBooths.findIndex(item => item.id === b.id));
    const cols = Math.min(2, Math.max(1, Math.ceil(Math.sqrt(categoryBooths.length))));
    const row = Math.floor(localIndex / cols);
    const col = localIndex % cols;
    const xStep = Math.min(5.8, zone.zoneW / Math.max(1.6, cols));
    const zStep = 2.55;
    const x = zone.x + (col - (cols - 1) / 2) * xStep;
    const zMin = zone.z - zone.zoneD / 2 + 1.8;
    const zMax = zone.z + zone.zoneD / 2 - 1.7;
    const z = Math.max(zMin, Math.min(zMax, zone.z + zone.zoneD * 0.2 - row * zStep));
    return { ...b, x: +x.toFixed(2), z: +z.toFixed(2), ry: Math.PI, scale: b.scale ?? 0.95 };
  };

  return (
    <>
      <ambientLight intensity={1.15} />
      <hemisphereLight intensity={0.9} groundColor="#ffffff" color="#ffffff" />
      <directionalLight position={[width, height * 2, depth]} intensity={0.45} />
      <directionalLight position={[-width, height * 2, -depth]} intensity={0.45} />

      {expo.skyboxUrl ? (
        <TexBoundary key={expo.skyboxUrl}>
          <Suspense fallback={null}>
            <Environment files={expo.skyboxUrl} background />
          </Suspense>
        </TexBoundary>
      ) : (
        <Sky distance={450000} sunPosition={[10, 8, 5]} turbidity={6} rayleigh={1.2} />
      )}

      <TeleportTarget onTeleport={(v: THREE.Vector3) => onVrTeleport(v)}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
          onDoubleClick={(e) => { e.stopPropagation(); onFloorTeleport(e.point.x, e.point.z); }}
        >
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color={ground} transparent={useCustomHall} opacity={useCustomHall ? 0 : 1} depthWrite={!useCustomHall} />
        </mesh>
      </TeleportTarget>
      {!useCustomHall && <Grid args={[width, depth]} cellSize={1} cellThickness={0.5} sectionSize={5} sectionThickness={1} sectionColor="#9aa3b2" cellColor="#c2c8d2" fadeDistance={Math.max(width, depth) * 1.2} position={[0, 0.01, 0]} infiniteGrid={false} />}

      {!useCustomHall && layoutCarpetRects(normalizeBoothLayout(expo.boothLayout), width, depth)
        .filter(c => !(c.entrance && c.z > depth / 2 + 0.5 && expo.entranceEnabled))
        .map((c, i) => (
        <group key={`hall-carpet-${i}`}>
          <mesh position={[c.x, c.entrance ? 0.032 : 0.025, c.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[c.w, c.d]} />
            <meshStandardMaterial
              color={c.color || (c.entrance ? EXPO_CARPET.entrance : EXPO_CARPET.main)}
              roughness={0.86}
              metalness={c.entrance ? 0.08 : 0.04}
            />
          </mesh>
          <mesh position={[c.x, c.entrance ? 0.048 : 0.04, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[Math.min(0.18, c.w * 0.08), Math.max(0.2, c.d - 0.35)]} />
            <meshBasicMaterial color={c.border || (c.entrance ? EXPO_CARPET.entranceStripe : EXPO_CARPET.border)} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {!useCustomHall && expo.entranceEnabled && <ExpoEntrance expo={expo} lang={lang} width={width} depth={depth} onTrack={onTrack} onRegistrationKioskClick={onRegistrationKioskClick} />}

      {/* Perimeter walls */}
      {!useCustomHall && (
      <>
      <Wall args={[width, height, t]} position={[0, height / 2, -depth / 2]} color={wall} />
      {expo.entranceEnabled ? (() => {
        const gap = Math.min(7, width * 0.42);
        const sideW = Math.max(0.5, (width - gap) / 2);
        const lintelH = Math.max(0.2, height - 3.4);
        return (
          <>
            <Wall args={[sideW, height, t]} position={[-gap / 2 - sideW / 2, height / 2, depth / 2]} color={wall} />
            <Wall args={[sideW, height, t]} position={[gap / 2 + sideW / 2, height / 2, depth / 2]} color={wall} />
            <Wall args={[gap, lintelH, t]} position={[0, 3.4 + lintelH / 2, depth / 2]} color={wall} />
          </>
        );
      })() : (
        <Wall args={[width, height, t]} position={[0, height / 2, depth / 2]} color={wall} />
      )}
      <Wall args={[t, height, depth]} position={[-width / 2, height / 2, 0]} color={wall} />
      <Wall args={[t, height, depth]} position={[width / 2, height / 2, 0]} color={wall} />

      {/* Dark baseboard trim around the room for a finished look */}
      <Wall args={[width, 0.25, t + 0.02]} position={[0, 0.125, -depth / 2 + 0.01]} color="#3a4150" />
      {expo.entranceEnabled ? (() => {
        const gap = Math.min(7, width * 0.42);
        const sideW = Math.max(0.5, (width - gap) / 2);
        return (
          <>
            <Wall args={[sideW, 0.25, 0.045]} position={[-gap / 2 - sideW / 2, 0.125, depth / 2 + t / 2 + 0.035]} color="#3a4150" />
            <Wall args={[sideW, 0.25, 0.045]} position={[gap / 2 + sideW / 2, 0.125, depth / 2 + t / 2 + 0.035]} color="#3a4150" />
          </>
        );
      })() : (
        <Wall args={[width, 0.25, 0.045]} position={[0, 0.125, depth / 2 + t / 2 + 0.035]} color="#3a4150" />
      )}
      <Wall args={[0.045, 0.25, depth]} position={[-width / 2 + t / 2 + 0.035, 0.125, 0]} color="#3a4150" />
      <Wall args={[0.045, 0.25, depth]} position={[width / 2 - t / 2 - 0.035, 0.125, 0]} color="#3a4150" />

      {/* Ceiling with glowing light panels */}
      <Ceiling width={width} depth={depth} height={height} />
      {/* Soft warm fill from the ceiling lights (no shadows → cheap) */}
      <pointLight position={[width * 0.25, height - 0.4, depth * 0.25]} intensity={0.5} distance={Math.max(width, depth)} color="#fff3df" />
      <pointLight position={[-width * 0.25, height - 0.4, -depth * 0.25]} intensity={0.5} distance={Math.max(width, depth)} color="#fff3df" />
      </>
      )}

      {expo.environmentUrl && (
        <TexBoundary key={`${expo.environmentUrl}-${envAutoFit ?? 0}-${expo.environmentScale ?? 1}`}>
          <Suspense fallback={null}>
            <group
              ref={envCollision?.rootRef}
              position={[expo.environmentX ?? 0, expo.environmentY ?? 0, expo.environmentZ ?? 0]}
              rotation={[0, expo.environmentRy ?? 0, 0]}
            >
              <GltfModel
                url={expo.environmentUrl}
                scale={expo.environmentScale ?? 1}
                autoFit={envAutoFit}
                forEnvironment
                onCollisionMeshes={envCollisionOn ? registerEnvCollision : undefined}
              />
            </group>
          </Suspense>
        </TexBoundary>
      )}

      {/* Custom-environment media (screens, files, buttons) */}
      {expo.environmentUrl && (environmentMedia || expo.environmentMedia || []).map(item => (
        <EnvironmentMediaItem
          key={item.id}
          item={item}
          lang={lang}
          editMode={environmentEditMode}
          selected={item.id === selectedEnvMediaId}
          onSelect={id => onSelectEnvMedia?.(id)}
          onSelectHotspot={onSelectHotspot}
          onTrack={onTrack}
        />
      ))}

      {environmentEditMode && expo.environmentUrl && onUpdateEnvMedia && onAddEnvMedia && (
        <EnvironmentEditGizmos
          hallWidth={width}
          hallDepth={depth}
          media={environmentMedia || expo.environmentMedia || []}
          selectedId={selectedEnvMediaId ?? null}
          onSelect={onSelectEnvMedia || (() => {})}
          onUpdate={onUpdateEnvMedia}
          onAdd={onAddEnvMedia}
        />
      )}

      {/* Free-placed hall decorations (GLB props) */}
      {(expo.decorations || []).map(d => (
        <ExpoDecorationMesh key={d.id} deco={d} lang={lang} onTrack={onTrack} />
      ))}

      {/* Environmental advertising banners — auto-distributed along each wall, height auto-fit. */}
      {(() => {
        const dims = { width, depth, height };
        const adScale = expo.wallAdScale ?? 1.35;
        const adLift = expo.wallAdLift ?? 2;
        const byWall: Record<string, typeof expo.wallAds> = {};
        (expo.wallAds || []).filter(a => a.enabled !== false).forEach(a => { (byWall[a.wall] = byWall[a.wall] || []).push(a); });
        const out: React.ReactElement[] = [];
        Object.keys(byWall).forEach(wall => {
          const list = byWall[wall]!;
          list.forEach((ad, i) => {
            const perAdScale = Math.max(0.2, ad.scale ?? 1);
            const w = (ad.w || 3) * adScale * perAdScale, h = (ad.h || 2) * adScale * perAdScale;
            const u = (i + 1) / (list.length + 1);                                   // even spacing along the wall
            const yc = Math.min(height - h / 2 - 0.4, Math.max(h / 2 + 1.0, height * 0.55 + adLift + (ad.lift ?? 0))); // comfortable height
            const { position, rotation } = wallTransform(wall as 'back' | 'left' | 'right' | 'front', u, yc / height, dims);
            out.push(<WallAd
              key={ad.id}
              image={ad.image}
              url={ad.url}
              title={bi(ad.title, lang, '')}
              w={w}
              h={h}
              position={position}
              rotation={rotation}
              onAdClick={() => onTrack?.('wall_ad_click', {
                targetId: ad.id,
                targetName: bi(ad.title, lang, ''),
                targetType: 'wall_ad',
                wall,
                side: wall,
              })}
            />);
          });
        });
        return out;
      })()}

      {/* Big page-turnable PDF presentation on a hall wall (default the far/end wall) */}
      {expo.presentation?.enabled && expo.presentation.pdfUrl && (() => {
        const p = expo.presentation;
        const { position, rotation } = wallTransform(p.wall || 'back', p.u ?? 0.5, p.v ?? 0.55, { width, depth, height });
        return <PresentationScreen url={p.pdfUrl!} w={p.w || Math.min(width * 0.5, 7)} h={p.h || Math.min(height * 0.6, 4)} position={position} rotation={rotation} />;
      })()}

      {/* Supermarket / mall department zones */}
      {visualStyle === 'supermarket' && retailCategories.map((cat, i) => (
        <RetailCategoryZone
          key={cat.id}
          cat={cat}
          index={i}
          total={retailCategories.length}
          width={width}
          depth={depth}
          lang={lang}
        />
      ))}
      {visualStyle === 'supermarket' && <SupermarketDirectory categories={retailCategories} width={width} depth={depth} lang={lang} />}

      {/* Brand shelves / booths — business center: current floor only */}
      {supermarketShelves.map((b, i) => {
        const renderBooth = boothForRender(b, i);
        return (
          <Booth
            key={b.id}
            booth={renderBooth}
            index={i}
            lang={lang}
            onSelectHotspot={onSelectHotspot}
            onSelectBooth={onSelectBooth}
            onTrack={onTrack}
            visualStyle={boothVisualStyle}
            hallDepth={depth}
            boothSummary={boothSummaries[b.id] || null}
            onReserveBooth={onReserveBooth}
            categoryName={renderBooth.categoryId ? bi(categoryById.get(renderBooth.categoryId)?.title, lang, '') : undefined}
            categoryColor={renderBooth.categoryId ? categoryById.get(renderBooth.categoryId)?.color : undefined}
          />
        );
      })}
    </>
  );
};
