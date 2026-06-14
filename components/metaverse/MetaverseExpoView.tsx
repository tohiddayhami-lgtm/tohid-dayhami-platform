import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { XR, createXRStore, useXR } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaBazaar, MetaShop, MetaverseHotspot, MetaverseBooth, MetaExpoEvent } from '../../types';
import { Language } from '../../App';
import { bi, EXPO_DEFAULTS, hallDims } from './expoUtils';
import { makeControlState, type ControlRef, type PlayerPoseRef, type TeleportRef } from './expoControls';
import { useDeviceCapabilities } from './useDeviceCapabilities';
import { ExpoScene } from './ExpoScene';
import { Player } from './Player';
import { MobileControls } from './MobileControls';
import { Minimap } from './Minimap';
import { HotspotModal } from './HotspotModal';
import { VrRig, VRButton } from './XRControls';
import { BazaarPassageLoader } from '../BazaarPassageLoader';
import { logMetaExpoEvent } from '../../services/firebaseService';

interface Props {
  bazaar: MetaBazaar;
  shops: MetaShop[];
  lang: Language;
  onExit: () => void;
  onOpenShop: (slug: string) => void;
}

type ExpoTrackFn = (type: MetaExpoEvent['type'], opts?: Partial<MetaExpoEvent>) => void;

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
export const MetaverseExpoView: React.FC<Props> = ({ bazaar, shops, lang: initialLang, onExit }) => {
  const expo = bazaar.expo!;
  const caps = useDeviceCapabilities();
  const [lang, setLang] = useState<Language>((expo.defaultLang === 'fa' || expo.defaultLang === 'en') ? expo.defaultLang : initialLang);
  const [mode, setMode] = useState<'fp' | 'orbit'>('fp');
  const [pointerLock, setPointerLock] = useState(false);
  const [active, setActive] = useState<MetaverseHotspot | null>(null);
  const [help, setHelp] = useState(true);
  const [muted, setMuted] = useState(true);
  const [seated, setSeated] = useState(false); // VR: raise the origin so a seated visitor gets a standing viewpoint

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
  const audioRef = useRef<HTMLAudioElement>(null);
  // foveation: render the periphery at lower resolution so the headset reliably hits its frame
  // budget — this is what keeps walking smooth (no judder). The centre of vision stays sharp.
  const store = useMemo(() => createXRStore({ foveation: 1 }), []);

  const spawn: [number, number, number] = [expo.spawn?.x ?? 0, 0, startZ];
  const T = lang === 'fa';
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

  const toggleMusic = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.muted = false; a.play().catch(() => {}); setMuted(false); }
    else { a.muted = !a.muted; setMuted(a.muted); }
  };

  const ui = {
    exit: T ? 'خروج' : 'Exit',
    fp: T ? 'اول‌شخص' : 'First-person',
    orbit: T ? 'نمای کلی' : 'Overview',
    lock: T ? 'حالت غوطه‌ور' : 'Immersive',
    vr: T ? 'ورود به VR' : 'Enter VR',
    seated: T ? 'نشسته' : 'Seated',
    standing: T ? 'ایستاده' : 'Standing',
    heightHint: T ? 'ارتفاع دید برای عینک VR' : 'VR viewing height',
    helpDesktop: T ? 'با WASD/کلیدهای جهت‌دار راه بروید · با درگ ماوس نگاه کنید · دوبار کلیک روی کف = پرش · روی نشانگرها کلیک کنید' : 'WASD / arrows to move · drag to look · double-click floor to teleport · click markers',
    helpTouch: T ? 'اهرم چپ = حرکت · اهرم راست = چرخش/نگاه · روی نشانگرها و غرفه‌ها بزنید' : 'Left stick = move · right stick = look/turn · tap markers & booths',
    gotIt: T ? 'متوجه شدم' : 'Got it',
  };

  const chip = 'px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow transition-colors';

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b1020] overflow-hidden" style={{ fontFamily: 'Vazirmatn, sans-serif' }} dir={T ? 'rtl' : 'ltr'}>
      <Canvas dpr={[1, 1.5]} camera={{ fov: 72, near: 0.1, far: 2000, position: spawn }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <XR store={store}>
          <Suspense fallback={null}>
            <ExpoScene
              expo={expo}
              lang={lang}
              onSelectHotspot={setActive}
              onSelectBooth={onSelectBooth}
              onFloorTeleport={(x, z) => teleportRef.current?.(x, z)}
              onVrTeleport={(v) => { originRef.current?.position.copy(v); }}
              onTrack={trackExpoEvent}
            />
          </Suspense>
          <ExpoAnalyticsTracker bazaar={bazaar} expo={expo} lang={lang} onTrack={trackExpoEvent} />
          <Player expo={expo} mode={mode} pointerLock={pointerLock} controlRef={controlRef} poseRef={poseRef} teleportRef={teleportRef} />
          <VrRig originRef={originRef} spawn={spawn} eyeOffsetY={seated ? 0.55 : 0} />
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
          <button onClick={() => setLang(l => l === 'fa' ? 'en' : 'fa')} className={chip + ' bg-white/90 text-gray-900 hover:bg-white'}>{T ? 'EN' : 'فا'}</button>
          <button onClick={() => setMode(m => m === 'fp' ? 'orbit' : 'fp')} className={chip + ' bg-white/90 text-gray-900 hover:bg-white'}>{mode === 'fp' ? '🛰 ' + ui.orbit : '🚶 ' + ui.fp}</button>
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

      {/* Minimap */}
      <Minimap expo={expo} poseRef={poseRef} />

      {/* Mobile joysticks — left = move, right = look/turn */}
      {caps.touch && <MobileControls controlRef={controlRef} kind="move" />}
      {caps.touch && <MobileControls controlRef={controlRef} kind="look" />}

      {/* Help hint */}
      {help && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[90vw]">
          <div className="bg-black/55 text-white text-xs md:text-sm rounded-xl px-4 py-2.5 backdrop-blur flex items-center gap-3 shadow-lg">
            <span>{caps.touch ? ui.helpTouch : ui.helpDesktop}</span>
            <button onClick={() => setHelp(false)} className="shrink-0 px-2.5 py-1 rounded-lg bg-white/90 text-gray-900 font-bold">{ui.gotIt}</button>
          </div>
        </div>
      )}

      {/* Hotspot modal */}
      <HotspotModal hotspot={active} shops={shops} lang={lang} onClose={() => setActive(null)} onOpenShop={openShopNewTab} />

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
