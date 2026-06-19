import React from 'react';
import type { ControlRef } from './expoControls';

/** Mobile fly up/down + jump buttons (right side, above move joystick). */
export const ExpoFlyControls: React.FC<{
  controlRef: ControlRef;
  flyMode: boolean;
  langFa: boolean;
}> = ({ controlRef, flyMode, langFa: T }) => {
  const setFlyV = (v: number) => { controlRef.current.flyVertical = v; };
  const jump = () => { controlRef.current.jumpPulse = true; };

  const btn = 'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-lg border-2 border-white/50 backdrop-blur-sm touch-none select-none active:scale-95 transition-transform';

  return (
    <div
      className="absolute z-40 flex flex-col gap-2 pointer-events-auto"
      style={{ bottom: 100, insetInlineEnd: 24 }}
    >
      {flyMode ? (
        <>
          <button
            type="button"
            className={btn + ' bg-sky-500/85 text-white'}
            onPointerDown={(e) => { e.stopPropagation(); setFlyV(1); }}
            onPointerUp={() => setFlyV(0)}
            onPointerCancel={() => setFlyV(0)}
            onPointerLeave={() => setFlyV(0)}
            title={T ? 'بالا' : 'Up'}
          >↑</button>
          <button
            type="button"
            className={btn + ' bg-slate-600/85 text-white'}
            onPointerDown={(e) => { e.stopPropagation(); setFlyV(-1); }}
            onPointerUp={() => setFlyV(0)}
            onPointerCancel={() => setFlyV(0)}
            onPointerLeave={() => setFlyV(0)}
            title={T ? 'پایین' : 'Down'}
          >↓</button>
        </>
      ) : (
        <button
          type="button"
          className={btn + ' bg-emerald-500/90 text-white'}
          onPointerDown={(e) => { e.stopPropagation(); jump(); }}
          title={T ? 'پرش' : 'Jump'}
        >⤒</button>
      )}
    </div>
  );
};
