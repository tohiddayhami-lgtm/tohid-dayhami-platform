import React, { useEffect, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CanvasLabel } from './CanvasLabel';

const ICON_PX = 128;

const buildMeetIconTexture = () => {
  const cvs = document.createElement('canvas');
  cvs.width = ICON_PX;
  cvs.height = ICON_PX;
  const ctx = cvs.getContext('2d')!;
  const c = ICON_PX / 2;

  ctx.clearRect(0, 0, ICON_PX, ICON_PX);

  // Google Meet–style green badge
  ctx.fillStyle = '#00897B';
  ctx.beginPath();
  ctx.arc(c, c, c * 0.88, 0, Math.PI * 2);
  ctx.fill();

  // White video camera body
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if ((ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect) {
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(c - 30, c - 18, 44, 30, 7);
  } else {
    ctx.rect(c - 30, c - 18, 44, 30);
  }
  ctx.fill();

  // Camera lens triangle (viewfinder arm)
  ctx.beginPath();
  ctx.moveTo(c + 16, c - 6);
  ctx.lineTo(c + 34, c - 14);
  ctx.lineTo(c + 34, c + 2);
  ctx.closePath();
  ctx.fill();

  // Lens dot
  ctx.fillStyle = '#00897B';
  ctx.beginPath();
  ctx.arc(c - 12, c - 3, 7, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

interface Props {
  side: 'left' | 'right';
  boothW: number;
  boothD: number;
  label?: string;
  onClick: () => void;
}

/** Small Google Meet call badge on the booth flank — icon only, optional tiny caption (no panel bg). */
export const BoothMeetBadge: React.FC<Props> = ({ side, boothW, boothD, label, onClick }) => {
  const texture = useMemo(() => buildMeetIconTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  const iconSize = 0.3;
  const x = side === 'right' ? boothW / 2 + 0.18 : -boothW / 2 - 0.18;
  const y = 1.52;
  const z = boothD * 0.12;
  const yaw = side === 'right' ? -Math.PI / 2 : Math.PI / 2;

  const stop = (e: ThreeEvent<MouseEvent>) => e.stopPropagation();
  const pointer = {
    onPointerOver: () => { document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = 'auto'; },
  };

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <mesh
        onClick={(e) => { stop(e); onClick(); }}
        {...pointer}
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
  );
};
