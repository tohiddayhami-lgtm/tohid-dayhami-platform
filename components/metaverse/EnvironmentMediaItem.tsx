import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Billboard, useTexture, useVideoTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { ExpoEnvironmentMedia, MetaExpoEvent, MetaverseHotspot } from '../../types';
import { Language } from '../../App';
import { bi, isGif, isPdfFile, isVideoFile } from './expoUtils';
import { TexBoundary } from './Booth';
import { PresentationScreen } from './WallMedia';
import { GltfModel } from './GltfModel';
import { CanvasLabel } from './CanvasLabel';

interface Props {
  item: ExpoEnvironmentMedia;
  lang: Language;
  editMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onSelectHotspot?: (h: MetaverseHotspot) => void;
  onTrack?: (type: MetaExpoEvent['type'], opts?: Partial<MetaExpoEvent>) => void;
}

const openLink = (raw?: string) => {
  const href = (raw || '').trim();
  if (!href) return;
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const openPhone = (phone?: string) => {
  const p = (phone || '').replace(/\s/g, '');
  if (!p) return;
  window.open(`tel:${p}`, '_self');
};

const openWhatsApp = (wa?: string) => {
  const p = (wa || '').replace(/\D/g, '');
  if (!p) return;
  window.open(`https://wa.me/${p}`, '_blank', 'noopener,noreferrer');
};

const BUTTON_GLYPH: Record<string, string> = {
  url: '🔗',
  whatsapp: '💬',
  phone: '📞',
  meet: '📹',
  contact: '✉️',
};

const ScreenImage: React.FC<{ url: string; w: number; h: number; onClick?: () => void }> = ({ url, w, h, onClick }) => {
  const tex = useTexture(url);
  const clickProps = {
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick?.(); },
    onPointerOver: () => { if (onClick) document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = 'auto'; },
  };
  return (
    <mesh position={[0, 0, 0.04]} {...clickProps}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex as THREE.Texture} transparent toneMapped={false} />
    </mesh>
  );
};

const ScreenVideo: React.FC<{ url: string; w: number; h: number; onClick?: () => void }> = ({ url, w, h, onClick }) => {
  const tex = useVideoTexture(url, { muted: true, loop: true, start: true, crossOrigin: 'anonymous', playsInline: true } as any);
  const clickProps = {
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick?.(); },
    onPointerOver: () => { if (onClick) document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = 'auto'; },
  };
  return (
    <mesh position={[0, 0, 0.04]} {...clickProps}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex as THREE.Texture} toneMapped={false} />
    </mesh>
  );
};

const ScreenGif: React.FC<{ url: string; w: number; h: number; onClick?: () => void }> = ({ url, w, h, onClick }) => {
  const state = useMemo(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const o = { img, canvas, tex, ready: false };
    img.onload = () => { canvas.width = img.naturalWidth || 256; canvas.height = img.naturalHeight || 256; o.ready = true; };
    img.src = url;
    return o;
  }, [url]);
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (!state.ready) return;
    acc.current += dt;
    if (acc.current < 1 / 15) return;
    acc.current = 0;
    const ctx = state.canvas.getContext('2d');
    if (ctx) { ctx.drawImage(state.img, 0, 0, state.canvas.width, state.canvas.height); state.tex.needsUpdate = true; }
  });
  useEffect(() => () => state.tex.dispose(), [state]);
  const clickProps = {
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick?.(); },
    onPointerOver: () => { if (onClick) document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = 'auto'; },
  };
  return (
    <mesh position={[0, 0, 0.04]} {...clickProps}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={state.tex} transparent toneMapped={false} />
    </mesh>
  );
};

const ScreenPlane: React.FC<{ url: string; w: number; h: number; onClick?: () => void }> = ({ url, w, h, onClick }) => {
  if (isPdfFile(url)) return <PresentationScreen url={url} w={w} h={h} position={[0, 0, 0.04]} rotation={[0, 0, 0]} />;
  if (isVideoFile(url)) return <ScreenVideo url={url} w={w} h={h} onClick={onClick} />;
  if (isGif(url)) return <ScreenGif url={url} w={w} h={h} onClick={onClick} />;
  return <ScreenImage url={url} w={w} h={h} onClick={onClick} />;
};

const AudioOrb: React.FC<{ url: string; w: number; label: string; onClick: () => void }> = ({ url, w, label, onClick }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audioRef.current?.pause(); }, []);
  const play = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    let a = audioRef.current;
    if (!a || a.src !== url) { a?.pause(); a = new Audio(url); audioRef.current = a; }
    if (a.paused) a.play().catch(() => {});
    else a.pause();
    onClick();
  };
  return (
    <Billboard>
      <mesh onClick={play} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
        <circleGeometry args={[w * 0.35, 32]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.9} />
      </mesh>
      <CanvasLabel text="♪" width={w * 0.4} height={w * 0.4} position={[0, 0, 0.01]} color="#fff" onClick={play} />
      {label && <CanvasLabel text={label} width={w * 0.8} height={0.12} position={[0, -w * 0.45, 0.01]} color="#e2e8f0" bold={false} />}
    </Billboard>
  );
};

