import React, { useCallback, useRef, useState } from 'react';
import type { ExpoEnvironmentMedia } from '../types';

type DragKind = 'spawn' | 'env' | 'scale' | 'rotate' | 'spawn-ry' | 'media';

interface DragState {
  kind: DragKind;
  x: number;
  z: number;
  mediaId?: string;
}

export interface ExpoEnvironmentMapProps {
  width: number;
  depth: number;
  spawn?: { x?: number; z?: number; ry?: number };
  environmentX?: number;
  environmentZ?: number;
  environmentScale?: number;
  environmentRy?: number;
  environmentAutoFit?: boolean;
  readonly?: boolean;
  langFa: boolean;
  onSpawnMove: (x: number, z: number) => void;
  onSpawnRyChange?: (ry: number) => void;
  onEnvMove: (x: number, z: number) => void;
  onScaleChange: (scale: number) => void;
  onRotationChange: (ry: number) => void;
  environmentMedia?: ExpoEnvironmentMedia[];
  selectedMediaId?: string | null;
  onMediaMove?: (id: string, x: number, z: number) => void;
  onSelectMedia?: (id: string) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Top-down 2D map for custom GLB environment — spawn, scale, rotation and placement. */
export const ExpoEnvironmentMap: React.FC<ExpoEnvironmentMapProps> = ({
  width,
  depth,
  spawn,
  environmentX = 0,
  environmentZ = 0,
  environmentScale = 1,
  environmentRy = 0,
  environmentAutoFit = true,
  readonly,
  langFa: T,
  onSpawnMove,
  onSpawnRyChange,
  onEnvMove,
  onScaleChange,
  onRotationChange,
  environmentMedia = [],
  selectedMediaId,
  onMediaMove,
  onSelectMedia,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const scaleStart = useRef(environmentScale);

  const W = Math.max(8, width);
  const D = Math.max(8, depth);
  const baseFoot = Math.max(W, D);
  const footSize = baseFoot * (environmentScale || 1);

  const wx = (x: number) => ((x + W / 2) / W) * 100;
  const wz = (z: number) => ((z + D / 2) / D) * 100;
  const wh = (m: number) => (m / W) * 100;
  const wd = (m: number) => (m / D) * 100;

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const nx = clamp((clientX - r.left) / r.width, 0, 1);
    const ny = clamp((clientY - r.top) / r.height, 0, 1);
    return { x: +(nx * W - W / 2).toFixed(2), z: +(ny * D - D / 2).toFixed(2) };
  }, [W, D]);

  const displayEnv = () => {
    if (dragging?.kind === 'env' || dragging?.kind === 'scale' || dragging?.kind === 'rotate') {
      return { x: dragging.x, z: dragging.z };
    }
    return { x: environmentX, z: environmentZ };
  };

  const displaySpawn = () => {
    if (dragging?.kind === 'spawn' || dragging?.kind === 'spawn-ry') {
      return { x: dragging.x, z: dragging.z };
    }
    return { x: spawn?.x ?? 0, z: spawn?.z ?? 0 };
  };

  const beginDrag = (ev: React.PointerEvent, kind: DragKind, x: number, z: number, mediaId?: string) => {
    if (readonly) return;
    ev.preventDefault();
    ev.stopPropagation();
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    if (kind === 'scale') scaleStart.current = environmentScale || 1;
    const state: DragState = { kind, x, z, mediaId };
    dragRef.current = state;
    setDragging(state);
  };

