import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { XR, createXRStore, useXR } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaBazaar, MetaExpoPresence, MetaShop, MetaShopProduct, MetaverseHotspot, MetaverseBooth, MetaExpoEvent, ExpoDecoration, ExpoEnvironmentMedia, ExpoEnvironmentMediaKind } from '../../types';
import { Language } from '../../App';
import { bi, EXPO_DEFAULTS, hallDims, resolveExpoLanguages, isRtlExpoLang, expoUi, expoPhrase, collectExpoSlideshowShopSlugs, filterProductsForSlideshowHydrate } from './expoUtils';
import { hydrateMetaShop } from '../../services/firebaseService';
import { makeControlState, resetControlState, type ControlRef, type PlayerPoseRef, type TeleportRef } from './expoControls';
import { useDeviceCapabilities } from './useDeviceCapabilities';
import { ExpoScene } from './ExpoScene';
import { Player } from './Player';
import { MobileControls } from './MobileControls';
import { Minimap } from './Minimap';
import { HotspotModal } from './HotspotModal';
import { EntranceRegistrationModal } from './EntranceRegistrationModal';
import { BoothReservationModal } from './BoothReservationModal';
import { VrRig, VRButton } from './XRControls';
import { EnvironmentCollisionProvider } from './EnvironmentCollisionContext';
import { VrEnvironmentCollision } from './VrEnvironmentCollision';
import { VrWalkLocomotion, VrFlyLocomotion, VrFlyJumpLocomotion, VrFlyModeToggle } from './VrExpoLocomotion';
import { ExpoFlyControls } from './ExpoFlyControls';
import { EnvironmentEditToolbar, type EnvEditSelection, type EnvEditTransform } from './EnvironmentEditMode';
import { BazaarPassageLoader } from '../BazaarPassageLoader';
import { logMetaExpoEvent, markMetaExpoPresenceInactive, subscribeMetaExpoBoothReservations, subscribeMetaExpoPresence, upsertMetaExpoPresence } from '../../services/firebaseService';
import { summarizeBoothReservations, type BoothReservationSummary } from '../../utils/boothReservationUtils';
import { CanvasLabel } from './CanvasLabel';

interface Props {
  bazaar: MetaBazaar;
  shops: MetaShop[];
  lang: Language;
  onExit: () => void;
  onOpenShop: (slug: string) => void;
  environmentEditMode?: boolean;
  onSaveExpo?: (expo: MetaBazaar['expo']) => Promise<void>;
}

type ExpoTrackFn = (type: MetaExpoEvent['type'], opts?: Partial<MetaExpoEvent>) => void;

const visitorColors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be123c', '#4f46e5'];
type ExpoVisitor = { id: string; name: string; color: string; company?: string; jobTitle?: string };
const liveVisitor = (bazaarId: string): ExpoVisitor => {
  const key = `_meta_expo_visitor_${bazaarId}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as ExpoVisitor;
  } catch {}
  const n = Math.floor(100 + Math.random() * 900);
  const visitor: ExpoVisitor = {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Guest ${n}`,
    color: visitorColors[n % visitorColors.length],
  };
  try { localStorage.setItem(key, JSON.stringify(visitor)); } catch {}
  return visitor;
};

