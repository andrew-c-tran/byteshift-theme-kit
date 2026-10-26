/** Line glyphs on a 24-unit grid, drawn in the current text colour. */
const SPEAKER_BODY = 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z';

const PATHS = {
  ac: ['M12 3.5v17', 'M4.6 7.75l14.8 8.5', 'M4.6 16.25l14.8-8.5'],
  auto: ['M8 17.5L12 6.5l4 11', 'M9.4 13.8h5.2'],
  dual: ['M12 3.5v17', 'M4.5 12h4.5', 'M15 12h4.5'],
  mode: ['M3.5 17h17', 'M6 17c0-3.6 2.7-6.4 6-6.4s6 2.8 6 6.4', 'M12 3v5.2M9.6 5.4L12 3l2.4 2.4'],
  fresh: ['M3 12h10', 'M9.5 8.4l3.6 3.6-3.6 3.6', 'M15 5.5h4v13h-4'],
  recirc: ['M6.6 15.4a6.6 6.6 0 1 1 4 3.2', 'M4 11.6l2.6 3.9 3.9-2.6'],
  front: [
    'M4.5 13.5V9.6C4.5 6.5 7.9 4 12 4s7.5 2.5 7.5 5.6v3.9',
    'M8 20c1.4-1.2 1.4-2.6 0-3.8M12 20c1.4-1.2 1.4-2.6 0-3.8M16 20c1.4-1.2 1.4-2.6 0-3.8',
  ],
  rear: [
    'M4.5 4.5h15v9h-15z',
    'M8 20c1.4-1.2 1.4-2.6 0-3.8M12 20c1.4-1.2 1.4-2.6 0-3.8M16 20c1.4-1.2 1.4-2.6 0-3.8',
    'M4.5 8.2h15',
  ],
  off: ['M12 3.5v8', 'M7.5 6.6a7 7 0 1 0 9 0'],
  fan: [
    'M12 12c0-3.2 1.4-5.2 3.6-5.2 1.9 0 2.6 2.4.4 3.6-2 1.1-4 1.6-4 1.6z',
    'M12 12c2.8 1.6 3.6 3.9 2.5 5.8-1 1.6-3.3.7-2.8-1.8.4-2.2 .3-4 .3-4z',
    'M12 12c-2.8 1.6-5.1 1.3-6.1-.6-.9-1.7 1-3.1 2.8-1.4 1.6 1.5 3.3 2 3.3 2z',
  ],
  speaker: [SPEAKER_BODY, 'M15.5 9a4.2 4.2 0 0 1 0 6', 'M18.2 6.3a8 8 0 0 1 0 11.4'],
  muted: [SPEAKER_BODY, 'M16 9.5l5 5', 'M21 9.5l-5 5'],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      {PATHS[name].map((d, i) => <path key={i} d={d} />)}
      {name === 'fan' && <circle cx={12} cy={12} r={1.3} fill="currentColor" stroke="none" />}
    </svg>
  );
}
