import React, { useCallback, useRef, useState } from 'react';
import type { BoothTier, ExpoDecoration, ExpoRetailCategory, ExpoVisualStyle, MetaExpoBoothReservation, MetaverseBooth } from '../types';
import { layoutCarpetRects, planRectPct } from './metaverse/expoUtils';

type DragKind = 'booth' | 'deco' | 'spawn';

interface DragState {
  target: string;
  kind: DragKind;
  x: number;
  z: number;
}

export interface ExpoFloorPlanProps {
  width: number;
  depth: number;
  visualStyle?: ExpoVisualStyle;
  boothLayout?: string;
  booths: MetaverseBooth[];
  decorations: ExpoDecoration[];
  spawn?: { x?: number; z?: number };
  retailCategories?: ExpoRetailCategory[];
  readonly?: boolean;
  langFa: boolean;
  openDecorationId?: string | null;
  layoutHint: string;
  onBoothMove: (id: string, x: number, z: number) => void;
  onDecorationMove: (id: string, x: number, z: number) => void;
  onSpawnMove: (x: number, z: number) => void;
  onSelectBooth: (id: string) => void;
  onSelectDecoration: (id: string) => void;
  /** Public reservation map: show booths read-only with status colors; click available booths. */
  reserveMap?: boolean;
  boothReservations?: Record<string, MetaExpoBoothReservation>;
  onBoothClick?: (booth: MetaverseBooth) => void;
  boothLabel?: (booth: MetaverseBooth, index: number) => string;
}

