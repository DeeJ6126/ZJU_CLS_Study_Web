// Vector data for the theme switch toggle, ported 1:1 from
// github.com/SunnyDesignor/WpfGorgeousThemeSwitch
// (ResourceDictionary "ToggleButtonGorgeousThemeSwitchStyle").
//
// The two cloud paths and the highlight wave are taken verbatim from the
// WPF source. Sun, moon, glows, stars, and timings are all defined inline
// in the component.

export const THEME_SWITCH_STAR_PATH =
  'F0M100,50 C72.38589,50 50,72.38589 50,100 C50,72.38589 27.61411,50 0,50 C27.61411,50 50,27.61411 50,0 C50,27.61411 72.38589,50 100,50 z';

export const THEME_SWITCH_CLOUD_BACK_PATH =
  'M158.99223,453.55724 C169.78284,423.31232 203.15378,392.41965 241.59875,404.12313 261.99875,383.72313 299.3,391.57463 305.3,392.77701 330.15525,362.39707 353.16314,370.00505 368.58869,378.91567 370.80287,377.8725 376.53823,377.01298 381.06677,376.82559 387.43795,354.90123 410.63981,354.27147 420.4351,355.75324 432.85079,341.48144 440.27525,342.83843 451.87985,342.32945 457.75133,307.27233 472.82215,288.94564 509.06064,292.16184 512.31051,292.45027 525.93938,292.61638 525.93938,292.61638 525.90428,295.34879 526.73875,460.86787 526.8053,465.68179 L154.99571,465.6552 z';

export const THEME_SWITCH_CLOUD_FRONT_PATH =
  'M158.99223,453.55724 C169.78284,423.31232 203.15378,392.41965 241.59875,404.12313 261.99875,383.72313 299.3,391.57463 305.3,392.77701 337.22357,353.75764 390.50003,373.43798 398.90003,384.97667 412.50003,378.21261 430.04088,381.41688 430.04088,381.41688 436.82018,362.13027 456.18064,352.96024 465.00342,351.59457 460.57167,304.02021 510.55723,292.35177 521.33687,292.25901 530.92623,292.1765 525.93938,292.61638 525.93938,292.61638 525.90428,295.34879 526.73875,460.86787 526.8053,465.68179 L154.99571,465.6552 z';

export const THEME_SWITCH_WAVE_PATH =
  'M195.79568,256.36186 C128.27033,194.80746 208.6956,103.20326 276.96226,155.20326 220.40909,129.80395 148.71988,171.59981 195.79568,256.36186 z';

export const THEME_SWITCH_STARS = [
  { left: 11.5,  top: 26.5,  size: 5, twinkle: null,     key: 's0' },
  { left: 24.635, top: 26.5, size: 5, twinkle: 'star3', key: 'star3' },
  { left: 44.5,  top: 29.5,  size: 5, twinkle: 'star5', key: 'star5' },
  { left: 20.635, top: 5.5,   size: 7, twinkle: 'star1', key: 'star1' },
  { left: 48.5,  top: 10,    size: 7, twinkle: 'star2', key: 'star2' },
  { left: 32.315, top: 12.5, size: 3, twinkle: null,     key: 's6' },
  { left: 23.635, top: 18,   size: 3, twinkle: null,     key: 's7' },
  { left: 33.999, top: 24,   size: 3, twinkle: null,     key: 's8' },
  { left: 47,    top: 22.5,  size: 3, twinkle: null,     key: 's9' },
  { left: 39.481, top: 7.997, size: 3, twinkle: null,    key: 's10' },
  { left: 10,    top: 11,    size: 3, twinkle: 'star4', key: 'star4' },
];