const truncBadge = (s: string, max: number) => {
  const t = (s || '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const VisitorAvatarLabels: React.FC<{ v: MetaExpoPresence }> = ({ v }) => {
  const registered = !!(v.company || v.jobTitle);
  if (!registered) {
    return <CanvasLabel text={v.name || 'Guest'} width={0.9} height={0.22} position={[0, 1.98, 0]} bg="rgba(15,23,42,.78)" color="#ffffff" />;
  }
  return (
    <>
      {v.company && (
        <CanvasLabel text={truncBadge(v.company, 20)} width={0.58} height={0.1} position={[0, 2.24, 0]} bg="rgba(15,23,42,.58)" color="#cbd5e1" bold={false} radius={10} />
      )}
      <CanvasLabel text={truncBadge(v.name, 18)} width={0.64} height={0.13} position={[0, 2.1, 0]} bg="rgba(15,23,42,.72)" color="#ffffff" bold={false} radius={12} />
      {v.jobTitle && (
        <CanvasLabel text={truncBadge(v.jobTitle, 16)} width={0.5} height={0.09} position={[0, 1.97, 0]} bg="rgba(15,23,42,.5)" color="#94a3b8" bold={false} radius={8} />
      )}
    </>
  );
};

const RemoteAvatars: React.FC<{ visitors: MetaExpoPresence[]; selfId: string }> = ({ visitors, selfId }) => (
  <>
    {visitors.filter(v => v.visitorId !== selfId).map(v => (
      <group key={v.visitorId} position={[v.x || 0, 0, v.z || 0]} rotation={[0, v.heading || 0, 0]}>
        <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.34, 0.43, 48]} />
          <meshBasicMaterial color={v.color || '#38bdf8'} transparent opacity={0.82} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.86, 0]}>
          <cylinderGeometry args={[0.13, 0.28, 1.55, 36, 1, true]} />
          <meshBasicMaterial color={v.color || '#38bdf8'} transparent opacity={0.18} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.12, 0]} castShadow>
          <sphereGeometry args={[0.2, 32, 16]} />
          <meshStandardMaterial color="#f8fafc" emissive={v.color || '#38bdf8'} emissiveIntensity={0.35} metalness={0.18} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.68, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.42, 32]} />
          <meshStandardMaterial color="#e2e8f0" emissive={v.color || '#38bdf8'} emissiveIntensity={0.12} metalness={0.35} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28, 0.31, 48]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.72} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <VisitorAvatarLabels v={v} />
      </group>
    ))}
  </>
);

const VrPoseSync: React.FC<{ originRef: React.RefObject<THREE.Group | null>; poseRef: PlayerPoseRef; xrActiveRef?: React.MutableRefObject<boolean> }> = ({ originRef, poseRef, xrActiveRef }) => {
  const inXR = useXR((s) => !!s.session);
  useEffect(() => { if (xrActiveRef) xrActiveRef.current = inXR; }, [inXR, xrActiveRef]);
  useFrame(() => {
    if (xrActiveRef) xrActiveRef.current = inXR;
    if (!inXR || !originRef.current) return;
    const p = originRef.current.position;
    poseRef.current = { ...poseRef.current, x: p.x, z: p.z };
  });
  return null;
};

const ExpoAnalyticsTracker: React.FC<{
  bazaar: MetaBazaar;
  expo: MetaBazaar['expo'];
  lang: Language;
  onTrack: ExpoTrackFn;
}> = ({ bazaar, expo, lang, onTrack }) => {
  const { camera } = useThree();
  const inXR = useXR((s) => !!s.session);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const dwellRef = useRef<Record<string, number>>({});
  const boothMetaRef = useRef<Record<string, { boothId: string; boothName: string; boothIndex: number }>>({});

  useEffect(() => {
    if (inXR) onTrack('vr_enter', { isVr: true, language: lang });
  }, [inXR, lang, onTrack]);

  const flushDwell = useCallback(() => {
    const entries = Object.entries(dwellRef.current).filter(([, sec]) => sec >= 1.5);
    dwellRef.current = {};
    entries.forEach(([boothId, sec]) => {
      const meta = boothMetaRef.current[boothId];
      if (!meta) return;
      onTrack('booth_dwell', { ...meta, dwellSec: +sec.toFixed(1), isVr: inXR, language: lang });
    });
  }, [inXR, lang, onTrack]);

  useEffect(() => {
    const id = window.setInterval(flushDwell, 12000);
    const onHidden = () => { if (document.visibilityState === 'hidden') flushDwell(); };
    window.addEventListener('beforeunload', flushDwell);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('beforeunload', flushDwell);
      document.removeEventListener('visibilitychange', onHidden);
      flushDwell();
    };
  }, [flushDwell]);

  useFrame((_, dtRaw) => {
    const booths = expo?.booths || [];
    if (!booths.length) return;
    const dt = Math.min(dtRaw, 0.25);
    camera.getWorldPosition(pos);
    let best: MetaverseBooth | null = null;
    let bestIndex = -1;
    let bestD2 = Infinity;
    booths.forEach((b, i) => {
      const dx = pos.x - (b.x || 0);
      const dz = pos.z - (b.z || 0);
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { best = b; bestIndex = i; bestD2 = d2; }
    });
    if (!best || bestD2 > 12.25) return; // roughly 3.5m around the booth/counter
    const boothId = best.id;
    const boothName = bi(best.name, lang, best.name?.fa || best.name?.en || `Booth ${bestIndex + 1}`);
    boothMetaRef.current[boothId] = { boothId, boothName, boothIndex: bestIndex };
    dwellRef.current[boothId] = (dwellRef.current[boothId] || 0) + dt;
  });

  return null;
};

