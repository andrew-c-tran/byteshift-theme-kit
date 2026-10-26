/** Small pieces the strip and both pages share. */
import { PressButton, sendCommand, useControl, type Button, type Knob } from '@byteshift/theme';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/**
 * One detent of a knob per tap. Knobs have no press and release, only steps, so a plain click is
 * all it takes.
 */
export function Step({ knob, label, className, children }: {
  knob: Knob; label: string; className?: string; children: ReactNode;
}) {
  return (
    <button type="button" className={className} aria-label={label} onClick={() => void sendCommand(knob)}>
      {children}
    </button>
  );
}

/** A climate or audio button with a glyph and a word, lit while the car says it is on. */
export function Key({ button, on, icon, label, className = '' }: {
  button: Button; on: boolean; icon?: IconName; label: string; className?: string;
}) {
  return (
    <PressButton button={button} className={`key${on ? ' on' : ''} ${className}`}>
      {icon && <Icon name={icon} size={24} />}
      <span>{label}</span>
    </PressButton>
  );
}

/**
 * The link light and the enable button. Until control is enabled for this drive the car refuses
 * every command, so this has to be somewhere a driver can always reach it.
 */
export function Status({ compact = false }: { compact?: boolean }) {
  const control = useControl();
  if (control && !control.enabled) {
    return (
      <PressButton button="ENABLE_CONTROL" className="enable">
        {compact ? 'TAP TO ENABLE' : 'CONTROL OFF · TAP TO ENABLE'}
      </PressButton>
    );
  }
  const kind = !control?.connected ? 'offline' : control.simulated ? 'sim' : 'live';
  if (compact) return <div className={`link ${kind}`} />;
  return (
    <div className="status">
      <span className={`dot ${kind}`} />
      {kind === 'offline' ? 'CONTROLLER NOT CONNECTED' : kind === 'sim' ? 'SIMULATED CAR' : 'CONNECTED'}
    </div>
  );
}

/** The page header: status on the left, where the next swipe goes on the right. */
export function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <header>
      <h1>{title}</h1>
      <Status />
      <span className="hint">{hint}</span>
    </header>
  );
}
