import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { XR, createXRStore, useXR } from '@react-three/xr';
import * as THREE from 'three';
import type { MetaBazaar, MetaExpoChatMessage, MetaExpoPresence, MetaShop, MetaverseHotspot, MetaverseBooth, MetaExpoEvent } from '../../types';
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
import { logMetaExpoEvent, markMetaExpoPresenceInactive, sendMetaExpoChatMessage, subscribeMetaExpoChatMessages, subscribeMetaExpoPresence, upsertMetaExpoPresence } from '../../services/firebaseService';
import { CanvasLabel } from './CanvasLabel';

interface Props {
  bazaar: MetaBazaar;
  shops: MetaShop[];
  lang: Language;
  onExit: () => void;
  onOpenShop: (slug: string) => void;
}

type ExpoTrackFn = (type: MetaExpoEvent['type'], opts?: Partial<MetaExpoEvent>) => void;

const visitorColors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be123c', '#4f46e5'];
const liveVisitor = (bazaarId: string) => {
  const key = `_meta_expo_visitor_${bazaarId}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as { id: string; name: string; color: string };
  } catch {}
  const n = Math.floor(100 + Math.random() * 900);
  const visitor = {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Guest ${n}`,
    color: visitorColors[n % visitorColors.length],
  };
  try { localStorage.setItem(key, JSON.stringify(visitor)); } catch {}
  return visitor;
};

const RemoteAvatars: React.FC<{ visitors: MetaExpoPresence[]; selfId: string }> = ({ visitors, selfId }) => (
  <>
    {visitors.filter(v => v.visitorId !== selfId).map(v => (
      <group key={v.visitorId} position={[v.x || 0, 0, v.z || 0]} rotation={[0, v.heading || 0, 0]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.72, 8, 16]} />
          <meshStandardMaterial color={v.color || '#2563eb'} roughness={0.48} metalness={0.08} />
        </mesh>
        <mesh position={[0, 1.38, 0]} castShadow>
          <sphereGeometry args={[0.2, 24, 16]} />
          <meshStandardMaterial color="#f4c7a1" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.82, -0.24]}>
          <boxGeometry args={[0.08, 0.08, 0.18]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <CanvasLabel text={v.name || 'Guest'} width={0.95} height={0.24} position={[0, 1.72, 0]} bg="rgba(15,23,42,.82)" color="#ffffff" />
      </group>
    ))}
  </>
);

const VrPoseSync: React.FC<{ originRef: React.RefObject<THREE.Group | null>; poseRef: PlayerPoseRef }> = ({ originRef, poseRef }) => {
  const inXR = useXR((s) => !!s.session);
  useFrame(() => {
    if (!inXR || !originRef.current) return;
    const p = originRef.current.position;
    poseRef.current = { ...poseRef.current, x: p.x, z: p.z };
  });
  return null;
};

const LiveChatPanel: React.FC<{
  enabled: boolean;
  messages: MetaExpoChatMessage[];
  visitors: MetaExpoPresence[];
  visitor: { id: string; name: string; color: string };
  onSend: (text: string) => void;
  lang: Language;
}> = ({ enabled, messages, visitors, visitor, onSend, lang }) => {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const T = lang === 'fa';
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages.length, open]);
  if (!enabled) return null;
  const send = () => {
    const v = text.trim();
    if (!v) return;
    onSend(v.slice(0, 500));
    setText('');
  };
  return (
    <div className={`absolute ${T ? 'left-3' : 'right-3'} bottom-3 z-50 pointer-events-auto w-[min(360px,calc(100vw-24px))]`}>
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full rounded-2xl bg-white/95 text-gray-900 shadow-lg px-4 py-3 text-sm font-bold flex items-center justify-between">
          <span>{T ? 'چت آنلاین نمایشگاه' : 'Expo live chat'}</span>
          <span className="text-xs text-emerald-600">{visitors.length} online</span>
        </button>
      ) : (
        <div className="rounded-2xl bg-white/95 backdrop-blur shadow-2xl border border-white/70 overflow-hidden">
          <div className="px-3 py-2 bg-slate-900 text-white flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-extrabold">{T ? 'چت آنلاین نمایشگاه' : 'Expo live chat'}</div>
              <div className="text-[11px] text-white/65 truncate">{visitors.length} {T ? 'نفر آنلاین' : 'online'} · {visitor.name}</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-lg leading-none">×</button>
          </div>
          <div ref={listRef} className="h-56 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">{T ? 'هنوز پیامی ارسال نشده.' : 'No messages yet.'}</p>
            ) : messages.map(m => (
              <div key={m.id} className={`text-xs ${m.visitorId === visitor.id ? 'text-end' : 'text-start'}`}>
                <div className="font-bold mb-0.5" style={{ color: m.color || '#2563eb' }}>{m.name}</div>
                <div className={`inline-block max-w-[86%] rounded-2xl px-3 py-2 ${m.visitorId === visitor.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-100 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder={T ? 'پیام بنویسید...' : 'Write a message...'}
            />
            <button onClick={send} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">{T ? 'ارسال' : 'Send'}</button>
          </div>
        </div>
      )}
    </div>
  );
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
  const roomId = `expo_${bazaar.id}`;
  const visitor = useMemo(() => liveVisitor(bazaar.id), [bazaar.id]);
  const presenceEnabled = expo.presence?.enabled !== false;
  const chatEnabled = presenceEnabled && expo.presence?.chatEnabled !== false;
  const avatarsEnabled = presenceEnabled && expo.presence?.avatarsEnabled !== false;
  const [visitors, setVisitors] = useState<MetaExpoPresence[]>([]);
  const [messages, setMessages] = useState<MetaExpoChatMessage[]>([]);
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
    if (!presenceEnabled) return;
    const unsubPresence = subscribeMetaExpoPresence(roomId, setVisitors);
    const unsubChat = chatEnabled ? subscribeMetaExpoChatMessages(roomId, setMessages) : undefined;
    return () => { unsubPresence(); unsubChat?.(); };
  }, [chatEnabled, presenceEnabled, roomId]);

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
        name: visitor.name,
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
  }, [bazaar.id, bazaar.slug, presenceEnabled, roomId, startZ, visitor.color, visitor.id, visitor.name]);

  const sendChat = useCallback((text: string) => {
    if (!chatEnabled) return;
    sendMetaExpoChatMessage({
      id: `mec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      roomId,
      bazaarId: bazaar.id,
      bazaarSlug: bazaar.slug,
      visitorId: visitor.id,
      name: visitor.name,
      color: visitor.color,
      text,
      timestamp: new Date().toISOString(),
    });
  }, [bazaar.id, bazaar.slug, chatEnabled, roomId, visitor.color, visitor.id, visitor.name]);

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
          {avatarsEnabled && <RemoteAvatars visitors={visitors} selfId={visitor.id} />}
          <VrPoseSync originRef={originRef} poseRef={poseRef} />
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

      <LiveChatPanel enabled={chatEnabled} messages={messages} visitors={visitors} visitor={visitor} onSend={sendChat} lang={lang} />

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
