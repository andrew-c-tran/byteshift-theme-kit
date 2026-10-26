/**
 * The frame's copy of what the host has told it: the car, the panel's position and its geometry.
 * Written only by frame/main.tsx as messages arrive; read through the hooks in index.ts.
 */
import type { Geometry, TrayPosition } from './protocol';
import type { CarState } from './types';

export interface FrameState {
  car: CarState | null;
  geometry: Geometry;
  tray: TrayPosition;
}

let state: FrameState = {
  car: null,
  geometry: { width: 853, height: 533, stripWidth: 128, insetTop: 0, insetBottom: 0 },
  tray: { mode: 'collapsed', reveal: 0, target: 0 },
};
const subs = new Set<() => void>();

export function getState(): FrameState {
  return state;
}

export function setState(patch: Partial<FrameState>): void {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}

export function subscribe(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

type Sender = (command: string) => Promise<import('./types').CommandResult>;
let sender: Sender = async () => ({ ok: false, reason: 'offline' });

/** frame/main.tsx installs the real one once it has a host to talk to. */
export function setSender(s: Sender): void {
  sender = s;
}

export function send(command: string) {
  return sender(command);
}
