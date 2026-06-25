import React, { useEffect, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useXR, useXRStore } from '@react-three/xr';
import * as THREE from 'three';
import type { ExpoDecoration, ExpoEnvironmentMedia, ExpoEnvironmentMediaKind } from '../../types';
import { getXrController, readVrStick, readXrThumbstick, resolveVrGamepads } from './expoLocomotion';

export const ENV_EDIT_SESSION_KEY = 'expo_env_edit_bazaar';

export type EnvEditTransform = {
  id: string;
  x: number;
  y: number;
  z: number;
  ry?: number;
  scale?: number;
};

export type EnvEditSelection =
  | { kind: 'media'; id: string }
  | { kind: 'decoration'; id: string }
  | null;

interface Props {
  hallWidth: number;
  hallDepth: number;
  selected: EnvEditTransform | null;
  onDeselect: () => void;
  onUpdate: (patch: Partial<EnvEditTransform>) => void;
  onAdd?: (kind: ExpoEnvironmentMediaKind, at: { x: number; y: number; z: number }) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** In-scene helpers for placing & transforming hall objects (desktop + VR). */
export const EnvironmentEditGizmos: React.FC<Props> = ({
  hallWidth, hallDepth, selected, onDeselect, onUpdate, onAdd,
}) => {
  const inXR = useXR((s) => !!s.session);
  const xrStore = useXRStore();
  const dragRef = useRef<{ offset: THREE.Vector3 } | null>(null);
  const rotateRef = useRef(false);

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (dragRef.current || rotateRef.current) return;
    if (!selected && onAdd) {
      onAdd('image', { x: e.point.x, y: 1.5, z: e.point.z });
      return;
    }
    onDeselect();
  };