// Full-screen 3D / WebXR exhibition viewer. Orchestrates the Canvas (scene + player + XR rig)
// and all 2D chrome (top bar, minimap, joystick, hotspot modal). Lazy-loaded by App.tsx.
export const MetaverseExpoView: React.FC<Props> = ({ bazaar, shops, lang: initialLang, onExit, onOpenShop, environmentEditMode = false, onSaveExpo }) => {
  const expo = bazaar.expo!;
  const slideshowSlugs = useMemo(
    () => collectExpoSlideshowShopSlugs(expo.booths),
    [expo.booths],
  );
  const [slideshowProducts, setSlideshowProducts] = useState<Record<string, MetaShopProduct[]>>({});

  useEffect(() => {
    if (!slideshowSlugs.length) {
      setSlideshowProducts({});
      return;
    }
    let cancelled = false;
    (async () => {
      const next: Record<string, MetaShopProduct[]> = {};
      await Promise.all(slideshowSlugs.map(async slug => {
        const shell = shops.find(s => s.slug === slug);
        if (!shell) return;
        try {
          const full = await hydrateMetaShop(shell);
          const list = filterProductsForSlideshowHydrate(full?.products || [], expo.booths, slug);
          if (list.length) next[slug] = list;
        } catch { /* skip */ }
      }));
      if (!cancelled) setSlideshowProducts(next);
    })();
    return () => { cancelled = true; };
  }, [slideshowSlugs.join('|'), shops]);

  const shopsForScene = useMemo(() => shops.map(s => {
    const hydrated = slideshowProducts[s.slug];
    if (hydrated?.length) return { ...s, products: hydrated };
    return s;
  }), [shops, slideshowProducts]);
  const caps = useDeviceCapabilities();
  const expoLangs = useMemo(() => resolveExpoLanguages(expo), [expo.languages]);
  const defaultExpoLang = expo.defaultLang && expoLangs.some(l => l.code === expo.defaultLang)
    ? expo.defaultLang
    : (expoLangs[0]?.code || 'en');
  const [lang, setLang] = useState<string>(defaultExpoLang);
  const [mode, setMode] = useState<'fp' | 'orbit'>('fp');
  const [pointerLock, setPointerLock] = useState(false);
  const [active, setActive] = useState<MetaverseHotspot | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [reserveBooth, setReserveBooth] = useState<MetaverseBooth | null>(null);
  const [boothSummaries, setBoothSummaries] = useState<Record<string, BoothReservationSummary>>({});
  const [help, setHelp] = useState(true);
  const [muted, setMuted] = useState(true);
  const [flyMode, setFlyMode] = useState(environmentEditMode);
  const [seated, setSeated] = useState(false);
  const [envMedia, setEnvMedia] = useState<ExpoEnvironmentMedia[]>(expo.environmentMedia || []);
  const [editDecorations, setEditDecorations] = useState<ExpoDecoration[]>(expo.decorations || []);
  const [editSelection, setEditSelection] = useState<EnvEditSelection>(null);
  const [envSaving, setEnvSaving] = useState(false);
  const controlsPaused = registrationOpen || !!reserveBooth || !!active;

  const newEnvMediaId = () => `em-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;

  const updEnvMediaItem = useCallback((id: string, patch: Partial<ExpoEnvironmentMedia>) => {
    setEnvMedia(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  const updDecorationItem = useCallback((id: string, patch: Partial<ExpoDecoration>) => {
    setEditDecorations(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }, []);

  const onUpdateEditTransform = useCallback((patch: Partial<EnvEditTransform>) => {
    if (!editSelection) return;
    if (editSelection.kind === 'media') updEnvMediaItem(editSelection.id, patch);
    else updDecorationItem(editSelection.id, patch);
  }, [editSelection, updEnvMediaItem, updDecorationItem]);

  const onPatchSelected = useCallback((patch: Partial<ExpoEnvironmentMedia> | Partial<ExpoDecoration>) => {
    if (!editSelection) return;
    if (editSelection.kind === 'media') updEnvMediaItem(editSelection.id, patch as Partial<ExpoEnvironmentMedia>);
    else updDecorationItem(editSelection.id, patch as Partial<ExpoDecoration>);
  }, [editSelection, updEnvMediaItem, updDecorationItem]);

  const addEnvMedia = useCallback((kind: ExpoEnvironmentMediaKind) => {
    const item: ExpoEnvironmentMedia = {
      id: newEnvMediaId(),
      kind,
      x: 0,
      y: 1.5,
      z: 0,
      w: kind === 'button' ? 0.8 : 2,
      h: kind === 'button' ? 0.8 : 1.2,
      scale: 1,
      title: { fa: kind === 'button' ? 'دکمه' : 'رسانه', en: kind === 'button' ? 'Button' : 'Media' },
      ...(kind === 'button' ? { action: 'whatsapp', icon: '💬' } : {}),
    };
    setEnvMedia(prev => [...prev, item]);
    setEditSelection({ kind: 'media', id: item.id });
  }, []);

  const addEnvMediaAt = useCallback((kind: ExpoEnvironmentMediaKind, at: { x: number; y: number; z: number }) => {
    const item: ExpoEnvironmentMedia = {
      id: newEnvMediaId(),
      kind,
      x: at.x,
      y: at.y,
      z: at.z,
      w: kind === 'button' ? 0.8 : 2,
      h: kind === 'button' ? 0.8 : 1.2,
      scale: 1,
      title: { fa: kind === 'button' ? 'دکمه' : 'رسانه', en: kind === 'button' ? 'Button' : 'Media' },
      ...(kind === 'button' ? { action: 'whatsapp', icon: '💬' } : {}),
    };
    setEnvMedia(prev => [...prev, item]);
    setEditSelection({ kind: 'media', id: item.id });
  }, []);

  const deleteSelectedEdit = useCallback(() => {
    if (!editSelection) return;
    if (editSelection.kind === 'media') {
      setEnvMedia(prev => prev.filter(m => m.id !== editSelection.id));
    } else {
      setEditDecorations(prev => prev.filter(d => d.id !== editSelection.id));
    }
    setEditSelection(null);
  }, [editSelection]);

  useEffect(() => {
    if (!environmentEditMode) return;
    const onDeleteKey = () => deleteSelectedEdit();
    window.addEventListener('expo-env-edit-delete', onDeleteKey);
    return () => window.removeEventListener('expo-env-edit-delete', onDeleteKey);
  }, [environmentEditMode, deleteSelectedEdit]);

  const saveEnvMedia = useCallback(async () => {
    if (!onSaveExpo) return;
    setEnvSaving(true);
    try {
      await onSaveExpo({ ...expo, environmentMedia: envMedia, decorations: editDecorations });
      alert(isRtlExpoLang(lang, expoLangs) ? 'محیط ذخیره شد.' : 'Environment saved.');
    } catch {
      alert(isRtlExpoLang(lang, expoLangs) ? 'خطا در ذخیره' : 'Save failed.');
    } finally {
      setEnvSaving(false);
    }
  }, [onSaveExpo, expo, envMedia, editDecorations, lang, expoLangs]);

  const exitEnvEdit = useCallback(() => {
    try { sessionStorage.removeItem('expo_env_edit_bazaar'); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.delete('env-edit');
    window.location.href = url.toString();
  }, []);

  // ── "Mall doors opening" reveal: keep the doors shut until scene assets finish loading,
  // then slide them apart and remove the overlay. A hard cap prevents getting stuck. ──
  const { active: loadActive } = useProgress();
  const [openDoors, setOpenDoors] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!loadActive) { const t = setTimeout(() => setOpenDoors(true), 650); return () => clearTimeout(t); }
  }, [loadActive]);
  useEffect(() => { const cap = setTimeout(() => setOpenDoors(true), 7000); return () => clearTimeout(cap); }, []);
  useEffect(() => { if (openDoors) { const t = setTimeout(() => setRevealed(true), 1250); return () => clearTimeout(t); } }, [openDoors]);

  const { depth } = hallDims(expo);
  const startZ = expo.entranceEnabled ? depth / 2 + 6.2 : (expo.spawn?.z ?? Math.min(depth / 2 - 2, 8));
  const startRy = expo.entranceEnabled ? 0 : (expo.spawn?.ry ?? Math.PI);
  const controlRef: ControlRef = useRef(makeControlState());
  const poseRef: PlayerPoseRef = useRef({ x: expo.spawn?.x ?? 0, z: startZ, heading: startRy });
  const teleportRef: TeleportRef = useRef(null);
  const originRef = useRef<THREE.Group>(null);
  const xrActiveRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  // foveation: render the periphery at lower resolution so the headset reliably hits its frame
  // budget — this is what keeps walking smooth (no judder). The centre of vision stays sharp.
  const store = useMemo(() => createXRStore({ foveation: 1 }), []);

  const spawn: [number, number, number] = [
    expo.spawn?.x ?? 0,
    EXPO_DEFAULTS.eyeHeight,
    startZ,
  ];
  const T = isRtlExpoLang(lang, expoLangs);
  const roomId = `expo_${bazaar.id}`;
  const visitor = useMemo(() => liveVisitor(bazaar.id), [bazaar.id]);
  const [visitorName, setVisitorName] = useState(visitor.name);
  const [visitorCompany, setVisitorCompany] = useState(visitor.company || '');
  const [visitorJobTitle, setVisitorJobTitle] = useState(visitor.jobTitle || '');
  const displayName = visitorName || visitor.name;
  const presenceEnabled = expo.presence?.enabled !== false;
  const avatarsEnabled = presenceEnabled && expo.presence?.avatarsEnabled !== false;
  const [visitors, setVisitors] = useState<MetaExpoPresence[]>([]);
  const latestPresenceRef = useRef<MetaExpoPresence | null>(null);
  const trackExpoEvent: ExpoTrackFn = useCallback((type, opts = {}) => {
    logMetaExpoEvent(type, { id: bazaar.id, slug: bazaar.slug, name: bazaar.name }, opts);
  }, [bazaar.id, bazaar.slug, bazaar.name]);

  useEffect(() => {
    trackExpoEvent('visit', { language: lang, isVr: false });
  }, [trackExpoEvent]);

  const langDidMount = useRef(false);
  useEffect(() => {
    if (!langDidMount.current) { langDidMount.current = true; return; }
    trackExpoEvent('language_change', { language: lang });
  }, [lang, trackExpoEvent]);

  // Open a shop in a NEW TAB so the exhibition stays open behind it (hyperlinks shouldn't
  // navigate away from the 3D hall).
  const openShopNewTab = (slug: string) => {
    const href = `${window.location.origin}${window.location.pathname}?shop=${encodeURIComponent(slug)}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };
  const onSelectBooth = (b: MetaverseBooth) => { if (b.shopSlug) openShopNewTab(b.shopSlug); };

  useEffect(() => {
    if (!controlsPaused) return;
    setPointerLock(false);
    resetControlState(controlRef.current);
  }, [controlsPaused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || controlsPaused || mode !== 'fp') return;
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      setFlyMode(f => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controlsPaused, mode]);

  useEffect(() => {
    return subscribeMetaExpoBoothReservations(bazaar.id, (list) => {
      setBoothSummaries(summarizeBoothReservations(list));
    });
  }, [bazaar.id]);

  useEffect(() => {
    if (!presenceEnabled) return;
    const unsubPresence = subscribeMetaExpoPresence(roomId, setVisitors);
    return () => { unsubPresence(); };
  }, [presenceEnabled, roomId]);

  useEffect(() => {
    if (!presenceEnabled) return;
    const pushPresence = () => {
      const pose = poseRef.current;
      const presence: MetaExpoPresence = {
        id: `${roomId}_${visitor.id}`,
        roomId,
        bazaarId: bazaar.id,
        bazaarSlug: bazaar.slug,
        visitorId: visitor.id,
        name: displayName,
        company: visitorCompany || undefined,
        jobTitle: visitorJobTitle || undefined,
        color: visitor.color,
        x: pose.x,
        z: pose.z,
        heading: pose.heading,
        isVr: !!originRef.current && Math.abs(originRef.current.position.z - startZ) > 0.02,
        lastSeen: new Date().toISOString(),
        active: true,
      };
      latestPresenceRef.current = presence;
      upsertMetaExpoPresence(presence);
    };
    pushPresence();
    const id = window.setInterval(pushPresence, 2500);
    const markInactive = () => { if (latestPresenceRef.current) markMetaExpoPresenceInactive(latestPresenceRef.current); };
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') markInactive(); else pushPresence(); };
    window.addEventListener('beforeunload', markInactive);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('beforeunload', markInactive);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      markInactive();
    };
  }, [bazaar.id, bazaar.slug, presenceEnabled, roomId, startZ, visitor.color, visitor.id, displayName, visitorCompany, visitorJobTitle]);

  const toggleMusic = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.muted = false; a.play().catch(() => {}); setMuted(false); }
    else { a.muted = !a.muted; setMuted(a.muted); }
  };

  const ui = {
    exit: expoUi(lang, 'exit'),
    fp: expoUi(lang, 'fp'),
    orbit: expoUi(lang, 'orbit'),
    lock: expoUi(lang, 'lock'),
    vr: expoUi(lang, 'vr'),
    seated: expoUi(lang, 'seated'),
    standing: expoUi(lang, 'standing'),
    heightHint: expoUi(lang, 'heightHint'),
    helpDesktop: expoUi(lang, 'helpDesktop'),
    helpTouch: expoUi(lang, 'helpTouch'),
    gotIt: expoUi(lang, 'gotIt'),
    helpVr: expoUi(lang, 'helpVr'),
    fly: expoUi(lang, 'fly'),
    flyOn: expoUi(lang, 'flyOn'),
    flyOff: expoUi(lang, 'flyOff'),
  };

  const chip = 'px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow transition-colors';

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b1020] overflow-hidden" style={{ fontFamily: 'Vazirmatn, sans-serif' }} dir={T ? 'rtl' : 'ltr'}>
      <Canvas
        dpr={expo.environmentUrl ? [1, 1.25] : [1, 1.5]}
        camera={{ fov: 72, near: 0.1, far: 2000, position: spawn }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <XR store={store}>
          <EnvironmentCollisionProvider>
          <Suspense fallback={null}>
            <ExpoScene
              expo={expo}
              shops={shopsForScene}
              lang={lang}
              onSelectHotspot={setActive}
              onSelectBooth={onSelectBooth}
              onFloorTeleport={(x, z) => teleportRef.current?.(x, z)}
              onVrTeleport={(v) => { originRef.current?.position.copy(v); }}
              onTrack={trackExpoEvent}
              onRegistrationKioskClick={() => setRegistrationOpen(true)}
              boothSummaries={boothSummaries}
              onReserveBooth={setReserveBooth}
              environmentEditMode={environmentEditMode}
              environmentMedia={envMedia}
              editDecorations={editDecorations}
              editSelection={editSelection}
              onSelectEditMedia={id => setEditSelection({ kind: 'media', id })}
              onSelectEditDecoration={id => setEditSelection({ kind: 'decoration', id })}
              onDeselectEdit={() => setEditSelection(null)}
              onUpdateEditTransform={onUpdateEditTransform}
              onAddEnvMedia={addEnvMediaAt}
            />
          </Suspense>
          <ExpoAnalyticsTracker bazaar={bazaar} expo={expo} lang={lang} onTrack={trackExpoEvent} />
          <Player expo={expo} mode={mode} pointerLock={pointerLock} flyMode={flyMode} controlsPaused={controlsPaused} controlRef={controlRef} poseRef={poseRef} teleportRef={teleportRef} />
          {avatarsEnabled && <RemoteAvatars visitors={visitors} selfId={visitor.id} />}
          <VrPoseSync originRef={originRef} poseRef={poseRef} xrActiveRef={xrActiveRef} />
          {!flyMode && <VrWalkLocomotion originRef={originRef} />}
          {flyMode && <VrFlyLocomotion originRef={originRef} eyeOffsetY={seated ? 0.55 : 0} />}
          <VrFlyJumpLocomotion expo={expo} originRef={originRef} flyMode={flyMode} eyeOffsetY={seated ? 0.55 : 0} />
          {!flyMode && <VrEnvironmentCollision expo={expo} originRef={originRef} eyeOffsetY={seated ? 0.55 : 0} />}
          {mode === 'fp' && <VrFlyModeToggle onToggle={() => setFlyMode(f => !f)} />}
          <VrRig originRef={originRef} spawn={spawn} eyeOffsetY={seated ? 0.55 : 0} />
          </EnvironmentCollisionProvider>
        </XR>
      </Canvas>

      {/* Crosshair while in immersive pointer-lock mode */}
      {pointerLock && mode === 'fp' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 8, height: 8, marginTop: -4, marginInlineStart: -4, borderRadius: '50%', border: '2px solid rgba(255,255,255,.8)', pointerEvents: 'none', zIndex: 30 }} />
      )}

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-40 flex items-center justify-between gap-2 p-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={onExit} className={chip + ' bg-white/90 text-gray-900 hover:bg-white'}>← {ui.exit}</button>
          <div className="px-3 py-2 rounded-lg bg-black/40 text-white text-sm font-bold backdrop-blur max-w-[40vw] truncate">{bi(expo.title, lang, bazaar.name)}</div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap justify-end">
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className={chip + ' bg-white/90 text-gray-900 hover:bg-white cursor-pointer max-w-[9rem] truncate'}
            title={expoLangs.find(l => l.code === lang)?.name || lang}
          >
            {expoLangs.map(l => (
              <option key={l.code} value={l.code}>{l.name || l.code}</option>
            ))}
          </select>
          <button onClick={() => setMode(m => m === 'fp' ? 'orbit' : 'fp')} className={chip + ' bg-white/90 text-gray-900 hover:bg-white'}>{mode === 'fp' ? '🛰 ' + ui.orbit : '🚶 ' + ui.fp}</button>
          {mode === 'fp' && (
            <button
              onClick={() => setFlyMode(f => !f)}
              title={flyMode ? ui.flyOff : ui.flyOn}
              className={chip + (flyMode ? ' bg-sky-600 text-white' : ' bg-white/90 text-gray-900 hover:bg-white')}
            >
              {flyMode ? '🪶 ' + ui.fly : '✈️ ' + ui.fly}
            </button>
          )}
          {caps.finePointer && mode === 'fp' && (
            <button onClick={() => setPointerLock(p => !p)} className={chip + (pointerLock ? ' bg-indigo-600 text-white' : ' bg-white/90 text-gray-900 hover:bg-white')}>🔒 {ui.lock}</button>
          )}
          {expo.music && <button onClick={toggleMusic} className={chip + ' bg-white/90 text-gray-900 hover:bg-white'}>{muted ? '🔇' : '🔊'}</button>}
          {caps.vrSupported && (
            <button onClick={() => setSeated(s => !s)} title={ui.heightHint} className={chip + (seated ? ' bg-indigo-600 text-white' : ' bg-white/90 text-gray-900 hover:bg-white')}>
              {seated ? '🪑 ' + ui.seated : '🧍 ' + ui.standing}
            </button>
          )}
          {caps.vrSupported && <VRButton store={store} label={ui.vr} />}
        </div>
      </div>

      {environmentEditMode && (
        <EnvironmentEditToolbar
          langFa={T}
          mediaCount={envMedia.length}
          decorationCount={editDecorations.length}
          selection={editSelection}
          selectedMedia={editSelection?.kind === 'media' ? envMedia.find(m => m.id === editSelection.id) || null : null}
          selectedDecoration={editSelection?.kind === 'decoration' ? editDecorations.find(d => d.id === editSelection.id) || null : null}
          saving={envSaving}
          onAdd={addEnvMedia}
          onDelete={deleteSelectedEdit}
          onSave={saveEnvMedia}
          onExit={exitEnvEdit}
          onPatchSelected={onPatchSelected}
        />
      )}

      {/* Minimap */}
      <Minimap expo={expo} poseRef={poseRef} />

      {/* Mobile joysticks — left = move, right = look/turn */}
      {!controlsPaused && caps.touch && mode === 'fp' && <MobileControls controlRef={controlRef} kind="move" />}
      {!controlsPaused && caps.touch && mode === 'fp' && <MobileControls controlRef={controlRef} kind="look" />}
      {!controlsPaused && caps.touch && mode === 'fp' && <ExpoFlyControls controlRef={controlRef} flyMode={flyMode} langFa={T} />}

      {/* Help hint */}
      {help && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[90vw]">
          <div className="bg-black/55 text-white text-xs md:text-sm rounded-xl px-4 py-2.5 backdrop-blur flex items-center gap-3 shadow-lg">
            <span>{caps.vrSupported ? ui.helpVr : caps.touch ? ui.helpTouch : ui.helpDesktop}</span>
            <button onClick={() => setHelp(false)} className="shrink-0 px-2.5 py-1 rounded-lg bg-white/90 text-gray-900 font-bold">{ui.gotIt}</button>
          </div>
        </div>
      )}

      {/* Hotspot modal */}
      <HotspotModal hotspot={active} shops={shops} lang={lang} onClose={() => setActive(null)} onOpenShop={openShopNewTab} />
      <EntranceRegistrationModal
        open={registrationOpen && !!expo.entranceEnabled && expo.entranceRegistration?.enabled !== false}
        bazaar={bazaar}
        visitorId={visitor.id}
        lang={lang}
        title={bi(expo.entranceRegistration?.title, lang, expoPhrase(lang, 'visitorReg'))}
        onClose={() => setRegistrationOpen(false)}
        onSubmitted={(profile) => {
          setVisitorName(profile.name);
          setVisitorCompany(profile.company);
          setVisitorJobTitle(profile.jobTitle);
          try {
            const key = `_meta_expo_visitor_${bazaar.id}`;
            const saved = localStorage.getItem(key);
            const parsed = saved ? JSON.parse(saved) : { ...visitor };
            parsed.name = profile.name;
            parsed.company = profile.company;
            parsed.jobTitle = profile.jobTitle;
            localStorage.setItem(key, JSON.stringify(parsed));
          } catch {}
        }}
        onTrack={trackExpoEvent}
      />
      <BoothReservationModal
        open={!!reserveBooth}
        bazaar={bazaar}
        booth={reserveBooth}
        visitorId={visitor.id}
        lang={lang}
        onClose={() => setReserveBooth(null)}
        onReserved={() => setReserveBooth(null)}
        onTrack={trackExpoEvent}
      />
      {/* Ambient music (starts muted; unmuted via the 🔊 button to satisfy autoplay policies) */}
      {expo.music && <audio ref={audioRef} src={expo.music} loop muted />}

      {/* Minimal container-ship loader (same as the Meta Shop pages) — fades out once the scene
          is ready, then unmounts. */}
      {!revealed && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, opacity: openDoors ? 0 : 1, transition: 'opacity .9s ease', pointerEvents: openDoors ? 'none' : 'auto' }}>
          <BazaarPassageLoader lang={lang} title={bi(expo.title, lang, bazaar.name)} />
        </div>
      )}
    </div>
  );
};