  const onSvgMove = (ev: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    ev.preventDefault();
    const { x, z } = toWorld(ev.clientX, ev.clientY);
    const cx = environmentX;
    const cz = environmentZ;

    if (d.kind === 'spawn') {
      dragRef.current = { ...d, x, z };
      setDragging({ ...d, x, z });
      return;
    }
    if (d.kind === 'spawn-ry' && onSpawnRyChange) {
      const sx = spawn?.x ?? 0;
      const sz = spawn?.z ?? 0;
      const ry = Math.atan2(x - sx, z - sz);
      onSpawnRyChange(ry);
      return;
    }
    if (d.kind === 'env') {
      dragRef.current = { ...d, x, z };
      setDragging({ ...d, x, z });
      return;
    }
    if (d.kind === 'scale') {
      const dist = Math.hypot(x - cx, z - cz);
      const next = clamp(dist / (baseFoot / 2), 0.05, 20);
      onScaleChange(+next.toFixed(3));
      return;
    }
    if (d.kind === 'rotate') {
      const ry = Math.atan2(x - cx, z - cz);
      onRotationChange(ry);
      return;
    }
    if (d.kind === 'media' && d.mediaId) {
      dragRef.current = { ...d, x, z };
      setDragging({ ...d, x, z });
      return;
    }
  };