/** One placed screen, file, GLB or action button inside a custom GLB environment. */
export const EnvironmentMediaItem: React.FC<Props> = ({
  item, lang, editMode, selected, onSelect, onSelectHotspot, onTrack,
}) => {
  const sc = item.scale ?? 1;
  const w = (item.w ?? 2) * sc;
  const h = (item.h ?? 1.2) * sc;
  const ry = item.ry ?? 0;
  const label = bi(item.title, lang, '');
  const color = item.color || '#22d3ee';

  const handleSelect = (e: ThreeEvent<MouseEvent>) => {
    if (!editMode) return;
    e.stopPropagation();
    onSelect?.(item.id);
  };

  const runButton = () => {
    const act = item.action || 'url';
    onTrack?.('hotspot_click', { targetId: item.id, targetName: label || item.id, targetType: 'env_media', side: act });
    if (act === 'whatsapp') openWhatsApp(item.whatsapp || item.phone);
    else if (act === 'phone') openPhone(item.phone);
    else if (act === 'meet') openLink(item.meetUrl || item.url);
    else if (act === 'contact' && onSelectHotspot) {
      onSelectHotspot({
        id: item.id, type: 'contact', x: item.x, y: item.y, z: item.z,
        title: item.title, phone: item.phone, email: item.email, whatsapp: item.whatsapp,
      });
    } else openLink(item.url);
  };

  const selectionBox = editMode && selected ? (
    <mesh>
      <boxGeometry args={[w + 0.12, h + 0.12, 0.08]} />
      <meshBasicMaterial color="#f59e0b" wireframe transparent opacity={0.85} />
    </mesh>
  ) : null;

  if (item.kind === 'button') {
    const glyph = item.icon || BUTTON_GLYPH[item.action || 'url'] || '🔘';
    return (
      <group position={[item.x, item.y, item.z]} rotation={[0, ry, 0]} onClick={handleSelect}>
        {selectionBox}
        <Billboard>
          <mesh
            onClick={(e) => { e.stopPropagation(); editMode ? onSelect?.(item.id) : runButton(); }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            <circleGeometry args={[Math.max(0.28, w * 0.22), 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.92} />
          </mesh>
          <CanvasLabel text={glyph} width={w * 0.5} height={w * 0.5} position={[0, 0, 0.01]} color="#fff" />
          {label && (
            <CanvasLabel text={label} width={w * 0.9} height={0.14} position={[0, -w * 0.38, 0.01]} color="#f8fafc" bold={false} />
          )}
        </Billboard>
      </group>
    );
  }

  if (item.kind === 'glb' && item.url) {
    return (
      <group position={[item.x, item.y, item.z]} rotation={[0, ry, 0]} onClick={handleSelect}>
        {selectionBox}
        <TexBoundary key={item.url}>
          <Suspense fallback={null}>
            <GltfModel url={item.url} scale={sc} />
          </Suspense>
        </TexBoundary>
        {label && <CanvasLabel text={label} width={1.2} height={0.14} position={[0, h * 0.6, 0]} color="#e2e8f0" />}
      </group>
    );
  }

  if (item.kind === 'audio' && item.url) {
    return (
      <group position={[item.x, item.y, item.z]} onClick={handleSelect}>
        {selectionBox}
        <AudioOrb url={item.url} w={w} label={label} onClick={() => onTrack?.('decoration_click', { targetId: item.id, targetName: label, targetType: 'env_audio' })} />
      </group>
    );
  }

  const mediaUrl = item.url || '';
  const hasMedia = !!mediaUrl;

  return (
    <group position={[item.x, item.y, item.z]} rotation={[0, ry, 0]} onClick={handleSelect}>
      {selectionBox}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[w + 0.1, h + 0.1]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#0f172a" emissive="#0a1626" emissiveIntensity={0.4} />
      </mesh>
      {!hasMedia && (
        <CanvasLabel text={label || (item.kind === 'video' ? '▶' : '🖼')} width={w * 0.6} height={h * 0.3} position={[0, 0, 0.02]} color="#94a3b8" />
      )}
      {hasMedia && (
        <TexBoundary key={mediaUrl}>
          <Suspense fallback={null}>
            {item.kind === 'html' ? (
              <CanvasLabel text={label || 'HTML'} width={w * 0.7} height={h * 0.25} position={[0, 0, 0.04]} color="#fff" onClick={editMode ? undefined : () => openLink(mediaUrl)} />
            ) : (
              <ScreenPlane url={mediaUrl} w={w} h={h} onClick={editMode ? undefined : () => {
                onTrack?.('hotspot_click', { targetId: item.id, targetName: label, targetType: 'env_media', side: item.kind });
                if (item.kind === 'video' || item.kind === 'image' || item.kind === 'pdf') {
                  if (onSelectHotspot) onSelectHotspot({ id: item.id, type: item.kind as any, x: item.x, y: item.y, z: item.z, url: mediaUrl, title: item.title });
                } else openLink(mediaUrl);
              }} />
            )}
          </Suspense>
        </TexBoundary>
      )}
    </group>
  );
};
