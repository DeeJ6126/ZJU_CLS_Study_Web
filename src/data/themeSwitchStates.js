// Style strings ported verbatim from
// https://github.com/Xiumuzaidiao/Day-night-toggle-button v4 (script.js).
// Kept here so the ThemeSwitch.vue stays free of long string literals that
// would trip the content-location check.

export const DAY_BOX_SHADOW =
  '3em 3em 5em rgba(0, 0, 0, 0.5), inset  -3em -5em 3em -3em rgba(0, 0, 0, 0.5), inset  4em 5em 2em -2em rgba(255, 230, 80,1)';

export const NIGHT_BOX_SHADOW =
  '3em 3em 5em rgba(0, 0, 0, 0.5), inset  -3em -5em 3em -3em rgba(0, 0, 0, 0.5), inset  4em 5em 2em -2em rgba(255, 255, 210,1)';

// Cloud-son positions on hover (day-mode hover shows the cloud, night-mode hover shifts them).
export const CLOUD_HOVER_DAY = [
  { right: '-24em', bottom: '10em' },
  { right: '-12em', bottom: '-27em' },
  { right: '17em',  bottom: '-43em' },
  { right: '46em',  bottom: '-39em' },
  { right: '70em',  bottom: '-65em' },
  { right: '109em', bottom: '-54em' },
  { right: '-23em', bottom: '10em' },
  { right: '-11em', bottom: '-26em' },
  { right: '18em',  bottom: '-42em' },
  { right: '47em',  bottom: '-38em' },
  { right: '74em',  bottom: '-64em' },
  { right: '110em', bottom: '-55em' },
];

export const CLOUD_REST_DAY = [
  { right: '-20em', bottom: '10em' },
  { right: '-10em', bottom: '-25em' },
  { right: '20em',  bottom: '-40em' },
  { right: '50em',  bottom: '-35em' },
  { right: '75em',  bottom: '-60em' },
  { right: '110em', bottom: '-50em' },
  { right: '-20em', bottom: '10em' },
  { right: '-10em', bottom: '-25em' },
  { right: '20em',  bottom: '-40em' },
  { right: '50em',  bottom: '-35em' },
  { right: '75em',  bottom: '-60em' },
  { right: '110em', bottom: '-50em' },
];

// Star positions on hover vs rest (night mode only — day stars are off-screen).
export const STAR_HOVER_NIGHT = [
  { top: '10em',   left: '36em' },
  { top: '40em',   left: '87em' },
  { top: '26em',   left: '16em' },
  { top: '38em',   left: '63em' },
  { top: '20.5em', left: '72em' },
  { top: '51.5em', left: '35em' },
];

export const STAR_REST_NIGHT = [
  { top: '11em', left: '39em' },
  { top: '39em', left: '91em' },
  { top: '26em', left: '19em' },
  { top: '37em', left: '66em' },
  { top: '21em', left: '75em' },
  { top: '51em', left: '38em' },
];
