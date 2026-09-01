// Light/dark theme state shared across the app.
//
// Storage key: 'study-platform-theme' (value 'light' or 'dark').
// Falls back to the OS-level prefers-color-scheme on first visit.
// The choice is applied to <html data-theme="..."> so CSS can react via
// attribute selectors without re-rendering Vue trees.

import { computed, ref, watchEffect } from 'vue';

const STORAGE_KEY = 'study-platform-theme';
const LIGHT = 'light';
const DARK = 'dark';
const VALID_THEMES = new Set([LIGHT, DARK]);

function readStoredTheme() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return VALID_THEMES.has(saved) ? saved : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return LIGHT;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
}

function writeStoredTheme(value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode, quota). Skip persistence; in-memory
    // state still drives the rest of the app.
  }
}

function applyTheme(value) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', value);
}

const initialTheme = readStoredTheme() ?? systemTheme();
applyTheme(initialTheme);

const themeRef = ref(initialTheme);

watchEffect(() => {
  applyTheme(themeRef.value);
});

const isDark = computed(() => themeRef.value === DARK);

function setTheme(value) {
  if (!VALID_THEMES.has(value)) return;
  themeRef.value = value;
  writeStoredTheme(value);
}

function toggleTheme() {
  setTheme(themeRef.value === DARK ? LIGHT : DARK);
}

export function useTheme() {
  return {
    theme: computed(() => themeRef.value),
    isDark,
    setTheme,
    toggleTheme,
  };
}

export const THEME_LIGHT = LIGHT;
export const THEME_DARK = DARK;
