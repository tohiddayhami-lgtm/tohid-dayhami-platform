import React, { useEffect, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import type { ExpoEnvironmentMedia, ExpoEnvironmentMediaKind } from '../../types';
import { readVrStick, resolveVrGamepads } from './expoLocomotion';

export const ENV_EDIT_SESSION_KEY = 'expo_env_edit_bazaar';

interface Props {
  hallWidth: number;
  hallDepth: number;
  media: ExpoEnvironmentMedia[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<ExpoEnvironmentMedia>) => void;
  onAdd: (kind: ExpoEnvironmentMediaKind, at: { x: number; y: number; z: number }) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** In-scene helpers for placing & transforming environment media (desktop + VR). */
export const EnvironmentEditGizmos: React.FC<Props> = ({
  hallWidth, hallDepth, media, selectedId, onSelect, onUpdate, onAdd,
}) => {
  const inXR = useXR((s) => !!s.session);
  const dragRef = useRef<{ id: string; offset: THREE.Vector3 } | null>(null);

  const selected = media.find(m => m.id === selectedId);

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (dragRef.current) return;
    if (!selectedId) {
      onAdd('image', { x: e.point.x, y: 1.5, z: e.point.z });
      return;
    }
    onSelect(null);
  };

  const beginDrag = (e: ThreeEvent<PointerEvent>, id: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const item = media.find(m => m.id === id);
    if (!item) return;
    onSelect(id);
    const offset = new THREE.Vector3(item.x - e.point.x, 0, item.z - e.point.z);
    dragRef.current = { id, offset };
  };

  const onDragMove = (e: ThreeEvent<PointerEvent>) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    onUpdate(d.id, {
      x: clamp(e.point.x + d.offset.x, -hallWidth / 2 + 0.5, hallWidth / 2 - 0.5),
      z: clamp(e.point.z + d.offset.z, -hallDepth / 2 + 0.5, hallDepth / 2 - 0.5),
    });
  };

  const endDrag = () => { dragRef.current = null; };

  // VR: thumbstick nudges selected item (left stick only)
  useFrame((_, dt) => {
    if (!inXR || !selectedId || !selected) return;
    const session = (navigator as any).xr?.session as XRSession | undefined;
    if (!session) return;
    const { left } = resolveVrGamepads(session);
    if (!left) return;
    const s = readVrStick(left);
    if (!s.x && !s.y) return;
    const speed = 2.5 * dt;
    onUpdate(selectedId, {
      x: clamp(selected.x + s.x * speed, -hallWidth / 2 + 0.5, hallWidth / 2 - 0.5),
      z: clamp(selected.z - s.y * speed, -hallDepth / 2 + 0.5, hallDepth / 2 - 0.5),
    });
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId || !selected) return;
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const step = e.shiftKey ? 0.5 : 0.15;
      const scStep = e.shiftKey ? 0.15 : 0.05;
      if (e.code === 'ArrowLeft') { e.preventDefault(); onUpdate(selectedId, { x: selected.x - step }); }
      if (e.code === 'ArrowRight') { e.preventDefault(); onUpdate(selectedId, { x: selected.x + step }); }
      if (e.code === 'ArrowUp') { e.preventDefault(); onUpdate(selectedId, { z: selected.z - step }); }
      if (e.code === 'ArrowDown') { e.preventDefault(); onUpdate(selectedId, { z: selected.z + step }); }
      if (e.code === 'KeyQ') { e.preventDefault(); onUpdate(selectedId, { y: (selected.y ?? 1.5) + step }); }
      if (e.code === 'KeyE') { e.preventDefault(); onUpdate(selectedId, { y: Math.max(0.2, (selected.y ?? 1.5) - step) }); }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') { e.preventDefault(); onUpdate(selectedId, { scale: clamp((selected.scale ?? 1) + scStep, 0.2, 8) }); }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') { e.preventDefault(); onUpdate(selectedId, { scale: clamp((selected.scale ?? 1) - scStep, 0.2, 8) }); }
      if (e.code === 'BracketLeft') { e.preventDefault(); onUpdate(selectedId, { ry: (selected.ry ?? 0) - 0.1 }); }
      if (e.code === 'BracketRight') { e.preventDefault(); onUpdate(selectedId, { ry: (selected.ry ?? 0) + 0.1 }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selected, onUpdate]);

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

      {/* drag handles on selected item */}
      {selected && (
        <group position={[selected.x, selected.y ?? 1.5, selected.z]}>
          <mesh
            position={[0, 0, 0]}
            onPointerDown={(e) => beginDrag(e, selected.id)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
          >
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.35, 0]} onClick={(e) => { e.stopPropagation(); onUpdate(selected.id, { y: (selected.y ?? 1.5) + 0.25 }); }}>
            <coneGeometry args={[0.12, 0.2, 12]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[0, -0.35, 0]} onClick={(e) => { e.stopPropagation(); onUpdate(selected.id, { y: Math.max(0.2, (selected.y ?? 1.5) - 0.25) }); }}>
            <coneGeometry args={[0.12, 0.2, 12]} rotation={[Math.PI, 0, 0]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      )}
    </group>
  );
};

