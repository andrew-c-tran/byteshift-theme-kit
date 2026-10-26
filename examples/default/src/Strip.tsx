/**
 * The always-visible column: the driver's temperature, the four climate keys a driver reaches for
 * most, and volume. Everything else is a swipe away.
 *
 * Temperature and volume are up and down only: the car does not report either, so there is no
 * value to show between the buttons, just what they control.
 */
import { useClimate, useControl, useRadio } from '@byteshift/theme';
import { Icon } from './icons';
import { Key, Status, Step } from './parts';

export function Strip() {
  const c = useClimate();
  const r = useRadio();
  const control = useControl();
  if (!c || !r) return <div className="strip" />;

  return (
    // Dimmed while control is off, so a press that will be refused looks like it.
    <div className={`strip${control?.enabled ? '' : ' inert'}`}>
      <Status compact />

      <div className="stack">
        <Step knob="LH_TEMP_UP" label="Warmer" className="warm">+</Step>
        <div className="what">{c.dual ? 'DRIVER' : 'TEMP'}</div>
        <Step knob="LH_TEMP_DOWN" label="Cooler" className="cool">–</Step>
      </div>

      <div className="col">
        <Key button="FRONT_DEFROST" on={c.frontDefrost} icon="front" label="FRONT" />
        <Key button="REAR_DEFROST" on={c.rearDefrost} icon="rear" label="REAR" />
        {/* One key for AUTO and OFF, as the car's own panel has: off, it brings AUTO back; in
            AUTO, it switches the system off; running by hand, it is plain AUTO. */}
        {c.off
          ? <Key button="AUTO" on icon="off" label="OFF" />
          : <Key button={c.auto ? 'CLIMATE_OFF' : 'AUTO'} on={c.auto} icon="auto" label="AUTO" />}
        <Key
          button="INTAKE" on={c.intake === 'recirc'}
          icon={c.intake === 'fresh' ? 'fresh' : 'recirc'} label={c.intake === 'fresh' ? 'FRESH' : 'RECIRC'}
        />
      </div>

      <div className="stack vol">
        <Step knob="VOLUME_UP" label="Volume up">+</Step>
        <div className="speaker"><Icon name={r.muted ? 'muted' : 'speaker'} size={22} /></div>
        <Step knob="VOLUME_DOWN" label="Volume down">–</Step>
      </div>
    </div>
  );
}
