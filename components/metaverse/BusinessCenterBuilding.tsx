import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BUSINESS_CENTER, businessCenterFloorY } from './expoUtils';

interface Props {
  width: number;
  depth: number;
  wallColor?: string;
  accentColor?: string;
  playerFloor?: number;
}

/**
 * Lightweight 3-floor shell — booths are the glass offices; no per-room geometry or lights.
 * Keeps draw calls low for smooth walking on mid-range devices.
 */
export const BusinessCenterBuilding: React.FC<Props> = React.memo(({
  width,
  depth,
  wallColor = '#e2e8f0',
  accentColor = '#0f766e',
  playerFloor = 0,
}) => {
  const totalH = BUSINESS_CENTER.floorHeight * BUSINESS_CENTER.floors;
  const { stairX, stairZMin, stairZMax } = BUSINESS_CENTER;
  const stairLen = stairZMax - stairZMin;
  const stairRise = BUSINESS_CENTER.floorHeight * (BUSINESS_CENTER.floors - 1);

  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.75 }), [wallColor]);
  const shellMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6 }), []);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8ecf2', roughness: 0.8 }), []);
  const ceilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.65 }), []);
  const stairMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.7 }), []);
  const railMat = useMemo(() => new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5 }), []);

  return (
    <group>
      {/* Exterior shell — 4 walls + roof (5 meshes) */}
      <mesh position={[0, totalH / 2, -depth / 2 - 0.12]} material={shellMat}>
        <boxGeometry args={[width + 0.4, totalH + 0.5, 0.24]} />
      </mesh>
      <mesh position={[-width / 2 - 0.12, totalH / 2, 0]} material={shellMat}>
        <boxGeometry args={[0.24, totalH + 0.5, depth + 0.4]} />
      </mesh>
      <mesh position={[width / 2 + 0.12, totalH / 2, 0]} material={shellMat}>
        <boxGeometry args={[0.24, totalH + 0.5, depth + 0.4]} />
      </mesh>
      <mesh position={[0, totalH + 0.2, depth / 2 + 0.12]} material={shellMat}>
        <boxGeometry args={[width + 0.4, 0.28, 0.24]} />
      </mesh>
      <mesh position={[0, totalH + 0.38, 0]} material={shellMat}>
        <boxGeometry args={[width + 0.6, 0.22, depth + 0.6]} />
      </mesh>

      {/* Per-floor slabs + corridor ceiling (only geometry, booths fill offices) */}
      {[0, 1, 2].map(floor => {
        const y = businessCenterFloorY(floor);
        return (
          <group key={floor}>
            <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMat}>
              <planeGeometry args={[width - 0.4, depth - 0.4]} />
            </mesh>
            {floor < BUSINESS_CENTER.floors - 1 && (
              <mesh position={[0, y + BUSINESS_CENTER.floorHeight - 0.06, 0]} material={ceilMat}>
                <boxGeometry args={[width - 0.4, 0.1, depth - 0.4]} />
              </mesh>
            )}
            {/* Corridor side walls (open toward center atrium) */}
            <mesh position={[width / 2 - 0.5, y + 1.6, 0]} material={wallMat}>
              <boxGeometry args={[0.1, 3.2, depth - 2]} />
            </mesh>
            <mesh position={[-width / 2 + 4.5, y + 1.6, 0]} material={wallMat}>
              <boxGeometry args={[0.1, 3.2, depth - 2]} />
            </mesh>
          </group>
        );
      })}

      {/* Single stair ramp (2 segments) instead of dozens of step meshes */}
      {[0, 1].map(seg => {
        const baseY = businessCenterFloorY(seg);
        const midZ = (stairZMax + stairZMin) / 2;
        const angle = Math.atan2(BUSINESS_CENTER.floorHeight, stairLen);
        return (
          <mesh
            key={`ramp-${seg}`}
            position={[stairX, baseY + BUSINESS_CENTER.floorHeight / 2, midZ]}
            rotation={[angle, 0, 0]}
            material={stairMat}
          >
            <boxGeometry args={[2.1, 0.14, stairLen + 0.4]} />
          </mesh>
        );
      })}
      {/* Stair rails — 2 thin boxes */}
      <mesh position={[stairX - 1.1, stairRise / 2 + 0.8, 0]} material={railMat}>
        <boxGeometry args={[0.06, 0.06, stairLen * 0.95]} />
      </mesh>
      <mesh position={[stairX + 1.1, stairRise / 2 + 0.8, 0]} material={railMat}>
        <boxGeometry args={[0.06, 0.06, stairLen * 0.95]} />
      </mesh>

      {/* Atrium accent — one low-poly ring on active floor only */}
      <mesh
        position={[3, businessCenterFloorY(playerFloor) + 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[2.2, 3.4, 24]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.15} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Floor indicator plaque (cheap mesh, no canvas texture) */}
      <mesh position={[width / 2 - 2.8, businessCenterFloorY(playerFloor) + 2.4, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.4, 0.45]} />
        <meshBasicMaterial color="#0f172a" toneMapped={false} />
      </mesh>
      <mesh position={[width / 2 - 2.75, businessCenterFloorY(playerFloor) + 2.4, 0.01]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.2, 0.08]} />
        <meshBasicMaterial color={accentColor} toneMapped={false} />
      </mesh>

      {/* Stairs hint — colored strip at ramp base */}
      <mesh position={[stairX, businessCenterFloorY(0) + 0.05, stairZMax - 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 0.9]} />
        <meshBasicMaterial color={accentColor} toneMapped={false} />
      </mesh>
    </group>
  );
});

BusinessCenterBuilding.displayName = 'BusinessCenterBuilding';