/** HTML toolbar for environment edit mode (desktop + VR). */
export const EnvironmentEditToolbar: React.FC<{
  langFa: boolean;
  mediaCount: number;
  selected: ExpoEnvironmentMedia | null;
  saving: boolean;
  onAdd: (kind: ExpoEnvironmentMediaKind) => void;
  onDelete: () => void;
  onSave: () => void;
  onExit: () => void;
  onPatchSelected: (patch: Partial<ExpoEnvironmentMedia>) => void;
}> = ({ langFa: T, mediaCount, selected, saving, onAdd, onDelete, onSave, onExit, onPatchSelected }) => {
  const t = {
    title: T ? 'حالت ادیت محیط' : 'Environment edit',
    addImg: T ? '+ تصویر' : '+ Image',
    addVid: T ? '+ ویدئو' : '+ Video',
    addBtn: T ? '+ دکمه' : '+ Button',
    addGlb: T ? '+ مدل' : '+ GLB',
    save: T ? 'ذخیره' : 'Save',
    exit: T ? 'خروج' : 'Exit',
    del: T ? 'حذف' : 'Delete',
    hint: T ? 'کلیک روی زمین = افزودن · کلیک آیتم = انتخاب · فلش‌ها جابه‌جایی · Q/E ارتفاع · +/- اندازه · VR: استیک چپ' : 'Click floor = add · click item = select · arrows move · Q/E height · +/- scale · VR: left stick',
    count: T ? `${mediaCount} آیتم` : `${mediaCount} items`,
    w: T ? 'عرض' : 'Width',
    h: T ? 'ارتفاع' : 'Height',
    scale: T ? 'مقیاس' : 'Scale',
    action: T ? 'عمل دکمه' : 'Button action',
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
              <button type="button" onClick={onDelete} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-600">{t.del}</button>
              <label className="text-[10px] flex items-center gap-1">{t.w}
                <input type="number" min={0.3} max={12} step={0.1} className="w-14 px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs" value={selected.w ?? 2} onChange={e => onPatchSelected({ w: +e.target.value })} />
              </label>
              <label className="text-[10px] flex items-center gap-1">{t.h}
                <input type="number" min={0.3} max={8} step={0.1} className="w-14 px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs" value={selected.h ?? 1.2} onChange={e => onPatchSelected({ h: +e.target.value })} />
              </label>
              <label className="text-[10px] flex items-center gap-1">{t.scale}
                <input type="number" min={0.2} max={8} step={0.05} className="w-14 px-1 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs" value={selected.scale ?? 1} onChange={e => onPatchSelected({ scale: +e.target.value })} />
              </label>
              {selected.kind === 'button' && (
                <select className="text-[10px] px-1.5 py-1 rounded bg-slate-800 border border-slate-600" value={selected.action || 'url'} onChange={e => onPatchSelected({ action: e.target.value as any })}>
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