/** 2D hall floor plan — drag uses local state; commits position only on pointer-up for smooth moves. */
export const ExpoFloorPlan: React.FC<ExpoFloorPlanProps> = ({
  width,
  depth,
  visualStyle,
  boothLayout,
  booths,
  decorations,
  spawn,
  retailCategories = [],
  readonly,
  langFa: T,
  openDecorationId,
  layoutHint,
  onBoothMove,
  onDecorationMove,
  onSpawnMove,
  onSelectBooth,
  onSelectDecoration,
  reserveMap = false,
  boothReservations = {},
  onBoothClick,
  boothLabel,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragMoved = useRef(false);
  const dragStartClient = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);
  const pendingPos = useRef<{ x: number; z: number } | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);

  const W = Math.max(8, width);
  const D = Math.max(8, depth);
  const isSF = visualStyle === 'storefront' || visualStyle === 'business_center';
  const sfTheme = { accent: '#0d9488', planBg: '#f0fdfa', floorColor: '#ccfbf1', boothColor: '#0f766e', carpetColor: '#9f1239', carpetBorder: '#d4a574' };
  const theme = isSF ? sfTheme : null;
  const tierMark = (tier?: BoothTier) => tier === 'premium' ? 'P' : tier === 'standard' ? 'S' : 'B';
  const boothReserveStatus = (id: string): 'available' | 'pending' | 'confirmed' => {
    const r = boothReservations[id];
    if (!r || r.status === 'cancelled') return 'available';
    if (r.status === 'confirmed') return 'confirmed';
    return 'pending';
  };
  const boothFill = (b: MetaverseBooth) => {
    if (!reserveMap) return b.color || theme?.boothColor || '#2d4a1a';
    const st = boothReserveStatus(b.id);
    if (st === 'confirmed') return '#dc2626';
    if (st === 'pending') return '#eab308';
    return '#22c55e';
  };
  const showBooths = !readonly || reserveMap;

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const ny = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    return { x: +(nx * W - W / 2).toFixed(2), z: +(ny * D - D / 2).toFixed(2) };
  }, [W, D]);

  const wx = (x: number) => ((x + W / 2) / W) * 100;
  const wz = (z: number) => ((z + D / 2) / D) * 100;

  const displayPos = (target: string, x: number, z: number) => {
    if (dragging?.target === target) return { x: dragging.x, z: dragging.z };
    return { x, z };
  };

  const scheduleDragUpdate = (x: number, z: number) => {
    pendingPos.current = { x, z };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const pos = pendingPos.current;
      const d = dragRef.current;
      if (!pos || !d) return;
      dragRef.current = { ...d, x: pos.x, z: pos.z };
      setDragging({ ...d, x: pos.x, z: pos.z });
    });
  };

  const beginDrag = (ev: React.PointerEvent, target: string, kind: DragKind) => {
    if (readonly) return;
    ev.preventDefault();
    ev.stopPropagation();
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    const { x, z } = toWorld(ev.clientX, ev.clientY);
    dragMoved.current = false;
    dragStartClient.current = { x: ev.clientX, y: ev.clientY };
    const state: DragState = { target, kind, x, z };
    dragRef.current = state;
    setDragging(state);
  };

  const onSvgMove = (ev: React.PointerEvent) => {
    if (!dragRef.current) return;
    ev.preventDefault();
    const start = dragStartClient.current;
    if (start && (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y)) > 3) {
      dragMoved.current = true;
    }
    const { x, z } = toWorld(ev.clientX, ev.clientY);
    scheduleDragUpdate(x, z);
  };

  const commitDrag = () => {
    const d = dragRef.current;
    if (d) {
      if (d.kind === 'spawn') onSpawnMove(d.x, d.z);
      else if (d.kind === 'deco') onDecorationMove(d.target, d.x, d.z);
      else onBoothMove(d.target, d.x, d.z);
    }
    dragRef.current = null;
    pendingPos.current = null;
    dragStartClient.current = null;
    setDragging(null);
  };

  const onSvgUp = (ev: React.PointerEvent) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    commitDrag();
    if (!dragMoved.current) {
      if (d.kind === 'booth') onSelectBooth(d.target);
      else if (d.kind === 'deco') onSelectDecoration(d.target);
    }
    ev.preventDefault();
  };

  const carpets = layoutCarpetRects(boothLayout || 'cross', W, D);

  return (
    <div>
      <p className="text-[11px] text-slate-600 mb-2">{layoutHint}</p>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full rounded-xl border-2 touch-none select-none"
        style={{
          aspectRatio: `${W} / ${D}`,
          cursor: dragging ? 'grabbing' : 'default',
          borderColor: theme?.accent || '#cbd5e1',
          background: theme ? `linear-gradient(135deg, ${theme.planBg} 0%, ${theme.floorColor} 100%)` : undefined,
        }}
        onPointerMove={onSvgMove}
        onPointerUp={onSvgUp}
        onPointerCancel={onSvgUp}
      >
        <rect x={0.5} y={0.5} width={99} height={99} fill="none" stroke={theme?.accent || '#cbd5e1'} strokeWidth={0.8} />
        {carpets.map((c, ci) => {
          const r = planRectPct(c, W, D);
          const fill = c.entrance ? (c.color || '#b91c1c') : (theme?.carpetColor || c.color || '#9f1239');
          const stroke = c.entrance ? (c.border || '#fca5a5') : (theme?.carpetBorder || c.border || '#d4a574');
          return (
            <g key={`carpet-${ci}`}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.6} fill={fill} opacity={c.entrance ? 0.55 : 0.35} />
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.6} fill="none" stroke={stroke} strokeWidth={0.35} opacity={0.7} />
            </g>
          );
        })}
        {visualStyle === 'supermarket' && retailCategories.map((c, i) => {
          const rows = Math.max(1, Math.ceil(retailCategories.length / 2));
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = col === 0 ? 6 : 52;
          const y = 8 + row * (84 / rows);
          const h = Math.max(12, 72 / rows);
          return (
            <g key={c.id}>
              <rect x={x} y={y} width={42} height={h} rx={2} fill={c.color || '#16a34a'} opacity={0.12} stroke={c.color || '#16a34a'} strokeWidth={0.4} />
              <text x={x + 21} y={y + 4.2} textAnchor="middle" fontSize={2.8} fill={c.color || '#166534'} fontWeight="bold">
                {(T ? c.title?.fa : c.title?.en) || c.title?.fa || c.title?.en || ''}
              </text>
            </g>
          );
        })}
        {showBooths && booths.map((b, i) => {
          const p = displayPos(b.id, b.x || 0, b.z || 0);
          const active = dragging?.target === b.id;
          const reserved = reserveMap && boothReserveStatus(b.id) !== 'available';
          const label = boothLabel ? boothLabel(b, i) : (T ? `غ ${i + 1}` : `B${i + 1}`);
          const sub = reserveMap
            ? (reserved ? (boothReservations[b.id]?.company || '').slice(0, 8) : '')
            : tierMark(b.tier);
          const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
          const labelFs = reserveMap ? 1.25 : 2.6;
          const labelY = reserveMap ? 4.8 : 6.5;
          const subFs = reserveMap ? 0.95 : 2;
          const subY = reserveMap ? 6.6 : 10.2;
          const displayLabel = reserveMap ? trim(label, 9) : label;
          const displaySub = reserveMap && sub ? trim(String(sub), 8) : sub;
          const subText = reserveMap ? displaySub : sub;
          return (
            <g
              key={b.id}
              transform={`translate(${wx(p.x)} ${wz(p.z)})`}
              style={{ cursor: reserveMap ? (reserved ? 'not-allowed' : 'pointer') : (active ? 'grabbing' : 'grab') }}
              onPointerDown={ev => {
                if (reserveMap) {
                  ev.stopPropagation();
                  if (!reserved && onBoothClick) onBoothClick(b);
                  return;
                }
                beginDrag(ev, b.id, 'booth');
              }}
            >
              <rect x={-3.2} y={-3.2} width={6.4} height={6.4} rx={1} fill={boothFill(b)} stroke="#fff" strokeWidth={0.5} opacity={reserved ? 0.92 : 1} />
              {reserveMap && (
                <text x={0} y={0.9} textAnchor="middle" fontSize={1.15} fill="#fff" fontWeight="600" pointerEvents="none" opacity={0.95}>
                  {i + 1}
                </text>
              )}
              <text x={0} y={labelY} textAnchor="middle" fontSize={labelFs} fill="#475569" pointerEvents="none">{displayLabel}</text>
              {subText ? (
                <text x={0} y={subY} textAnchor="middle" fontSize={subFs} fill="#64748b" pointerEvents="none">{subText}</text>
              ) : null}
            </g>
          );
        })}
        {!readonly && !reserveMap && decorations.map((d, i) => {
          const p = displayPos(d.id, d.x || 0, d.z || 0);
          const selected = openDecorationId === d.id;
          const active = dragging?.target === d.id;
          return (
            <g
              key={d.id}
              transform={`translate(${wx(p.x)} ${wz(p.z)})`}
              style={{ cursor: active ? 'grabbing' : 'grab' }}
              onPointerDown={ev => beginDrag(ev, d.id, 'deco')}
            >
              {selected && <circle r={4.2} fill="none" stroke="#f59e0b" strokeWidth={0.55} strokeDasharray="1.2 0.8" pointerEvents="none" />}
              <polygon points="0,-2.6 2.2,0 0,2.6 -2.2,0" fill={d.modelUrl ? '#f59e0b' : '#d1d5db'} stroke="#fff" strokeWidth={0.45} />
              <text x={0} y={5.8} textAnchor="middle" fontSize={2.5} fill="#b45309" fontWeight="bold" pointerEvents="none">{T ? `د${i + 1}` : `D${i + 1}`}</text>
            </g>
          );
        })}
        {!readonly && !reserveMap && (
        <g
          transform={`translate(${wx(displayPos('__spawn__', spawn?.x || 0, spawn?.z || 0).x)} ${wz(displayPos('__spawn__', spawn?.x || 0, spawn?.z || 0).z)})`}
          style={{ cursor: dragging?.target === '__spawn__' ? 'grabbing' : 'grab' }}
          onPointerDown={ev => beginDrag(ev, '__spawn__', 'spawn')}
        >
          <circle r={2.4} fill="#22d3ee" stroke="#0e7490" strokeWidth={0.6} />
          <text x={0} y={-3.2} textAnchor="middle" fontSize={3} fill="#0e7490" fontWeight="bold" pointerEvents="none">{T ? 'شروع' : 'start'}</text>
        </g>
        )}
      </svg>
    </div>
  );
};
