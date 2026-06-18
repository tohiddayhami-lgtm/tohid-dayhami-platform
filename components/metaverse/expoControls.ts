import type { MutableRefObject } from 'react';

// Single source of movement/look input, written by keyboard (desktop), the on-screen
// joystick (mobile) and drag-look, and consumed by <Player> inside the Canvas each frame.
// Keeping ONE authority prevents the "camera fighting itself" bug when several controllers mount.
export interface ControlState {
  keys: { forward: boolean; back: boolean; left: boolean; right: boolean; up: boolean; down: boolean };
  joy: { x: number; y: number };       // normalized [-1,1] from the mobile MOVE joystick
  look: { x: number; y: number };      // normalized [-1,1] from the mobile LOOK joystick (continuous turn)
  yawDelta: number;                    // accumulated look deltas (radians) applied & zeroed per frame
  pitchDelta: number;
  run: boolean;
}

export const makeControlState = (): ControlState => ({
  keys: { forward: false, back: false, left: false, right: false, up: false, down: false },
  joy: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  yawDelta: 0,
  pitchDelta: 0,
  run: false,
});

export type ControlRef = MutableRefObject<ControlState>;

// Where the player currently is (read by the minimap; written by <Player> each frame).
export interface PlayerPose { x: number; z: number; heading: number; y?: number; floor?: number }
export type PlayerPoseRef = MutableRefObject<PlayerPose>;

// Lets non-Player code (e.g. double-click teleport on the floor) move the player.
export type TeleportRef = MutableRefObject<((x: number, z: number) => void) | null>;