  const beginDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!selected) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const offset = new THREE.Vector3(selected.x - e.point.x, 0, selected.z - e.point.z);
    dragRef.current = { offset };
  };

  const onDragMove = (e: ThreeEvent<PointerEvent>) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    onUpdate({
      x: clamp(e.point.x + d.offset.x, -hallWidth / 2 + 0.5, hallWidth / 2 - 0.5),
      z: clamp(e.point.z + d.offset.z, -hallDepth / 2 + 0.5, hallDepth / 2 - 0.5),
    });
  };

  const endDrag = () => { dragRef.current = null; };

  const beginRotate = (e: ThreeEvent<PointerEvent>) => {
    if (!selected) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    rotateRef.current = true;
  };

  const onRotateMove = (e: ThreeEvent<PointerEvent>) => {
    if (!rotateRef.current || !selected) return;
    e.stopPropagation();
    const dx = e.point.x - selected.x;
    const dz = e.point.z - selected.z;
    onUpdate({ ry: Math.atan2(dx, dz) });
  };

  const endRotate = () => { rotateRef.current = false; };

  // VR: left stick = move, right stick X = rotate selected item
  useFrame((_, dt) => {
    if (!inXR || !selected) return;
    const { inputSourceStates } = xrStore.getState();
    const leftCtrl = getXrController(inputSourceStates as any, 'left');
    const rightCtrl = getXrController(inputSourceStates as any, 'right');
    const leftStick = leftCtrl ? readXrThumbstick(leftCtrl) : null;
    const rightStick = rightCtrl ? readXrThumbstick(rightCtrl) : null;

    if (leftStick && (leftStick.x || leftStick.y)) {
      const speed = 2.5 * dt;
      onUpdate({
        x: clamp(selected.x + leftStick.x * speed, -hallWidth / 2 + 0.5, hallWidth / 2 - 0.5),
        z: clamp(selected.z - leftStick.y * speed, -hallDepth / 2 + 0.5, hallDepth / 2 - 0.5),
      });
    } else {
      const session = (navigator as any).xr?.session as XRSession | undefined;
      if (session) {
        const { left } = resolveVrGamepads(session);
        if (left) {
          const s = readVrStick(left);
          if (s.x || s.y) {
            const speed = 2.5 * dt;
            onUpdate({
              x: clamp(selected.x + s.x * speed, -hallWidth / 2 + 0.5, hallWidth / 2 - 0.5),
              z: clamp(selected.z - s.y * speed, -hallDepth / 2 + 0.5, hallDepth / 2 - 0.5),
            });
          }
        }
      }
    }

    if (rightStick && Math.abs(rightStick.x) > 0.2) {
      onUpdate({ ry: (selected.ry ?? 0) + rightStick.x * dt * 2.2 });
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const step = e.shiftKey ? 0.5 : 0.15;
      const scStep = e.shiftKey ? 0.15 : 0.05;
      if (e.code === 'ArrowLeft') { e.preventDefault(); onUpdate({ x: selected.x - step }); }
      if (e.code === 'ArrowRight') { e.preventDefault(); onUpdate({ x: selected.x + step }); }
      if (e.code === 'ArrowUp') { e.preventDefault(); onUpdate({ z: selected.z - step }); }
      if (e.code === 'ArrowDown') { e.preventDefault(); onUpdate({ z: selected.z + step }); }
      if (e.code === 'KeyQ') { e.preventDefault(); onUpdate({ y: (selected.y ?? 1.5) + step }); }
      if (e.code === 'KeyE') { e.preventDefault(); onUpdate({ y: Math.max(0.2, (selected.y ?? 1.5) - step) }); }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') { e.preventDefault(); onUpdate({ scale: clamp((selected.scale ?? 1) + scStep, 0.05, 20) }); }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') { e.preventDefault(); onUpdate({ scale: clamp((selected.scale ?? 1) - scStep, 0.05, 20) }); }
      if (e.code === 'BracketLeft') { e.preventDefault(); onUpdate({ ry: (selected.ry ?? 0) - 0.1 }); }
      if (e.code === 'BracketRight') { e.preventDefault(); onUpdate({ ry: (selected.ry ?? 0) + 0.1 }); }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('expo-env-edit-delete'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onUpdate]);

  const halfW = hallWidth / 2;
  const halfD = hallDepth / 2;

  return (
    <group>
      {/* invisible floor for click-to-place */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onClick={onFloorClick}
      >
        <planeGeometry args={[hallWidth, hallDepth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* grid hint */}
      {[-halfW, 0, halfW].map(x => (
        <mesh key={`gx-${x}`} position={[x, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.02, hallDepth]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.25} />
        </mesh>
      ))}
      {[-halfD, 0, halfD].map(z => (
        <mesh key={`gz-${z}`} position={[0, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[hallWidth, 0.02]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.25} />
        </mesh>
      ))}

      {/* drag + rotate handles on selected item */}
      {selected && (() => {
        const ry = selected.ry ?? 0;
        const rotDist = 0.75;
        const rotX = Math.sin(ry) * rotDist;
        const rotZ = -Math.cos(ry) * rotDist;
        return (
          <group position={[selected.x, selected.y ?? 1.5, selected.z]} rotation={[0, ry, 0]}>
            {/* facing indicator */}
            <mesh position={[0, 0, -0.45]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.08, 0.22, 12]} />
              <meshBasicMaterial color="#a78bfa" />
            </mesh>
            <mesh
              position={[0, 0, 0]}
              onPointerDown={beginDrag}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
            >
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} />
            </mesh>
            <mesh position={[0, 0.35, 0]} onClick={(e) => { e.stopPropagation(); onUpdate({ y: (selected.y ?? 1.5) + 0.25 }); }}>
              <coneGeometry args={[0.12, 0.2, 12]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            <mesh position={[0, -0.35, 0]} onClick={(e) => { e.stopPropagation(); onUpdate({ y: Math.max(0.2, (selected.y ?? 1.5) - 0.25) }); }}>
              <coneGeometry args={[0.12, 0.2, 12]} rotation={[Math.PI, 0, 0]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            {/* rotation ring + draggable handle */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[rotDist - 0.04, rotDist + 0.04, 48]} />
              <meshBasicMaterial color="#7c3aed" transparent opacity={0.45} />
            </mesh>
            <mesh
              position={[rotX, 0.15, rotZ]}
              onPointerDown={beginRotate}
              onPointerMove={onRotateMove}
              onPointerUp={endRotate}
            >
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshBasicMaterial color="#a78bfa" />
            </mesh>
          </group>
        );
      })()}
    </group>
  );
};

/** HTML toolbar for environment edit mode (desktop + VR). */
export const EnvironmentEditToolbar: React.FC<{
  langFa: boolean;
  mediaCount: number;
  decorationCount: number;
  selection: EnvEditSelection;
  selectedMedia: ExpoEnvironmentMedia | null;
  selectedDecoration: ExpoDecoration | null;
  saving: boolean;
  onAdd: (kind: ExpoEnvironmentMediaKind) => void;
  onDelete: () => void;
  onSave: () => void;
  onExit: () => void;
  onPatchSelected: (patch: Partial<ExpoEnvironmentMedia> | Partial<ExpoDecoration>) => void;
}> = ({ langFa: T, mediaCount, decorationCount, selection, selectedMedia, selectedDecoration, saving, onAdd, onDelete, onSave, onExit, onPatchSelected }) => {
  const t = {
    title: T ? 'حالت ادیت محیط' : 'Environment edit',
    addImg: T ? '+ تصویر' : '+ Image',
    addVid: T ? '+ ویدئو' : '+ Video',
    addBtn: T ? '+ دکمه' : '+ Button',
    addGlb: T ? '+ مدل' : '+ GLB',
    save: T ? 'ذخیره' : 'Save',
    exit: T ? 'خروج' : 'Exit',
    del: T ? 'حذف' : 'Delete',
    hint: T ? 'کلیک روی آبجکت = انتخاب · کلیک زمین = افزودن رسانه · فلش‌ها جابه‌جایی · Q/E ارتفاع · +/- مقیاس · Delete حذف' : 'Click object = select · click floor = add media · arrows move · Q/E height · +/- scale · Delete removes',
    count: T ? `${mediaCount} رسانه · ${decorationCount} دکور` : `${mediaCount} media · ${decorationCount} decor`,
    w: T ? 'عرض' : 'Width',
    h: T ? 'ارتفاع' : 'Height',
    scale: T ? 'مقیاس' : 'Scale',
    rot: T ? 'چرخش' : 'Rotation',
    rotLeft: T ? 'چرخش چپ' : 'Rotate left',
    rotRight: T ? 'چرخش راست' : 'Rotate right',
    frame: T ? 'حاشیه' : 'Border',
    pdfFit: T ? 'نمایش PDF' : 'PDF fit',
    action: T ? 'عمل دکمه' : 'Button action',
    selMedia: T ? 'رسانه' : 'Media',
    selDeco: T ? 'دکور' : 'Decor',
  };

  const selected = selectedMedia || selectedDecoration;
  const isMedia = selection?.kind === 'media' && !!selectedMedia;
  const isDeco = selection?.kind === 'decoration' && !!selectedDecoration;

  const isPdfish = isMedia && selectedMedia && (selectedMedia.kind === 'pdf' || (selectedMedia.url && /\.pdf(\?.*)?$/i.test(selectedMedia.url)));

  const rotDeg = Math.round(((selected?.ry ?? 0) * 180) / Math.PI);
  const nudgeRot = (deltaDeg: number) => {
    if (!selected) return;
    onPatchSelected({ ry: (selected.ry ?? 0) + (deltaDeg * Math.PI) / 180 });
  };

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[60] max-w-[96vw]">
      <div className="bg-slate-900/92 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-amber-400/40 px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <span className="text-sm font-bold text-amber-300">✏️ {t.title}</span>
          <span className="text-[10px] text-slate-400">{t.count}</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">{t.hint}</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onAdd('image')} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500">{t.addImg}</button>
          <button type="button" onClick={() => onAdd('video')} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500">{t.addVid}</button>
          <button type="button" onClick={() => onAdd('button')} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500">{t.addBtn}</button>
          <button type="button" onClick={() => onAdd('glb')} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500">{t.addGlb}</button>
          {selected && (
            <>
              <span className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-600 text-amber-200">
                {isMedia ? t.selMedia : t.selDeco}
              </span>
              <button type="button" onClick={onDelete} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-600">{t.del}</button>
              {isMedia && selectedMedia && (
                <>
                  <label className="text-[10px] flex items-center gap-1">{t.w}
                    <input type="number" min={0.3} max={12} step={0.1} className="w-14 px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs" value={selectedMedia.w ?? 2} onChange={e => onPatchSelected({ w: +e.target.value })} />
                  </label>
                  <label className="text-[10px] flex items-center gap-1">{t.h}
                    <input type="number" min={0.3} max={8} step={0.1} className="w-14 px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs" value={selectedMedia.h ?? 1.2} onChange={e => onPatchSelected({ h: +e.target.value })} />
                  </label>
                </>
              )}
              <label className="text-[10px] flex items-center gap-1">{t.scale}
                <input type="number" min={0.05} max={20} step={0.05} className="w-14 px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs" value={selected.scale ?? 1} onChange={e => onPatchSelected({ scale: +e.target.value })} />
              </label>
              <span className="text-[10px] flex items-center gap-0.5 text-slate-300">{t.rot}</span>
              <button type="button" title={t.rotLeft} onClick={() => nudgeRot(-15)} className="text-[11px] px-2 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600">↺</button>
              <button type="button" title={t.rotRight} onClick={() => nudgeRot(15)} className="text-[11px] px-2 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600">↻</button>
              <label className="text-[10px] flex items-center gap-1">
                <input
                  type="number"
                  min={-360}
                  max={360}
                  step={5}
                  className="w-12 px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs"
                  value={rotDeg}
                  onChange={e => onPatchSelected({ ry: (+e.target.value * Math.PI) / 180 })}
                />
                <span>°</span>
              </label>
              {isPdfish && selectedMedia && (
                <>
                  <label className="text-[10px] flex items-center gap-1" title={t.frame}>
                    {t.frame}
                    <input type="number" min={0} max={1} step={0.01} className="w-12 px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs" value={selectedMedia.framePad ?? 0} onChange={e => onPatchSelected({ framePad: +e.target.value })} />
                  </label>
                  <select className="text-[10px] px-1.5 py-1 rounded bg-slate-800 border border-slate-600" value={selectedMedia.pdfFit || 'contain'} onChange={e => onPatchSelected({ pdfFit: e.target.value as 'contain' | 'cover' | 'fill' })} title={t.pdfFit}>
                    <option value="contain">{T ? 'جا شدن' : 'Fit'}</option>
                    <option value="cover">{T ? 'پر کردن' : 'Cover'}</option>
                    <option value="fill">{T ? 'کشیده' : 'Stretch'}</option>
                  </select>
                </>
              )}
              {isMedia && selectedMedia?.kind === 'button' && (
                <select className="text-[10px] px-1.5 py-1 rounded bg-slate-800 border border-slate-600" value={selectedMedia.action || 'url'} onChange={e => onPatchSelected({ action: e.target.value as any })}>
                  <option value="url">URL</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">{T ? 'تماس' : 'Phone'}</option>
                  <option value="meet">Meet</option>
                  <option value="contact">{T ? 'اطلاعات تماس' : 'Contact'}</option>
                </select>
              )}
            </>
          )}
          <button type="button" disabled={saving} onClick={onSave} className="text-[11px] px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 ml-auto">{saving ? '…' : t.save}</button>
          <button type="button" onClick={onExit} className="text-[11px] px-3 py-1.5 rounded-lg border border-slate-500 hover:bg-slate-800">{t.exit}</button>
        </div>
      </div>
    </div>
  );
};
