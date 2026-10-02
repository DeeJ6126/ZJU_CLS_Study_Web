<script setup>
import { computed, onMounted, ref } from 'vue';

import {
  aboutSections as defaultAboutSections,
  defaultAboutSectionId,
} from '../data/config/aboutSections.js';
import { buildHashWithQuery, getHashQuery } from '../services/demoNavigationService.js';
import { sanitizeHtmlFragment } from '../utils/htmlFragment.js';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  sections: { type: Array, default: () => defaultAboutSections },
});

const html = ref('');
const message = ref('');
const loading = ref(true);
// 快速连点栏目时，只让最后一次请求落地。
let requestToken = 0;

function sectionById(sectionId) {
  return props.sections.find((section) => section.id === sectionId) ?? null;
}

function readSectionIdFromHash() {
  const requested = getHashQuery(window.location.hash).get('section');
  return sectionById(requested) ? requested : defaultAboutSectionId;
}

const activeSectionId = ref(readSectionIdFromHash());

const activeSection = computed(
  () => sectionById(activeSectionId.value) ?? props.sections[0] ?? null,
);

// 默认栏目不写进 hash，保持干净的 `#about`。
function sectionHash(sectionId) {
  return buildHashWithQuery('about', sectionId === defaultAboutSectionId ? {} : { section: sectionId });
}

async function loadSection(section) {
  const token = ++requestToken;
  html.value = '';
  message.value = '';
  if (!section) {
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const response = await fetch(publicAssetPath(section.contentUrl));
    if (token !== requestToken) return;
    if (!response.ok) {
      message.value = '关于页内容暂时无法读取，请稍后再试。';
      return;
    }
    const raw = await response.text();
    if (token !== requestToken) return;
    html.value = sanitizeHtmlFragment(raw, { rewriteUrl: publicAssetPath });
  } catch {
    if (token === requestToken) {
      message.value = '关于页内容暂时无法读取，请稍后再试。';
    }
  } finally {
    if (token === requestToken) {
      loading.value = false;
    }
  }
}

// 用 replaceState 而不是改 hash：不会触发 App 的 hashchange 重新同步整页。
function syncSectionHash() {
  const nextHash = sectionHash(activeSectionId.value);
  if (window.location.hash !== nextHash) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

function selectSection(sectionId) {
  if (!sectionById(sectionId) || sectionId === activeSectionId.value) return;
  activeSectionId.value = sectionId;
  syncSectionHash();
  loadSection(activeSection.value);
}

// 保留 Ctrl/Cmd/中键的浏览器默认行为，让边栏链接仍能新标签页打开。
function handleSectionClick(event, sectionId) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return;
  }
  event.preventDefault();
  selectSection(sectionId);
}

onMounted(() => {
  syncSectionHash();
  loadSection(activeSection.value);
});
</script>

<template>
  <div class="about-page">
    <aside class="about-page__nav">
      <p class="about-page__nav-title">关于</p>
      <nav class="about-nav" aria-label="关于页面栏目">
        <a
          v-for="section in sections"
          :key="section.id"
          class="about-nav__item"
          :class="{ 'is-active': section.id === activeSectionId }"
          :href="sectionHash(section.id)"
          :aria-current="section.id === activeSectionId ? 'page' : undefined"
          @click="handleSectionClick($event, section.id)"
        >
          <span class="about-nav__label">{{ section.label }}</span>
          <span class="about-nav__kicker">{{ section.kicker }}</span>
        </a>
      </nav>
    </aside>

    <div class="about-page__main">
      <header class="about-page__head">
        <p>About</p>
        <h1>关于生科智学</h1>
      </header>

      <p v-if="loading" class="about-page__status" aria-live="polite">正在加载内容…</p>
      <p v-else-if="message" class="about-page__status" aria-live="polite">{{ message }}</p>
      <article v-else class="about-page__body" v-html="html"></article>
    </div>
  </div>
</template>
