import React, { useRef, useState } from 'react';
import type { ControlRef } from './expoControls';

// On-screen joystick for touch devices. Writes a normalized vector into the shared control
// ref (consumed by <Player>). Look is handled by the canvas drag-listener, so this only moves.
export const MobileControls: React.FC<{ controlRef: ControlRef }> = ({ controlRef }) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const activeId = useRef<number | null>(null);
  const R = 46; // joystick radius in px

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = clientX - cx, dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    setThumb({ x: dx, y: dy });
    controlRef.current.joy.x = dx / R;
    controlRef.current.joy.y = dy / R;
  };
  const reset = () => { activeId.current = null; setThumb({ x: 0, y: 0 }); controlRef.current.joy.x = 0; controlRef.current.joy.y = 0; };

  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => { e.stopPropagation(); activeId.current = e.pointerId; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); update(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (activeId.current === e.pointerId) { e.stopPropagation(); update(e.clientX, e.clientY); } }}
      onPointerUp={(e) => { if (activeId.current === e.pointerId) { e.stopPropagation(); reset(); } }}
      onPointerCancel={reset}
      style={{
        position: 'absolute', bottom: 28, insetInlineStart: 24, width: R * 2, height: R * 2, borderRadius: '50%',
        background: 'rgba(15,23,42,.28)', border: '2px solid rgba(255,255,255,.45)', backdropFilter: 'blur(4px)',
        touchAction: 'none', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.85)', boxShadow: '0 2px 8px rgba(0,0,0,.3)', transform: `translate(${thumb.x}px, ${thumb.y}px)`, transition: activeId.current ? 'none' : 'transform .12s ease-out' }} />
    </div>
  );
};
