import React, { useEffect, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  text: string;
  width: number;            // plane width in meters
  height: number;           // plane height in meters
  position?: [number, number, number];
  rotation?: [number, number, number];
  bg?: string;              // optional rounded background fill
  color?: string;           // text color
  bold?: boolean;
  radius?: number;          // bg corner radius (px on the source canvas)
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

// A text label baked into a CanvasTexture on a plane. Unlike drei <Html>, this renders inside an
// immersive WebXR session (so booth names / buttons are visible in VR) and shapes Persian/Arabic
// correctly using the page's loaded font. Clickable, so it doubles as an in-world button.
export const CanvasLabel: React.FC<Props> = ({ text, width, height, position, rotation, bg, color = '#ffffff', bold = true, radius = 28, onClick, onPointerOver, onPointerOut }) => {
  const texture = useMemo(() => {
    const W = 1024;
    const H = Math.max(64, Math.round((W * height) / width));
    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = H;
    const ctx = cvs.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    if (bg) {
      ctx.fillStyle = bg;
      ctx.beginPath();
      if ((ctx as any).roundRect) (ctx as any).roundRect(2, 2, W - 4, H - 4, radius);
      else ctx.rect(2, 2, W - 4, H - 4);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    (ctx as any).direction = 'rtl';
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    let fontPx = Math.floor(H * 0.52);
    const weight = bold ? '800' : '500';
    ctx.font = `${weight} ${fontPx}px Vazirmatn, sans-serif`;
    while (ctx.measureText(text).width > W - 48 && fontPx > 12) {
      fontPx -= 3;
      ctx.font = `${weight} ${fontPx}px Vazirmatn, sans-serif`;
    }
    ctx.fillText(text, W / 2, H / 2 + 2);
    const tex = new THREE.CanvasTexture(cvs);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [text, width, height, bg, color, bold, radius]);

  useEffect(() => () => texture.dispose(), [texture]);

  // Stop propagation so a click on this label doesn't ALSO trigger the mesh sitting behind it
  // (e.g. an arrow button's backing plane) — that double-fire made the PDF skip pages / open 2 tabs.
  const handleClick = onClick ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(e); } : undefined;
  return (
    <mesh position={position} rotation={rotation} onClick={handleClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
};
