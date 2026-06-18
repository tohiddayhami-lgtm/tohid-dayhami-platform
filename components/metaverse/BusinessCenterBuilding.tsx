import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  BUSINESS_CENTER,
  BUSINESS_CENTER_FLOOR_THEMES,
  businessCenterCarpetRects,
  businessCenterFloorY,
} from './expoUtils';
import { CanvasLabel } from './CanvasLabel';

interface Props {
  width: number;
  depth: number;
  playerFloor?: number;
}

const CarpetStrip: React.FC<{
  x: number;
  z: number;
  w: number;
  d: number;
  y: number;
  mat: THREE.Material;
  borderMat: THREE.Material;
}> = ({ x, z, w, d, y, mat, borderMat }) => (
  <group position={[x, y, z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} material={borderMat}>
      <planeGeometry args={[w + 0.14, d + 0.14]} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <planeGeometry args={[w, d]} />
    </mesh>
  </group>
);

/**
 * Lightweight 3-floor shell with distinct floor colors, carpet runners, and floor signs.
 */
export const BusinessCenterBuilding: React.FC<Props> = React.memo(({
  width,
  depth,
  playerFloor = 0,
}) => {
  const totalH = BUSINESS_CENTER.floorHeight * BUSINESS_CENTER.floors;
  const { stairX, stairZMin, stairZMax } = BUSINESS_CENTER;
  const stairLen = stairZMax - stairZMin;
  const stairRise = BUSINESS_CENTER.floorHeight * (BUSINESS_CENTER.floors - 1);

  const floorMats = useMemo(
    () => BUSINESS_CENTER_FLOOR_THEMES.map(t => new THREE.MeshStandardMaterial({ color: t.floorColor, roughness: 0.72 })),
    [],
  );
  const wallMats = useMemo(
    () => BUSINESS_CENTER_FLOOR_THEMES.map(t => new THREE.MeshStandardMaterial({ color: t.wallColor, roughness: 0.7 })),
    [],
  );
  const ceilMats = useMemo(
    () => BUSINESS_CENTER_FLOOR_THEMES.map(t => new THREE.MeshStandardMaterial({ color: t.ceilingColor, roughness: 0.65 })),
    [],
  );
  const zoneMats = useMemo(
    () => BUSINESS_CENTER_FLOOR_THEMES.map(t => new THREE.MeshBasicMaterial({ color: t.boothZone, transparent: true, opacity: 0.35, toneMapped: false })),
    [],
  );
  const carpetMats = useMemo(
    () => BUSINESS_CENTER_FLOOR_THEMES.map(t => new THREE.MeshStandardMaterial({ color: t.carpetColor, roughness: 0.85, metalness: 0.05 })),
    [],
  );
  const carpetBorderMats = useMemo(
    () => BUSINESS_CENTER_FLOOR_THEMES.map(t => new THREE.MeshBasicMaterial({ color: t.carpetBorder, transparent: true, opacity: 0.55, toneMapped: false, side: THREE.DoubleSide })),
    [],
  );
  const accentMats = useMemo(
    () => BUSINESS_CENTER_FLOOR_THEMES.map(t => new THREE.MeshStandardMaterial({ color: t.accent, roughness: 0.45 })),
    [],
  );

  const shellMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55 }), []);
  const stairCarpetMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#881337', roughness: 0.8 }), []);
  const stairRailMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4a574', roughness: 0.4, metalness: 0.2 }), []);

  const officeZones = [
    { x: 9, z: 0, w: 5.5, d: depth - 3 },
    { x: -3, z: 0, w: 7, d: depth - 4 },
  ];

  return (
    <group>
      {/* Exterior shell */}
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

      {[0, 1, 2].map(floor => {
        const y = businessCenterFloorY(floor);
        const theme = BUSINESS_CENTER_FLOOR_THEMES[floor];
        const isActive = floor === playerFloor;
        const carpets = businessCenterCarpetRects(floor as 0 | 1 | 2);

        return (
          <group key={floor}>
            {/* Floor slab */}
            <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMats[floor]}>
              <planeGeometry args={[width - 0.4, depth - 0.4]} />
            </mesh>

            {/* Office zones (subtle tint) */}
            {officeZones.map((zone, zi) => (
              <mesh key={`zone-${floor}-${zi}`} position={[zone.x, y + 0.025, zone.z]} rotation={[-Math.PI / 2, 0, 0]} material={zoneMats[floor]}>
                <planeGeometry args={[zone.w, zone.d]} />
              </mesh>
            ))}

            {/* Carpet runners */}
            {carpets.map((c, ci) => (
              <CarpetStrip
                key={`carpet-${floor}-${ci}`}
                x={c.x}
                z={c.z}
                w={c.w}
                d={c.d}
                y={y + 0.05}
                mat={carpetMats[floor]}
                borderMat={carpetBorderMats[floor]}
              />
            ))}

            {/* Floor accent band at slab edge */}
            <mesh position={[0, y + 0.04, depth / 2 - 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[width - 1.2, 0.35]} />
              <meshBasicMaterial color={theme.accent} transparent opacity={isActive ? 0.55 : 0.28} toneMapped={false} />
            </mesh>

            {floor < BUSINESS_CENTER.floors - 1 && (
              <>
                <mesh position={[0, y + BUSINESS_CENTER.floorHeight - 0.06, 0]} material={ceilMats[floor]}>
                  <boxGeometry args={[width - 0.4, 0.1, depth - 0.4]} />
                </mesh>
                {/* Colored trim under ceiling — separates floors visually */}
                <mesh position={[0, y + BUSINESS_CENTER.floorHeight - 0.12, 0]}>
                  <boxGeometry args={[width - 0.6, 0.06, depth - 0.6]} />
                  <meshBasicMaterial color={theme.signBg} transparent opacity={0.85} toneMapped={false} />
                </mesh>
              </>
            )}

            {/* Corridor side walls */}
            <mesh position={[width / 2 - 0.5, y + 1.6, 0]} material={wallMats[floor]}>
              <boxGeometry args={[0.1, 3.2, depth - 2]} />
            </mesh>
            <mesh position={[-width / 2 + 4.5, y + 1.6, 0]} material={wallMats[floor]}>
              <boxGeometry args={[0.1, 3.2, depth - 2]} />
            </mesh>

            {/* Floor sign at lobby */}
            <CanvasLabel
              text={theme.labelFa}
              width={3.2}
              height={0.42}
              position={[width / 2 - 3.2, y + 2.55, -1.5]}
              rotation={[0, -Math.PI / 2, 0]}
              bg={theme.signBg}
              color="#ffffff"
            />
            <CanvasLabel
              text={theme.labelEn}
              width={2.6}
              height={0.28}
              position={[width / 2 - 3.2, y + 2.1, -1.5]}
              rotation={[0, -Math.PI / 2, 0]}
              bg="rgba(255,255,255,.9)"
              color={theme.signBg}
              bold={false}
            />

            {/* Active-floor highlight ring in atrium */}
            {isActive && (
              <mesh position={[3, y + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.4, 3.6, 32]} />
                <meshBasicMaterial color={theme.accent} transparent opacity={0.22} toneMapped={false} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Stair ramps with carpet */}
      {[0, 1].map(seg => {
        const baseY = businessCenterFloorY(seg);
        const midZ = (stairZMax + stairZMin) / 2;
        const angle = Math.atan2(BUSINESS_CENTER.floorHeight, stairLen);
        return (
          <mesh
            key={`ramp-${seg}`}
            position={[stairX, baseY + BUSINESS_CENTER.floorHeight / 2, midZ]}
            rotation={[angle, 0, 0]}
            material={stairCarpetMat}
          >
            <boxGeometry args={[2.1, 0.14, stairLen + 0.4]} />
          </mesh>
        );
      })}
      <mesh position={[stairX - 1.1, stairRise / 2 + 0.8, 0]} material={stairRailMat}>
        <boxGeometry args={[0.06, 0.06, stairLen * 0.95]} />
      </mesh>
      <mesh position={[stairX + 1.1, stairRise / 2 + 0.8, 0]} material={stairRailMat}>
        <boxGeometry args={[0.06, 0.06, stairLen * 0.95]} />
      </mesh>

      {/* Stairs landing markers on each floor */}
      {[0, 1, 2].map(floor => {
        const y = businessCenterFloorY(floor);
        const theme = BUSINESS_CENTER_FLOOR_THEMES[floor];
        return (
          <group key={`stair-mark-${floor}`}>
            <mesh position={[stairX, y + 0.055, stairZMax - 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.1, 1]} />
              <meshBasicMaterial color={theme.carpetColor} toneMapped={false} />
            </mesh>
            <mesh position={[stairX, y + 0.07, stairZMin + 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.1, 1]} />
              <meshBasicMaterial color={theme.carpetBorder} transparent opacity={0.7} toneMapped={false} />
            </mesh>
          </group>
        );
      })}

      {/* Stair direction arrow on ground floor */}
      <mesh position={[stairX, businessCenterFloorY(0) + 0.08, stairZMax - 1.2]} rotation={[-Math.PI / 2, 0, 0]} material={accentMats[0]}>
        <planeGeometry args={[1.4, 0.5]} />
      </mesh>
    </group>
  );
});

BusinessCenterBuilding.displayName = 'BusinessCenterBuilding';
