import React from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Language } from '../../App';
import { BUSINESS_CENTER, businessCenterFloorY } from './expoUtils';
import { CanvasLabel } from './CanvasLabel';

interface Props {
  width: number;
  depth: number;
  lang: Language;
  wallColor?: string;
  accentColor?: string;
}

const OFFICE_W = 4.2;
const OFFICE_D = 3.8;
const OFFICE_H = 3.35;
const GLASS = '#93c5fd';

/** Procedural 3-floor commercial building with ceiling offices + central stairs. */
export const BusinessCenterBuilding: React.FC<Props> = ({
  width,
  depth,
  lang,
  wallColor = '#e2e8f0',
  accentColor = '#0f766e',
}) => {
  const floorLabels = lang === 'fa'
    ? ['همکف · لابی', 'طبقه اول · دفاتر تجاری', 'طبقه دوم · دفاتر تجاری']
    : ['Ground · Lobby', '1st Floor · Offices', '2nd Floor · Offices'];

  const officeSlots: { x: number; z: number; ry: number }[] = [
    { x: width / 2 - 3.2, z: depth / 2 - 4.5, ry: Math.PI },
    { x: width / 2 - 3.2, z: 0, ry: Math.PI },
    { x: width / 2 - 3.2, z: -depth / 2 + 4.5, ry: Math.PI },
    { x: 2, z: -depth / 2 + 3.2, ry: 0 },
    { x: 8, z: -depth / 2 + 3.2, ry: 0 },
    { x: 2, z: depth / 2 - 3.2, ry: Math.PI },
    { x: 8, z: depth / 2 - 3.2, ry: Math.PI },
  ];

  const renderOffice = (x: number, z: number, ry: number, floor: number, idx: number) => {
    const baseY = businessCenterFloorY(floor);
    const rot = ry;
    const glassFacing = ry === Math.PI ? 1 : -1;
    return (
      <group key={`office-${floor}-${idx}`} position={[x, baseY, z]} rotation={[0, rot, 0]}>
        {/* Floor slab inside unit */}
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[OFFICE_W, 0.08, OFFICE_D]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.55} />
        </mesh>
        {/* Side & back walls */}
        <mesh position={[-OFFICE_W / 2 + 0.06, OFFICE_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, OFFICE_H, OFFICE_D]} />
          <meshStandardMaterial color={wallColor} roughness={0.65} />
        </mesh>
        <mesh position={[OFFICE_W / 2 - 0.06, OFFICE_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, OFFICE_H, OFFICE_D]} />
          <meshStandardMaterial color={wallColor} roughness={0.65} />
        </mesh>
        <mesh position={[0, OFFICE_H / 2, -OFFICE_D / 2 + 0.06]} castShadow receiveShadow>
          <boxGeometry args={[OFFICE_W, OFFICE_H, 0.12]} />
          <meshStandardMaterial color={wallColor} roughness={0.65} />
        </mesh>
        {/* Ceiling (سقف دفتر) */}
        <mesh position={[0, OFFICE_H, 0]} castShadow receiveShadow>
          <boxGeometry args={[OFFICE_W, 0.14, OFFICE_D]} />
          <meshStandardMaterial color="#f8fafc" emissive="#ffffff" emissiveIntensity={0.08} roughness={0.4} />
        </mesh>
        {/* Glass storefront toward corridor */}
        <mesh position={[0, OFFICE_H * 0.48, glassFacing * (OFFICE_D / 2 - 0.04)]}>
          <boxGeometry args={[OFFICE_W * 0.82, OFFICE_H * 0.72, 0.06]} />
          <meshStandardMaterial color={GLASS} transparent opacity={0.38} metalness={0.55} roughness={0.12} side={THREE.DoubleSide} />
        </mesh>
        {/* Door frame */}
        <mesh position={[0, OFFICE_H * 0.38, glassFacing * (OFFICE_D / 2 - 0.02)]}>
          <boxGeometry args={[1.1, 2.2, 0.08]} />
          <meshStandardMaterial color={accentColor} metalness={0.35} roughness={0.35} />
        </mesh>
        {/* Ceiling light panel */}
        <mesh position={[0, OFFICE_H - 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[OFFICE_W * 0.55, OFFICE_D * 0.45]} />
          <meshStandardMaterial color="#ffffff" emissive="#fff7ed" emissiveIntensity={0.65} toneMapped={false} />
        </mesh>
        <pointLight position={[0, OFFICE_H - 0.2, 0]} intensity={0.35} distance={6} color="#fff7ed" />
      </group>
    );
  };

  const renderStairs = () => {
    const steps: React.ReactNode[] = [];
    const totalSteps = 36;
    const { stairX, stairZMin, stairZMax } = BUSINESS_CENTER;
    for (let i = 0; i < totalSteps; i++) {
      const t = i / (totalSteps - 1);
      const z = stairZMax - t * (stairZMax - stairZMin);
      const y = t * BUSINESS_CENTER.floorHeight * (BUSINESS_CENTER.floors - 1);
      steps.push(
        <RoundedBox
          key={`step-${i}`}
          args={[2.2, 0.18, 0.55]}
          radius={0.03}
          smoothness={2}
          position={[stairX, y + 0.09, z]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={i % 2 === 0 ? '#cbd5e1' : '#94a3b8'} roughness={0.55} metalness={0.12} />
        </RoundedBox>,
      );
    }
    return (
      <group>
        {steps}
        {/* Stairwell glass shaft */}
        <mesh position={[stairX, BUSINESS_CENTER.floorHeight * 1.2, 0]}>
          <boxGeometry args={[0.08, BUSINESS_CENTER.floorHeight * 2.4, depth * 0.7]} />
          <meshStandardMaterial color={GLASS} transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[stairX - 1.15, BUSINESS_CENTER.floorHeight * 1.2, 0]}>
          <boxGeometry args={[0.08, BUSINESS_CENTER.floorHeight * 2.4, depth * 0.7]} />
          <meshStandardMaterial color={GLASS} transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
        <CanvasLabel
          text={lang === 'fa' ? 'پله‌ها ↑' : 'Stairs ↑'}
          width={1.4}
          height={0.32}
          position={[stairX, 2.2, stairZMax - 1.2]}
          bg={accentColor}
          color="#ffffff"
        />
      </group>
    );
  };

  const renderFloor = (floor: number) => {
    const y = businessCenterFloorY(floor);
    const isGround = floor === 0;
    return (
      <group key={`floor-${floor}`}>
        {/* Main corridor slab */}
        <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial
            color={isGround ? '#e8ecf2' : '#f1f5f9'}
            roughness={0.72}
            metalness={isGround ? 0.04 : 0.02}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
        {/* Atrium opening ring (visual) */}
        <mesh position={[3, y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.5, 4.2, 48]} />
          <meshStandardMaterial color={accentColor} transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
        {/* Floor label */}
        <CanvasLabel
          text={floorLabels[floor]}
          width={3.2}
          height={0.38}
          position={[width / 2 - 4.5, y + 2.8, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          bg="rgba(15,23,42,.88)"
          color="#ffffff"
        />
        {/* Perimeter railing toward atrium */}
        {floor > 0 && (
          <mesh position={[3, y + 0.55, 0]}>
            <torusGeometry args={[3.8, 0.04, 8, 48]} />
            <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.35} />
          </mesh>
        )}
        {/* Offices on this floor */}
        {officeSlots.map((slot, i) => renderOffice(slot.x, slot.z, slot.ry, floor, i))}
        {/* Floor divider slab between levels (except top) */}
        {floor < BUSINESS_CENTER.floors - 1 && (
          <mesh position={[0, y + BUSINESS_CENTER.floorHeight - 0.08, 0]} receiveShadow>
            <boxGeometry args={[width, 0.16, depth]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
          </mesh>
        )}
      </group>
    );
  };

  return (
    <group>
      {/* Exterior shell */}
      <mesh position={[0, BUSINESS_CENTER.floorHeight * 1.5, -depth / 2 - 0.15]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.6, BUSINESS_CENTER.floorHeight * BUSINESS_CENTER.floors + 1, 0.3]} />
        <meshStandardMaterial color="#334155" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[-width / 2 - 0.15, BUSINESS_CENTER.floorHeight * 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, BUSINESS_CENTER.floorHeight * BUSINESS_CENTER.floors + 1, depth + 0.6]} />
        <meshStandardMaterial color="#334155" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[width / 2 + 0.15, BUSINESS_CENTER.floorHeight * 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, BUSINESS_CENTER.floorHeight * BUSINESS_CENTER.floors + 1, depth + 0.6]} />
        <meshStandardMaterial color="#334155" roughness={0.55} metalness={0.2} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, BUSINESS_CENTER.floorHeight * BUSINESS_CENTER.floors + 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.8, 0.35, depth + 0.8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.25} />
      </mesh>
      {/* Building title */}
      <CanvasLabel
        text={lang === 'fa' ? 'مرکز تجاری متا' : 'Meta Business Center'}
        width={5.5}
        height={0.55}
        position={[0, BUSINESS_CENTER.floorHeight * BUSINESS_CENTER.floors + 1.2, depth / 2 + 0.5]}
        bg={accentColor}
        color="#ffffff"
      />

      {Array.from({ length: BUSINESS_CENTER.floors }, (_, f) => renderFloor(f))}
      {renderStairs()}
    </group>
  );
};
