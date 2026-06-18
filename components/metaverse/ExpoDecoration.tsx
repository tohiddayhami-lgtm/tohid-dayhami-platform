import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import type { ExpoDecoration, MetaExpoEvent } from '../../types';
import { Language } from '../../App';
import { bi } from './expoUtils';
import { GltfModel } from './GltfModel';
import { TexBoundary } from './Booth';
import { CanvasLabel } from './CanvasLabel';

interface Props {
  deco: ExpoDecoration;
  lang: Language;
  onTrack?: (type: MetaExpoEvent['type'], opts?: Partial<MetaExpoEvent>) => void;
}

const openLink = (raw?: string) => {
  const href = (raw || '').trim();
  if (!href) return;
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

/** A hall-level GLB decoration — optional click → audio or hyperlink. */
export const ExpoDecorationMesh: React.FC<Props> = ({ deco, lang, onTrack }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useMemo(() => (
    lang === 'fa'
      ? (deco.audioUrlFa || deco.audioUrl || deco.audioUrlEn || '')
      : (deco.audioUrlEn || deco.audioUrl || deco.audioUrlFa || '')
  ).trim(), [deco.audioUrl, deco.audioUrlEn, deco.audioUrlFa, lang]);

  const linkUrl = (deco.linkUrl || '').trim();
  const interactive = !!(audioUrl || linkUrl);
  const s = deco.scale ?? 1;
  const hitW = Math.max(1.4, 2.2 * s);
  const hitH = Math.max(1.2, 2 * s);
  const hitD = Math.max(1.4, 2.2 * s);
  const badge = audioUrl ? '♪' : '🔗';
  const label = bi(deco.name, lang, '');

  useEffect(() => () => {
    const a = audioRef.current;
    if (a) { a.pause(); a.src = ''; }
    audioRef.current = null;
  }, []);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!interactive) return;
    const base = {
      targetId: deco.id,
      targetName: label || deco.id,
      side: 'decoration',
    };
    if (audioUrl) {
      let audio = audioRef.current;
      if (!audio || audio.src !== audioUrl) {
        audio?.pause();
        audio = new Audio(audioUrl);
        audioRef.current = audio;
      }
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      onTrack?.('decoration_click', { ...base, targetType: 'decoration_audio' });
      return;
    }
    openLink(linkUrl);
    onTrack?.('decoration_click', { ...base, targetType: 'decoration_link' });
  };

  if (!deco.modelUrl) return null;

  const pointer = {
    onPointerOver: () => { if (interactive) document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = 'auto'; },
  };

  return (
    <group position={[deco.x, deco.y ?? 0, deco.z]} rotation={[0, deco.ry ?? 0, 0]}>
      <TexBoundary key={deco.modelUrl}>
        <Suspense fallback={null}>
          <GltfModel url={deco.modelUrl} scale={s} pickable={!interactive} />
        </Suspense>
      </TexBoundary>
      {interactive && (
        <>
          <mesh position={[0, hitH / 2, 0]} onClick={handleClick} {...pointer}>
            <boxGeometry args={[hitW, hitH, hitD]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <Billboard position={[0, hitH + 0.18, 0]}>
            <CanvasLabel text={badge} width={0.28} height={0.28} color="#ffffff" bg="rgba(15,23,42,.78)" onClick={handleClick} {...pointer} />
          </Billboard>
        </>
      )}
    </group>
  );
};
