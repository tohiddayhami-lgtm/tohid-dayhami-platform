import React from 'react';
import * as THREE from 'three';
import { BUSINESS_CENTER, businessCenterFloorY } from './expoUtils';
import { CanvasLabel } from './CanvasLabel';

interface Props {
  depth: number;
  width: number;
  title: string;
  subtitle?: string;
  accent?: string;
}

/**
 * Ground-floor lobby entrance — glass doors, canopy, and exterior welcome mat.
 */
export const BusinessCenterEntrance: React.FC<Props> = ({
  depth,
  width,
  title,
  subtitle,
  accent = '#0f766e',
}) => {
  const y = businessCenterFloorY(0);
  const doorZ = depth / 2 - 0.28;
  const extZ = depth / 2 + 1.1;
  const doorW = 3.6;
  const doorH = 2.45;

  return (
    <group>
      {/* Exterior apron */}
      <mesh position={[0, y + 0.03, extZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.min(width - 4, 8), 3.2]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.65} />
      </mesh>

      {/* Welcome mat (outside) */}
      <mesh position={[0, y + 0.065, extZ - 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[doorW + 0.6, 2.2]} />
        <meshStandardMaterial color="#9f1239" roughness={0.82} />
      </mesh>
      <mesh position={[0, y + 0.07, extZ - 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.14, 1.6]} />
        <meshBasicMaterial color="#d4a574" toneMapped={false} />
      </mesh>

      {/* Canopy */}
      <mesh position={[0, y + 3.05, doorZ + 0.55]} castShadow>
        <boxGeometry args={[doorW + 1.4, 0.14, 1.6]} />
        <meshStandardMaterial color="#334155" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[-(doorW + 0.8) / 2, y + 2.2, doorZ + 0.35]}>
        <boxGeometry args={[0.1, 1.7, 0.1]} />
        <meshStandardMaterial color={accent} roughness={0.4} />
      </mesh>
      <mesh position={[(doorW + 0.8) / 2, y + 2.2, doorZ + 0.35]}>
        <boxGeometry args={[0.1, 1.7, 0.1]} />
        <meshStandardMaterial color={accent} roughness={0.4} />
      </mesh>

      {/* Door frame */}
      <mesh position={[0, y + doorH / 2 + 0.02, doorZ]}>
        <boxGeometry args={[doorW + 0.2, doorH + 0.12, 0.12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Glass doors */}
      {[-0.85, 0.85].map(dx => (
        <mesh key={dx} position={[dx, y + doorH / 2 - 0.05, doorZ + 0.02]}>
          <planeGeometry args={[0.78, doorH - 0.15]} />
          <meshStandardMaterial color="#bff3ff" transparent opacity={0.32} roughness={0.05} metalness={0.15} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Interior lobby threshold strip */}
      <mesh position={[0, y + 0.045, doorZ - 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[doorW, 0.35]} />
        <meshBasicMaterial color={accent} transparent opacity={0.65} toneMapped={false} />
      </mesh>

      {/* Side rails guiding into lobby */}
      {[-1.35, 1.35].map(sx => (
        <mesh key={sx} position={[sx, y + 0.42, doorZ - 1.8]}>
          <boxGeometry args={[0.08, 0.08, 2.8]} />
          <meshStandardMaterial color="#d4a574" roughness={0.35} metalness={0.2} />
        </mesh>
      ))}

      <CanvasLabel text={title} width={3.6} height={0.38} position={[0, y + 2.65, doorZ + 0.08]} bg={accent} color="#ffffff" />
      {subtitle && (
        <CanvasLabel text={subtitle} width={2.8} height={0.26} position={[0, y + 2.2, doorZ + 0.08]} bg="rgba(255,255,255,.92)" color={accent} bold={false} />
      )}
    </group>
  );
};

BusinessCenterEntrance.displayName = 'BusinessCenterEntrance';
