/**
 * The second page: volume and tuning as knobs, the six presets, and the sources.
 */
import { PressButton, useAvailable, useRadio, type Button } from '@byteshift/theme';
import { Icon } from './icons';
import { Header, Key, Step } from './parts';

const PRESETS = ['PRESET_1', 'PRESET_2', 'PRESET_3', 'PRESET_4', 'PRESET_5', 'PRESET_6'] as const;

const SOURCES: { button: Button; label: string }[] = [
  { button: 'AM_FM', label: 'FM · AM' },
  { button: 'SAT', label: 'SAT' },
  { button: 'AUX', label: 'AUX' },
  { button: 'SCAN', label: 'SCAN' },
  { button: 'REPEAT', label: 'RPT' },
  { button: 'SOUND', label: 'SOUND' },
];

function Source({ button, label }: { button: Button; label: string }) {
  const available = useAvailable(button);
  return (
    <PressButton button={button} className="source">
      {label}
      {!available && <small>not available</small>}
    </PressButton>
  );
}

export function RadioPage() {
  const r = useRadio();
  if (!r) return <div className="page" />;

  return (
    <div className="page">
      <Header title="AUDIO" hint="← CLIMATE" />

      <div className="dials">
        <div className="dial">
          <div className="tiny">
            <span>VOLUME</span>
            <span className={r.muted ? 'amber' : ''}>{r.muted ? 'MUTED' : r.volumeKnown ? '' : 'ESTIMATE'}</span>
          </div>
          <div className="row">
            <Step knob="VOLUME_DOWN" label="Volume down">–</Step>
            <span className="val">{r.volume}{!r.volumeKnown && <span className="q">?</span>}</span>
            <Step knob="VOLUME_UP" label="Volume up">+</Step>
          </div>
          <Key button="MUTE" on={r.muted} icon={r.muted ? 'muted' : 'speaker'} label={r.muted ? 'UNMUTE' : 'MUTE'} className="wide" />
        </div>

        <div className="dial">
          <div className="tiny"><span>TUNE</span></div>
          <div className="row">
            <Step knob="TUNE_DOWN" label="Tune down">◀</Step>
            <span className="word">STEP</span>
            <Step knob="TUNE_UP" label="Tune up">▶</Step>
          </div>
          <div className="pair">
            <PressButton button="SEEK" className="wide">◀◀ SEEK</PressButton>
            <PressButton button="TRACK" className="wide">TRACK ▶▶</PressButton>
          </div>
        </div>
      </div>

      <div className="presets">
        {PRESETS.map((p, i) => (
          <PressButton key={p} button={p} aria-label={`Preset ${i + 1}`}>{i + 1}</PressButton>
        ))}
      </div>

      <div className="sources">
        {SOURCES.map((s) => <Source key={s.button} {...s} />)}
        <PressButton button="RADIO_POWER" className="source power">
          <Icon name="off" size={18} />
        </PressButton>
      </div>
    </div>
  );
}
