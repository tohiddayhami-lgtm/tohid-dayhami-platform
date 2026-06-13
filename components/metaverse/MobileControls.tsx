import React, { useRef, useState } from 'react';
import type { ControlRef } from './expoControls';

// On-screen joysticks for touch devices, written into the shared control ref (consumed by
// <Player>). Two pads: `move` (left) drives walking, `look` (right) continuously turns the
// camera — much smoother than dragging the screen.
export const MobileControls: React.FC<{ controlRef: ControlRef; kind: 'move' | 'look' }> = ({ controlRef, kind }) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const activeId = useRef<number | null>(null);
  const R = 46; // joystick radius in px
  const isLook = kind === 'look';

  const write = (nx: number, ny: number) => {
    const target = isLook ? controlRef.current.look : controlRef.current.joy;
    target.x = nx; target.y = ny;
  };
  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = clientX - cx, dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    setThumb({ x: dx, y: dy });
    write(dx / R, dy / R);
  };
  const reset = () => { activeId.current = null; setThumb({ x: 0, y: 0 }); write(0, 0); };

  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => { e.stopPropagation(); activeId.current = e.pointerId; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); update(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (activeId.current === e.pointerId) { e.stopPropagation(); update(e.clientX, e.clientY); } }}
      onPointerUp={(e) => { if (activeId.current === e.pointerId) { e.stopPropagation(); reset(); } }}
      onPointerCancel={reset}
      style={{
        position: 'absolute', bottom: 28, width: R * 2, height: R * 2, borderRadius: '50%',
        ...(isLook ? { insetInlineEnd: 24 } : { insetInlineStart: 24 }),
        background: 'rgba(15,23,42,.28)', border: '2px solid rgba(255,255,255,.45)', backdropFilter: 'blur(4px)',
        touchAction: 'none', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* hint glyph in the centre when idle */}
      {!activeId.current && (
        <span style={{ position: 'absolute', color: 'rgba(255,255,255,.6)', fontSize: 18, pointerEvents: 'none' }}>{isLook ? '👁' : '✛'}</span>
      )}
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.85)', boxShadow: '0 2px 8px rgba(0,0,0,.3)', transform: `translate(${thumb.x}px, ${thumb.y}px)`, transition: activeId.current ? 'none' : 'transform .12s ease-out' }} />
    </div>
  );
};
