import React, { useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { CanvasLabel } from './CanvasLabel';

const ICON_PX = 128;

const buildWhatsAppIconTexture = () => {
  const cvs = document.createElement('canvas');
  cvs.width = ICON_PX;
  cvs.height = ICON_PX;
  const ctx = cvs.getContext('2d')!;
  const c = ICON_PX / 2;

  ctx.clearRect(0, 0, ICON_PX, ICON_PX);

  ctx.fillStyle = '#25D366';
  ctx.beginPath();
  ctx.arc(c, c, c * 0.88, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c - 4, c + 2, c * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#25D366';
  ctx.beginPath();
  ctx.moveTo(c + 18, c + 30);
  ctx.lineTo(c + 34, c + 44);
  ctx.lineTo(c + 28, c + 26);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#25D366';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c - 18, c - 6);
  ctx.lineTo(c - 18, c + 10);
  ctx.quadraticCurveTo(c - 18, c + 22, c - 6, c + 22);
  ctx.lineTo(c + 8, c + 22);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

interface Props {
  side: 'left' | 'right';
  boothW: number;
  boothD: number;
  y?: number;
  frontZ?: number;
  label?: string;
  onClick: () => void;
}

/** WhatsApp contact badge on the visitor-facing front — billboards toward camera with a gentle spin. */
export const BoothMeetBadge: React.FC<Props> = ({ side, boothW, boothD, y = 1.06, frontZ, label, onClick }) => {
  const texture = useMemo(() => buildWhatsAppIconTexture(), []);
  const spinRef = useRef<THREE.Group>(null);
  useEffect(() => () => texture.dispose(), [texture]);

  const iconSize = 0.3;
  const counterHalfW = boothW * 0.26;
  const x = side === 'left' ? -(counterHalfW + 0.58) : counterHalfW + 0.58;
  const z = frontZ ?? boothD / 2 - 0.32;

  useFrame(({ clock }) => {
    if (!spinRef.current) return;
    spinRef.current.rotation.y = Math.sin(clock.elapsedTime * 2.2) * 0.35;
  });

  const stop = (e: ThreeEvent<MouseEvent>) => e.stopPropagation();
  const pointer = {
    onPointerOver: () => { document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = 'auto'; },
  };

  return (
    <group position={[x, y, z]}>
      <Billboard>
        <group ref={spinRef}>
          <mesh
            onClick={(e) => { stop(e); onClick(); }}
            {...pointer}
            renderOrder={12}
          >
            <planeGeometry args={[iconSize, iconSize]} />
            <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
          </mesh>
          {label && (
            <CanvasLabel
              text={label}
              width={0.62}
              height={0.11}
              position={[0, -iconSize * 0.58, 0.01]}
              color="#0f172a"
              bold={false}
              onClick={(e) => { stop(e); onClick(); }}
              onPointerOver={pointer.onPointerOver}
              onPointerOut={pointer.onPointerOut}
            />
          )}
        </group>
      </Billboard>
    </group>
  );
};
