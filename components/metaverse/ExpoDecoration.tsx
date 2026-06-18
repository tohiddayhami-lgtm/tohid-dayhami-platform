import React, { Suspense } from 'react';
import type { ExpoDecoration } from '../../types';
import { GltfModel } from './GltfModel';
import { TexBoundary } from './Booth';

interface Props {
  deco: ExpoDecoration;
}

/** A hall-level GLB decoration at world x/y/z with optional yaw and scale. */
export const ExpoDecorationMesh: React.FC<Props> = ({ deco }) => {
  if (!deco.modelUrl) return null;
  return (
    <group position={[deco.x, deco.y ?? 0, deco.z]} rotation={[0, deco.ry ?? 0, 0]}>
      <TexBoundary key={deco.modelUrl}>
        <Suspense fallback={null}>
          <GltfModel url={deco.modelUrl} scale={deco.scale ?? 1} />
        </Suspense>
      </TexBoundary>
    </group>
  );
};
