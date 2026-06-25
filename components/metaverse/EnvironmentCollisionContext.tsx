import React, { createContext, useContext, useMemo, useRef } from 'react';
import * as THREE from 'three';

export interface EnvironmentCollisionState {
  rootRef: React.MutableRefObject<THREE.Group | null>;
  meshesRef: React.MutableRefObject<THREE.Mesh[]>;
  ready: React.MutableRefObject<boolean>;
}

const EnvironmentCollisionContext = createContext<EnvironmentCollisionState | null>(null);

export const EnvironmentCollisionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const rootRef = useRef<THREE.Group | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const ready = useRef(false);
  const value = useMemo(() => ({ rootRef, meshesRef, ready }), []);
  return (
    <EnvironmentCollisionContext.Provider value={value}>
      {children}
    </EnvironmentCollisionContext.Provider>
  );
};

export const useEnvironmentCollision = (): EnvironmentCollisionState | null =>
  useContext(EnvironmentCollisionContext);
