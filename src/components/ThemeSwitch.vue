<script setup>
import '../styles/theme-switch.css';
/*
 * Direct port of https://github.com/Xiumuzaidiao/Day-night-toggle-button v4.
 * The HTML structure, CSS, and animation logic mirror the original line-for-line.
 * The only deviations are:
 *   1. .components uses position: relative (instead of fixed) so the toggle
 *      can sit inside the top header instead of being pinned to the viewport.
 *   2. The click handler is wired through Vue useTheme service instead of
 *      a custom change DOM event.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useTheme } from '../services/themeService.js';
import {
  CLOUD_HOVER_DAY,
  CLOUD_REST_DAY,
  DAY_BOX_SHADOW,
  NIGHT_BOX_SHADOW,
  STAR_HOVER_NIGHT,
  STAR_REST_NIGHT,
} from '../data/themeSwitchStates.js';

const { theme, setTheme } = useTheme();
const isDark = computed(() => theme.value === 'dark');

const componentsEl = ref(null);
const mainButtonEl = ref(null);
const daytimeBackgroundEls = ref([]);
const cloudEl = ref(null);
const cloudLightEl = ref(null);
const cloudSons = ref([]);
const moonEls = ref([]);
const starsEl = ref(null);
const starEls = ref([]);

let isMoved = false;
let isClicked = false;
let cloudIntervalId = null;
let systemMedia = null;
let onSystemChange = null;

const FONT_SIZE_PX = 0.5; // size=1.5 → 0.5px per em → 90×35 toggle, fits top header

function set(el, prop, value) {
  if (el) el.style[prop] = value;
}

function getRandomDirection() {
  const directions = ['2em', '-2em'];
  return directions[Math.floor(Math.random() * directions.length)];
}

function moveElementRandomly(element) {
  const x = getRandomDirection();
  const y = getRandomDirection();
  set(element, 'transform', `translate(${x}, ${y})`);
}

function applyDayState() {
  set(mainButtonEl.value, 'transform', 'translateX(0)');
  set(mainButtonEl.value, 'backgroundColor', 'rgba(255, 195, 35,1)');
  set(mainButtonEl.value, 'boxShadow', DAY_BOX_SHADOW);
  set(daytimeBackgroundEls.value[0], 'transform', 'translateX(0)');
  set(daytimeBackgroundEls.value[1], 'transform', 'translateX(0)');
  set(daytimeBackgroundEls.value[2], 'transform', 'translateX(0)');
  set(cloudEl.value, 'transform', 'translateY(10em)');
  set(cloudLightEl.value, 'transform', 'translateY(10em)');
  set(componentsEl.value, 'backgroundColor', 'rgba(70, 133, 192,1)');
  set(moonEls.value[0], 'opacity', '0');
  set(moonEls.value[1], 'opacity', '0');
  set(moonEls.value[2], 'opacity', '0');
  set(starsEl.value, 'transform', 'translateY(-125em)');
  set(starsEl.value, 'opacity', '0');
}

function applyNightState() {
  set(mainButtonEl.value, 'transform', 'translateX(110em)');
  set(mainButtonEl.value, 'backgroundColor', 'rgba(195, 200,210,1)');
  set(mainButtonEl.value, 'boxShadow', NIGHT_BOX_SHADOW);
  set(daytimeBackgroundEls.value[0], 'transform', 'translateX(110em)');
  set(daytimeBackgroundEls.value[1], 'transform', 'translateX(80em)');
  set(daytimeBackgroundEls.value[2], 'transform', 'translateX(50em)');
  set(cloudEl.value, 'transform', 'translateY(80em)');
  set(cloudLightEl.value, 'transform', 'translateY(80em)');
  set(componentsEl.value, 'backgroundColor', 'rgba(25,30,50,1)');
  set(moonEls.value[0], 'opacity', '1');
  set(moonEls.value[1], 'opacity', '1');
  set(moonEls.value[2], 'opacity', '1');
  set(starsEl.value, 'transform', 'translateY(-62.5em)');
  set(starsEl.value, 'opacity', '1');
}

function toggleTheme() {
  if (isMoved) {
    applyDayState();
    setTheme('light');
  } else {
    applyNightState();
    setTheme('dark');
  }
  isClicked = true;
  window.setTimeout(() => { isClicked = false; }, 500);
  isMoved = !isMoved;
}

function onComponentsClick() {
  toggleTheme();
}

function applyHoverState() {
  if (isClicked) return;
  if (isMoved) {
    set(mainButtonEl.value, 'transform', 'translateX(100em)');
    set(daytimeBackgroundEls.value[0], 'transform', 'translateX(100em)');
    set(daytimeBackgroundEls.value[1], 'transform', 'translateX(73em)');
    set(daytimeBackgroundEls.value[2], 'transform', 'translateX(46em)');
    STAR_HOVER_NIGHT.forEach((pos, i) => {
      if (starEls.value[i]) {
        set(starEls.value[i], 'top', pos.top);
        set(starEls.value[i], 'left', pos.left);
      }
    });
  } else {
    set(mainButtonEl.value, 'transform', 'translateX(10em)');
    set(daytimeBackgroundEls.value[0], 'transform', 'translateX(10em)');
    set(daytimeBackgroundEls.value[1], 'transform', 'translateX(7em)');
    set(daytimeBackgroundEls.value[2], 'transform', 'translateX(4em)');
    CLOUD_HOVER_DAY.forEach((p, i) => {
      if (cloudSons.value[i]) {
        set(cloudSons.value[i], 'right', p.right);
        set(cloudSons.value[i], 'bottom', p.bottom);
      }
    });
  }
}

function applyLeaveState() {
  if (isClicked) return;
  if (isMoved) {
    set(mainButtonEl.value, 'transform', 'translateX(110em)');
    set(daytimeBackgroundEls.value[0], 'transform', 'translateX(110em)');
    set(daytimeBackgroundEls.value[1], 'transform', 'translateX(80em)');
    set(daytimeBackgroundEls.value[2], 'transform', 'translateX(50em)');
    STAR_REST_NIGHT.forEach((pos, i) => {
      if (starEls.value[i]) {
        set(starEls.value[i], 'top', pos.top);
        set(starEls.value[i], 'left', pos.left);
      }
    });
  } else {
    set(mainButtonEl.value, 'transform', 'translateX(0em)');
    set(daytimeBackgroundEls.value[0], 'transform', 'translateX(0em)');
    set(daytimeBackgroundEls.value[1], 'transform', 'translateX(0em)');
    set(daytimeBackgroundEls.value[2], 'transform', 'translateX(0em)');
    CLOUD_REST_DAY.forEach((p, i) => {
      if (cloudSons.value[i]) {
        set(cloudSons.value[i], 'right', p.right);
        set(cloudSons.value[i], 'bottom', p.bottom);
      }
    });
  }
}

function toggleThemeBasedOnSystem() {
  if (systemMedia.matches) {
    if (!isMoved) toggleTheme();
  } else if (isMoved) {
    toggleTheme();
  }
}

watch(isDark, (next) => {
  if (next === isMoved) return;
  toggleTheme();
}, { flush: 'post' });

onMounted(() => {
  if (isDark.value) {
    applyNightState();
    isMoved = true;
  } else {
    applyDayState();
    isMoved = false;
  }

  cloudIntervalId = window.setInterval(() => {
    cloudSons.value.forEach(moveElementRandomly);
  }, 1000);

  if (typeof window.matchMedia === 'function') {
    systemMedia = window.matchMedia('(prefers-color-scheme: dark)');
    onSystemChange = () => toggleThemeBasedOnSystem();
    if (systemMedia.addEventListener) {
      systemMedia.addEventListener('change', onSystemChange);
    } else if (systemMedia.addListener) {
      systemMedia.addListener(onSystemChange);
    }
  }
});

onBeforeUnmount(() => {
  if (cloudIntervalId) window.clearInterval(cloudIntervalId);
  if (systemMedia && onSystemChange) {
    if (systemMedia.removeEventListener) {
      systemMedia.removeEventListener('change', onSystemChange);
    } else if (systemMedia.removeListener) {
      systemMedia.removeListener(onSystemChange);
    }
  }
});
</script>

<template>
  <div class="theme-switch" :style="{ fontSize: FONT_SIZE_PX + 'px' }">
    <div ref="componentsEl" class="ts-components" @click="onComponentsClick">
      <div
        ref="mainButtonEl"
        class="ts-main-button"
        @mouseenter="applyHoverState"
        @mouseleave="applyLeaveState"
      >
        <div ref="moonEls[0]" class="ts-moon" />
        <div ref="moonEls[1]" class="ts-moon" />
        <div ref="moonEls[2]" class="ts-moon" />
      </div>
      <div ref="daytimeBackgroundEls[0]" class="ts-daytime-background" />
      <div ref="daytimeBackgroundEls[1]" class="ts-daytime-background" />
      <div ref="daytimeBackgroundEls[2]" class="ts-daytime-background" />
      <div ref="cloudEl" class="ts-cloud">
        <div v-for="i in 6" :key="`c-${i}`" ref="cloudSons" class="ts-cloud-son" />
      </div>
      <div ref="cloudLightEl" class="ts-cloud-light">
        <div v-for="i in 6" :key="`cl-${i}`" ref="cloudSons" class="ts-cloud-son" />
      </div>
      <div ref="starsEl" class="ts-stars">
        <div
          v-for="(sizeClass, i) in ['big','big','medium','medium','small','small']"
          :key="`s-${i}`"
          :ref="(el) => { if (el) starEls[i] = el; }"
          :class="['ts-star', `ts-${sizeClass}`]"
        >
          <div class="ts-star-son" />
          <div class="ts-star-son" />
          <div class="ts-star-son" />
          <div class="ts-star-son" />
        </div>
      </div>
    </div>
  </div>
</template>
