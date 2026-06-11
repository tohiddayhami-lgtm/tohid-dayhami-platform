import React, { useRef, useState } from 'react';
import { Billboard, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MetaverseHotspot } from '../../types';
import { Language } from '../../App';
import { bi, HOTSPOT_ICON } from './expoUtils';

interface Props {
  hotspot: MetaverseHotspot;
  lang: Language;
  onSelect: (h: MetaverseHotspot) => void;
}

// A clickable in-world marker. The mesh is the hit target, so it works with both the
// mouse (incl. pointer-lock crosshair) AND WebXR controller rays via R3F pointer events.
export const Hotspot: React.FC<Props> = ({ hotspot, lang, onSelect }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const color = hotspot.color || '#22d3ee';
  const icon = hotspot.icon || HOTSPOT_ICON[hotspot.type] || '🔗';
  const label = bi(hotspot.title, lang, '');

  // Gentle pulse so markers read as interactive.
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const s = (hover ? 1.25 : 1) + Math.sin(clock.elapsedTime * 2 + hotspot.x) * 0.06;
    ringRef.current.scale.setScalar(s);
  });

  return (
    <group position={[hotspot.x || 0, hotspot.y ?? 1.5, hotspot.z || 0]}>
      <Billboard>
        {/* Hit target + visual orb */}
        <mesh
          ref={ringRef}
          onClick={(e) => { e.stopPropagation(); onSelect(hotspot); }}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
        >
          <circleGeometry args={[0.32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.92} side={THREE.DoubleSide} />
        </mesh>
        {/* Glow ring */}
        <mesh>
          <ringGeometry args={[0.34, 0.42, 32]} />
          <meshBasicMaterial color={color} transparent opacity={hover ? 0.9 : 0.45} side={THREE.DoubleSide} />
        </mesh>
        {/* Icon + optional label via DOM (Persian-safe) */}
        <Html center distanceFactor={9} pointerEvents="none" zIndexRange={[20, 0]}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none', pointerEvents: 'none' }}>
            <span style={{ fontSize: 22, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }}>{icon}</span>
            {label && (hover) && (
              <span style={{ marginTop: 6, padding: '3px 9px', borderRadius: 999, background: 'rgba(15,23,42,.92)', color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.35)' }}>{label}</span>
            )}
          </div>
        </Html>
      </Billboard>
    </group>
  );
};
