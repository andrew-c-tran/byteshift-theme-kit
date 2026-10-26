/**
 * The first page: both temperature zones, where the air goes, the fan, and every climate key.
 *
 * The car does not report the temperatures or the fan speed, so those are up and down buttons with
 * no value between them. What it does report - which keys are on, and where the air goes - lights.
 */
import { useClimate, type Vent } from '@byteshift/theme';
import { Icon } from './icons';
import { Header, Key, Step } from './parts';

const VENT_WORD: Record<Exclude<Vent, null>, string> = {
  'face': 'FACE', 'face-feet': 'FACE + FEET', 'feet': 'FEET', 'feet-screen': 'FEET + SCREEN',
};

function Zone({ side, label, live }: { side: 'LH' | 'RH'; label: string; live: boolean }) {
  return (
    <div className={`zone${live ? '' : ' idle'}`}>
      <div className="zonelabel">{label}</div>
      <div className="pair">
        <Step knob={`${side}_TEMP_DOWN`} label={`${label} cooler`} className="cool">–</Step>
        <Step knob={`${side}_TEMP_UP`} label={`${label} warmer`} className="warm">+</Step>
      </div>
    </div>
  );
}

export function ClimatePage() {
  const c = useClimate();
  if (!c) return <div className="page" />;

  return (
    <div className="page">
      <Header title="CLIMATE" hint="SWIPE → RADIO   ·   ← CLOSE" />

      <div className="zones">
        <Zone side="LH" label={c.dual ? 'DRIVER' : 'TEMPERATURE'} live />
        <div className="mid">
          <span>AIRFLOW</span>
          <b>{c.off ? 'OFF' : c.frontDefrost ? 'SCREEN' : c.vent ? VENT_WORD[c.vent] : '—'}</b>
        </div>
        {/* The passenger side only answers while DUAL is on. */}
        <Zone side="RH" label="PASSENGER" live={c.dual} />
      </div>

      <div className="fan">
        <Step knob="FAN_DOWN" label="Fan down">–</Step>
        <div className="fanlabel"><Icon name="fan" size={22} /> FAN</div>
        <Step knob="FAN_UP" label="Fan up">+</Step>
      </div>

      <div className="keys">
        <Key button="AC" on={c.ac} icon="ac" label="A/C" />
        <Key button="AUTO" on={c.auto} icon="auto" label="AUTO" />
        <Key button="DUAL" on={c.dual} icon="dual" label="DUAL" />
        <Key button="MODE" on={c.vent !== null && !c.frontDefrost} icon="mode" label="MODE" />
        <Key
          button="INTAKE" on={c.intake === 'recirc'}
          icon={c.intake === 'fresh' ? 'fresh' : 'recirc'} label={c.intake === 'fresh' ? 'FRESH' : 'RECIRC'}
        />
        <Key button="FRONT_DEFROST" on={c.frontDefrost} icon="front" label="FRONT" />
        <Key button="REAR_DEFROST" on={c.rearDefrost} icon="rear" label="REAR" />
        <Key button="CLIMATE_OFF" on={c.off} icon="off" label="OFF" />
      </div>
    </div>
  );
}
