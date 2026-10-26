/**
 * The first page: both zones large, where the air goes, the fan, and every climate key.
 */
import { useClimate, type Vent } from '@byteshift/theme';
import { Icon } from './icons';
import { Header, Key, Step, Temp } from './parts';

const VENT_WORD: Record<Exclude<Vent, null>, string> = {
  'face': 'FACE', 'face-feet': 'FACE + FEET', 'feet': 'FEET', 'feet-screen': 'FEET + SCREEN',
};

function Zone({ side, label, temp, known, live }: {
  side: 'LH' | 'RH'; label: string; temp: number; known: boolean; live: boolean;
}) {
  return (
    <div className={`zone${live ? '' : ' idle'}`}>
      <Step knob={`${side}_TEMP_UP`} label={`${label} warmer`} className="warm">+</Step>
      <div className="big">
        <div className="t"><Temp value={temp} known={known} /></div>
        <div className="l">{label}</div>
      </div>
      <Step knob={`${side}_TEMP_DOWN`} label={`${label} cooler`} className="cool">–</Step>
    </div>
  );
}

export function ClimatePage() {
  const c = useClimate();
  if (!c) return <div className="page" />;
  const guesses = [
    !c.driver.known && (c.dual ? 'driver' : 'cabin'),
    c.dual && !c.passenger.known && 'passenger',
  ].filter(Boolean);

  return (
    <div className="page">
      <Header title="CLIMATE" hint="SWIPE → RADIO   ·   ← CLOSE" />

      <div className="zones">
        <Zone side="LH" label={c.dual ? 'DRIVER' : 'CABIN'} temp={c.driver.temp} known={c.driver.known} live />
        <div className="mid">
          <span>AIRFLOW</span>
          <b>{c.frontDefrost ? 'SCREEN' : c.vent ? VENT_WORD[c.vent] : '—'}</b>
          <span className="fanlabel"><Icon name="fan" size={18} /> FAN</span>
          {/* Never a number the car did not give: in AUTO it does not say. */}
          <b>{c.off ? 'OFF' : c.fan === null ? 'AUTO' : c.fan}</b>
        </div>
        <Zone
          side="RH" label={c.dual ? 'PASSENGER' : 'LINKED'}
          temp={c.passenger.temp} known={c.passenger.known} live={c.dual}
        />
      </div>

      <div className="fan">
        <Step knob="FAN_DOWN" label="Fan down">–</Step>
        <div className="pips" aria-hidden>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <i key={n} className={c.fan !== null && n <= c.fan ? 'lit' : c.fan === null && !c.off ? 'auto' : ''} />
          ))}
        </div>
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

      {guesses.length > 0 && (
        <p className="notice">
          The {guesses.join(' and ')} temperature is an estimate: the car does not report it. Run it
          to its lowest or highest once and it locks.
        </p>
      )}
    </div>
  );
}