  const commitDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'spawn') onSpawnMove(d.x, d.z);
    else if (d.kind === 'env') onEnvMove(d.x, d.z);
    else if (d.kind === 'media' && d.mediaId && onMediaMove) onMediaMove(d.mediaId, d.x, d.z);
    dragRef.current = null;
    setDragging(null);
  };

  const env = displayEnv();
  const sp = displaySpawn();
  const spawnRy = spawn?.ry ?? 0;
  const rotDeg = ((environmentRy * 180) / Math.PI + 360) % 360;
  const halfPctW = wh(footSize / 2);
  const halfPctD = wd(footSize / 2);
  const cx = wx(env.x);
  const cz = wz(env.z);

  const gridStep = W >= 24 ? 5 : W >= 16 ? 4 : 2;
  const gridLinesX: number[] = [];
  const gridLinesZ: number[] = [];
  for (let g = -W / 2; g <= W / 2 + 0.01; g += gridStep) gridLinesX.push(g);
  for (let g = -D / 2; g <= D / 2 + 0.01; g += gridStep) gridLinesZ.push(g);

  const labels = {
    title: T ? 'نقشه محیط سفارشی (۲D)' : 'Custom environment map (2D)',
    hint: T ? 'محیط بنفش را بکشید · گوشه مقیاس · دستگیره چرخش · فیروزه‌ای = ورود · نارنجی = رسانه' : 'Drag violet hall · corner scale · rotate handle · cyan = entry · orange = media',
    hall: T ? 'سالن' : 'Hall',
    glb: T ? 'محیط GLB' : 'GLB env',
    spawn: T ? 'ورود' : 'Entry',
    scale: T ? 'مقیاس' : 'Scale',
    rot: T ? 'چرخش' : 'Rotation',
    autoFit: T ? 'هم‌تراز خودکار' : 'Auto-fit',
    meters: (w: number, d: number) => T ? `${w}×${d} متر` : `${w}×${d} m`,
    footLabel: (s: number) => T ? `اثر ~${s.toFixed(1)} م` : `~${s.toFixed(1)} m footprint`,
  };

  const spawnArrowLen = 4.5;
  const spawnAx = wx(sp.x + Math.sin(spawnRy) * spawnArrowLen * (W / D));
  const spawnAz = wz(sp.z + Math.cos(spawnRy) * spawnArrowLen);

  const rotHandleDist = Math.max(halfPctW, halfPctD) * 0.85;
  const rotRad = environmentRy;
  const rotHx = cx + Math.sin(rotRad) * rotHandleDist;
  const rotHz = cz - Math.cos(rotRad) * rotHandleDist * (W / D);

  const scaleCornerLocalX = footSize / 2;
  const scaleCornerLocalZ = footSize / 2;
  const cosR = Math.cos(environmentRy);
  const sinR = Math.sin(environmentRy);
  const scaleWx = wx(env.x + scaleCornerLocalX * cosR + scaleCornerLocalZ * sinR);
  const scaleWz = wz(env.z - scaleCornerLocalX * sinR + scaleCornerLocalZ * cosR);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-violet-900">{labels.title}</p>
        <span className="text-[10px] text-violet-600/80 font-mono">{labels.meters(W, D)} · {labels.footLabel(footSize)}</span>
      </div>
      <p className="text-[10px] text-violet-700/75 leading-relaxed">{labels.hint}</p>

      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full rounded-xl border-2 border-violet-200 select-none touch-none"
        style={{
          aspectRatio: `${W} / ${D}`,
          background: 'linear-gradient(145deg, #f5f3ff 0%, #ede9fe 45%, #e0e7ff 100%)',
          cursor: dragging ? 'grabbing' : 'default',
        }}
        onPointerMove={onSvgMove}
        onPointerUp={commitDrag}
        onPointerCancel={commitDrag}
      >
        {/* grid */}
        {gridLinesX.map((g, i) => (
          <line key={`gx-${i}`} x1={wx(g)} y1={0} x2={wx(g)} y2={100} stroke="#c4b5fd" strokeWidth={0.15} opacity={0.55} />
        ))}
        {gridLinesZ.map((g, i) => (
          <line key={`gz-${i}`} x1={0} y1={wz(g)} x2={100} y2={wz(g)} stroke="#c4b5fd" strokeWidth={0.15} opacity={0.55} />
        ))}

        {/* hall bounds */}
        <rect x={0.6} y={0.6} width={98.8} height={98.8} fill="none" stroke="#7c3aed" strokeWidth={0.7} rx={0.8} />
        <text x={2} y={4} fontSize={2.8} fill="#5b21b6" fontWeight="bold">{labels.hall}</text>
        <text x={98} y={4} textAnchor="end" fontSize={2.2} fill="#6d28d9" opacity={0.85}>{W}m</text>
        <text x={2} y={98} fontSize={2.2} fill="#6d28d9" opacity={0.85}>{D}m</text>

        {/* front / entrance side (positive Z) */}
        <line x1={8} y1={98.2} x2={92} y2={98.2} stroke="#a78bfa" strokeWidth={0.35} strokeDasharray="2 1.5" opacity={0.7} />
        <text x={50} y={99.2} textAnchor="middle" fontSize={2} fill="#7c3aed" opacity={0.75}>{T ? 'جلوی سالن (+Z)' : 'Front (+Z)'}</text>

        {/* GLB footprint — rotated group */}
        <g transform={`translate(${cx} ${cz}) rotate(${rotDeg} 0 0)`}>
          <rect
            x={-halfPctW}
            y={-halfPctD}
            width={halfPctW * 2}
            height={halfPctD * 2}
            rx={1.2}
            fill="#8b5cf6"
            fillOpacity={0.22}
            stroke="#6d28d9"
            strokeWidth={0.55}
            style={{ cursor: readonly ? 'default' : 'grab' }}
            onPointerDown={ev => beginDrag(ev, 'env', env.x, env.z)}
          />
          <text x={0} y={0.8} textAnchor="middle" fontSize={3.2} fill="#4c1d95" fontWeight="bold" pointerEvents="none">{labels.glb}</text>
          {environmentAutoFit && (
            <text x={0} y={4.2} textAnchor="middle" fontSize={2} fill="#6d28d9" pointerEvents="none">{labels.autoFit}</text>
          )}
          {/* center cross */}
          <line x1={-2} y1={0} x2={2} y2={0} stroke="#7c3aed" strokeWidth={0.25} opacity={0.6} pointerEvents="none" />
          <line x1={0} y1={-2} x2={0} y2={2} stroke="#7c3aed" strokeWidth={0.25} opacity={0.6} pointerEvents="none" />
        </g>

        {/* rotation handle */}
        {!readonly && (
          <g>
            <line x1={cx} y1={cz} x2={rotHx} y2={rotHz} stroke="#7c3aed" strokeWidth={0.35} strokeDasharray="1 0.8" opacity={0.65} />
            <circle
              cx={rotHx}
              cy={rotHz}
              r={2.2}
              fill="#a78bfa"
              stroke="#fff"
              strokeWidth={0.45}
              style={{ cursor: 'grab' }}
              onPointerDown={ev => beginDrag(ev, 'rotate', env.x, env.z)}
            />
            <text x={rotHx} y={rotHz - 3.2} textAnchor="middle" fontSize={2.2} fill="#5b21b6" pointerEvents="none">{labels.rot}</text>
          </g>
        )}

        {/* scale handle (corner) */}
        {!readonly && (
          <g>
            <circle
              cx={scaleWx}
              cy={scaleWz}
              r={2.4}
              fill="#fbbf24"
              stroke="#fff"
              strokeWidth={0.5}
              style={{ cursor: 'nwse-resize' }}
              onPointerDown={ev => beginDrag(ev, 'scale', env.x, env.z)}
            />
            <text x={scaleWx} y={scaleWz + 4.5} textAnchor="middle" fontSize={2.2} fill="#92400e" pointerEvents="none">{labels.scale}</text>
          </g>
        )}

        {/* environment media markers */}
        {environmentMedia.map(m => {
          const isSel = m.id === selectedMediaId;
          const mx = dragging?.kind === 'media' && dragging.mediaId === m.id ? dragging.x : m.x;
          const mz = dragging?.kind === 'media' && dragging.mediaId === m.id ? dragging.z : m.z;
          const glyph = m.kind === 'button' ? '🔘' : m.kind === 'video' ? '▶' : m.kind === 'glb' ? '📦' : '🖼';
          return (
            <g key={m.id} transform={`translate(${wx(mx)} ${wz(mz)})`}>
              <rect
                x={-2.2}
                y={-2.2}
                width={4.4}
                height={4.4}
                rx={0.8}
                fill={isSel ? '#f59e0b' : '#fb923c'}
                stroke={isSel ? '#fff' : '#c2410c'}
                strokeWidth={isSel ? 0.6 : 0.4}
                style={{ cursor: readonly ? 'default' : 'grab' }}
                onPointerDown={ev => {
                  onSelectMedia?.(m.id);
                  beginDrag(ev, 'media', mx, mz, m.id);
                }}
              />
              <text x={0} y={0.8} textAnchor="middle" fontSize={2.4} pointerEvents="none">{glyph}</text>
            </g>
          );
        })}

        {/* spawn / entry */}
        <g transform={`translate(${wx(sp.x)} ${wz(sp.z)})`}>
          <circle
            r={2.8}
            fill="#22d3ee"
            stroke="#0e7490"
            strokeWidth={0.65}
            style={{ cursor: readonly ? 'default' : 'grab' }}
            onPointerDown={ev => beginDrag(ev, 'spawn', sp.x, sp.z)}
          />
          <line
            x1={0}
            y1={0}
            x2={spawnAx - wx(sp.x)}
            y2={spawnAz - wz(sp.z)}
            stroke="#0e7490"
            strokeWidth={0.55}
            markerEnd="url(#env-spawn-arrow)"
            pointerEvents="none"
          />
          {!readonly && onSpawnRyChange && (
            <circle
              cx={spawnAx - wx(sp.x)}
              cy={spawnAz - wz(sp.z)}
              r={1.8}
              fill="#0891b2"
              stroke="#fff"
              strokeWidth={0.4}
              style={{ cursor: 'crosshair' }}
              onPointerDown={ev => beginDrag(ev, 'spawn-ry', sp.x, sp.z)}
            />
          )}
          <text x={0} y={-4.5} textAnchor="middle" fontSize={3} fill="#0e7490" fontWeight="bold" pointerEvents="none">{labels.spawn}</text>
        </g>

        <defs>
          <marker id="env-spawn-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
            <polygon points="0 0, 4 2, 0 4" fill="#0e7490" />
          </marker>
        </defs>
      </svg>

      <div className="flex flex-wrap gap-3 text-[10px] text-violet-800/90 font-mono">
        <span>{T ? 'ورود' : 'Entry'}: ({sp.x.toFixed(1)}, {sp.z.toFixed(1)}) · {Math.round((spawnRy * 180) / Math.PI)}°</span>
        <span>{T ? 'محیط' : 'Env'}: ({env.x.toFixed(1)}, {env.z.toFixed(1)})</span>
        <span>{labels.scale}: ×{(environmentScale || 1).toFixed(2)}</span>
        <span>{labels.rot}: {rotDeg.toFixed(0)}°</span>
      </div>
    </div>
  );
};
