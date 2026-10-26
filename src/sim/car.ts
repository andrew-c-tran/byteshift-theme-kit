/**
 * A pretend car for `bst dev`. It answers commands roughly as the real one does, including the
 * parts that are inconvenient for a theme: control starts disabled, temperatures, fan speed and
 * volume are never reported, and two buttons have no command at all. A theme that looks right here
 * has already met each of those.
 */
import { buttonOf, type Command } from '../commands';
import type { CarState, CommandResult, Vent } from '../types';

const VENTS: Exclude<Vent, null>[] = ['face', 'face-feet', 'feet', 'feet-screen'];

export function initialCar(): CarState {
  return {
    climate: {
      dual: false, auto: true, ac: true, off: false,
      intake: 'fresh', vent: 'face', frontDefrost: false, rearDefrost: false,
    },
    radio: { muted: false },
    control: { connected: true, simulated: true, enabled: false, unavailable: ['SAT', 'RADIO_POWER'] },
  };
}

export class SimCar {
  state: CarState = initialCar();
  private listeners = new Set<(s: CarState) => void>();

  subscribe(f: (s: CarState) => void): () => void {
    this.listeners.add(f);
    f(this.state);
    return () => { this.listeners.delete(f); };
  }

  /** Overrides for the simulator's own controls, e.g. to see the theme offline. */
  patchControl(patch: Partial<CarState['control']>): void {
    this.commit({ ...this.state, control: { ...this.state.control, ...patch } });
  }

  command(command: Command): CommandResult {
    const s = structuredClone(this.state);
    const c = s.climate;
    const r = s.radio;
    const button = buttonOf(command);
    if (button && s.control.unavailable.includes(button)) return { ok: false, reason: 'unavailable' };
    if (!s.control.connected) return { ok: false, reason: 'offline' };
    if (!s.control.enabled && button !== 'ENABLE_CONTROL') return { ok: false, reason: 'disabled' };
    // The car acts on the press; the release is accepted and changes nothing.
    if (command.endsWith('_RELEASED')) return { ok: true };

    const wake = () => {
      if (!c.off) return;
      c.off = false;
      c.vent = c.vent ?? 'face';
    };

    switch (command) {
      // Temperatures change nothing the car reports.
      case 'FAN_UP': case 'FAN_DOWN':
        wake();
        // Touching the fan takes it out of AUTO.
        c.auto = false;
        break;
      case 'AC_PRESSED': wake(); c.ac = !c.ac; break;
      case 'AUTO_PRESSED':
        c.off = false; c.auto = true; c.ac = true; c.frontDefrost = false; c.vent = 'face';
        break;
      case 'DUAL_PRESSED':
        c.dual = !c.dual;
        break;
      case 'MODE_PRESSED':
        wake();
        c.auto = false;
        c.frontDefrost = false;
        c.vent = VENTS[(VENTS.indexOf(c.vent ?? 'feet-screen') + 1) % VENTS.length];
        break;
      case 'INTAKE_PRESSED': c.intake = c.intake === 'fresh' ? 'recirc' : 'fresh'; break;
      case 'FRONT_DEFROST_PRESSED':
        wake();
        c.frontDefrost = !c.frontDefrost;
        c.vent = c.frontDefrost ? null : 'face';
        if (c.frontDefrost) { c.ac = true; c.auto = false; }
        break;
      case 'REAR_DEFROST_PRESSED': c.rearDefrost = !c.rearDefrost; break;
      case 'CLIMATE_OFF_PRESSED':
        Object.assign(c, { off: true, auto: false, ac: false, vent: null, frontDefrost: false });
        break;
      // Turning the volume brings the sound back, as the car's own knob does.
      case 'VOLUME_UP': case 'VOLUME_DOWN': r.muted = false; break;
      case 'MUTE_PRESSED': r.muted = !r.muted; break;
      case 'ENABLE_CONTROL_PRESSED': s.control.enabled = true; break;
      // Tuning, sources and presets change nothing the car reports.
      default: break;
    }
    this.commit(s);
    return { ok: true };
  }

  private commit(s: CarState) {
    this.state = s;
    this.listeners.forEach((f) => f(s));
  }
}
