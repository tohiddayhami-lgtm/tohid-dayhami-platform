import React, { useEffect, useRef, useState } from 'react';
import type { MetaverseExpo } from '../../types';
import { hallDims } from './expoUtils';
import type { PlayerPoseRef } from './expoControls';

// Top-down 2D minimap (DOM/SVG overlay). Polls the player pose ref via rAF so it never
// forces React re-renders from inside the animation frame loop.
export const Minimap: React.FC<{ expo: MetaverseExpo; poseRef: PlayerPoseRef }> = ({ expo, poseRef }) => {
  const { width, depth } = hallDims(expo);
  const [pose, setPose] = useState({ x: poseRef.current.x, z: poseRef.current.z, heading: poseRef.current.heading });
  const size = 132, pad = 8;

  useEffect(() => {
    let raf = 0; let last = 0;
    const loop = (t: number) => {
      if (t - last > 66) { // ~15fps is plenty for a minimap
        last = t;
        const p = poseRef.current;
        setPose(prev => (Math.abs(prev.x - p.x) > 0.05 || Math.abs(prev.z - p.z) > 0.05 || Math.abs(prev.heading - p.heading) > 0.03) ? { x: p.x, z: p.z, heading: p.heading } : prev);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [poseRef]);

  // world (x:-W/2..W/2, z:-D/2..D/2) → svg (pad..size-pad)
  const sx = (x: number) => pad + ((x + width / 2) / width) * (size - 2 * pad);
  const sz = (z: number) => pad + ((z + depth / 2) / depth) * (size - 2 * pad);
  const px = sx(pose.x), pz = sz(pose.z);
  const headDeg = (pose.heading * 180) / Math.PI;

  return (
    <div style={{ position: 'absolute', top: 14, insetInlineEnd: 14, width: size, height: size, borderRadius: 12, overflow: 'hidden', background: 'rgba(15,23,42,.55)', border: '1px solid rgba(255,255,255,.25)', backdropFilter: 'blur(6px)', zIndex: 40, boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>
      <svg width={size} height={size}>
        <rect x={pad} y={pad} width={size - 2 * pad} height={size - 2 * pad} fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.35)" rx={6} />
        {(expo.booths || []).map(b => (
          <rect key={b.id} x={sx(b.x || 0) - 4} y={sz(b.z || 0) - 4} width={8} height={8} rx={2} fill={b.color || '#fbbf24'} stroke="rgba(0,0,0,.3)" />
        ))}
        {/* player + facing arrow */}
        <g transform={`translate(${px} ${pz}) rotate(${headDeg})`}>
          <polygon points="0,-7 5,6 0,3 -5,6" fill="#22d3ee" stroke="#0e7490" strokeWidth={0.6} />
        </g>
      </svg>
    </div>
  );
};
