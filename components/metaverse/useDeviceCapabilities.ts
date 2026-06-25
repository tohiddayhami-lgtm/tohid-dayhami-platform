import { useEffect, useState } from 'react';

export interface DeviceCapabilities {
  touch: boolean;        // touch / coarse-pointer device → use on-screen joystick
  finePointer: boolean;  // has a mouse → pointer-lock is viable
  vrSupported: boolean;  // navigator.xr reports an immersive-vr session is available
}

// Detects input modality + WebXR availability so the viewer can pick the right controls.
// Pointer Lock is desktop-only; the VR button is hidden unless an immersive-vr session is supported.
export const useDeviceCapabilities = (): DeviceCapabilities => {
  const [caps, setCaps] = useState<DeviceCapabilities>(() => {
    const touch = typeof window !== 'undefined' &&
      (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 ||
        (window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false));
    const finePointer = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: fine)').matches : !touch;
    return { touch, finePointer, vrSupported: false };
  });

  useEffect(() => {
    let cancelled = false;
    const xr = (navigator as any).xr;
    if (xr && typeof xr.isSessionSupported === 'function') {
      xr.isSessionSupported('immersive-vr')
        .then((ok: boolean) => { if (!cancelled) setCaps(c => ({ ...c, vrSupported: !!ok })); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, []);

  return caps;
};
