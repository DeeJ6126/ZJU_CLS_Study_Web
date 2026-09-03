<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { fetchSearch } from '../services/searchApiClient.js';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 1;
const DEFAULT_LIMIT = 8;

const query = ref('');
const results = ref({ courses: [], content: [], activities: [], homepages: [] });
const total = ref(0);
const isOpen = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');
let debounceHandle = null;
let abortController = null;
let outsideClickHandler = null;
let escapeHandler = null;

const trimmedQuery = computed(() => query.value.trim());

const hasAnyResults = computed(() => total.value > 0);
const showEmptyHint = computed(() => trimmedQuery.value && !isLoading.value && !hasAnyResults.value && !errorMessage.value);
const showResults = computed(() => isOpen.value && trimmedQuery.value.length >= MIN_QUERY_LENGTH);

const resultGroups = computed(() => ([
  { key: 'courses', title: '课程', items: results.value.courses, kind: 'course' },
  { key: 'content', title: '心得/资料', items: results.value.content, kind: 'content' },
  { key: 'activities', title: '活动', items: results.value.activities, kind: 'activity' },
  { key: 'homepages', title: '同学主页', items: results.value.homepages, kind: 'homepage' },
]));

function cancelPendingRequest() {
  if (debounceHandle) {
    clearTimeout(debounceHandle);
    debounceHandle = null;
  }
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

async function runSearchNow(rawQuery) {
  const value = String(rawQuery ?? '').trim();
  if (!value) {
    results.value = { courses: [], content: [], activities: [], homepages: [] };
    total.value = 0;
    errorMessage.value = '';
    isLoading.value = false;
    return;
  }
  cancelPendingRequest();
  abortController = new AbortController();
  isLoading.value = true;
  errorMessage.value = '';
  const response = await fetchSearch({
    query: value,
    limit: DEFAULT_LIMIT,
    signal: abortController.signal,
  });
  isLoading.value = false;
  if (response.aborted) return;
  if (!response.ok) {
    errorMessage.value = response.message;
    return;
  }
  results.value = response.results ?? { courses: [], content: [], activities: [], homepages: [] };
  total.value = response.total ?? 0;
}

function scheduleSearch() {
  cancelPendingRequest();
  const value = trimmedQuery.value;
  if (!value) {
    results.value = { courses: [], content: [], activities: [], homepages: [] };
    total.value = 0;
    errorMessage.value = '';
    isLoading.value = false;
    return;
  }
  debounceHandle = setTimeout(() => {
    debounceHandle = null;
    runSearchNow(value);
  }, SEARCH_DEBOUNCE_MS);
}

function onInput() {
  if (!isOpen.value) isOpen.value = true;
  scheduleSearch();
}

function onFocus() {
  isOpen.value = true;
  if (trimmedQuery.value && total.value === 0 && !isLoading.value && !errorMessage.value) {
    scheduleSearch();
  }
}

function clearQuery() {
  query.value = '';
  cancelPendingRequest();
  results.value = { courses: [], content: [], activities: [], homepages: [] };
  total.value = 0;
  errorMessage.value = '';
  isLoading.value = false;
  isOpen.value = false;
}

function visitResult(href) {
  if (!href) return;
  if (href.startsWith('#/') || href.startsWith('#')) {
    window.location.hash = href.replace(/^#?\//, '#/');
  } else if (href.startsWith('/')) {
    window.location.hash = `#${href}`;
  } else {
    window.location.href = href;
  }
  isOpen.value = false;
}

function onSubmit() {
  cancelPendingRequest();
  runSearchNow(trimmedQuery.value);
  isOpen.value = true;
}

watch(query, () => {
  if (isOpen.value) scheduleSearch();
});

onBeforeUnmount(() => {
  cancelPendingRequest();
  if (outsideClickHandler) document.removeEventListener('click', outsideClickHandler);
  if (escapeHandler) document.removeEventListener('keydown', escapeHandler);
});

function bindOutsideClose() {
  outsideClickHandler = (event) => {
    if (!isOpen.value) return;
    if (event.target.closest('.search-bar')) return;
    isOpen.value = false;
  };
  escapeHandler = (event) => {
    if (event.key === 'Escape') isOpen.value = false;
  };
  document.addEventListener('click', outsideClickHandler);
  document.addEventListener('keydown', escapeHandler);
}
bindOutsideClose();
</script>

<template>
  <div class="search-bar" :class="{ 'is-open': isOpen }">
    <label class="search-bar__field">
      <span class="search-bar__icon" aria-hidden="true">⌕</span>
      <input
        v-model="query"
        type="search"
        placeholder="搜索课程、资料、活动、同学主页…"
        aria-label="全站搜索"
        autocomplete="off"
        @input="onInput"
        @focus="onFocus"
        @keydown.enter.prevent="onSubmit"
      />
      <button
        v-if="query"
        type="button"
        class="search-bar__clear"
        aria-label="清空搜索"
        @click="clearQuery"
      >×</button>
    </label>
    <div v-if="showResults" class="search-bar__dropdown" role="region" aria-label="搜索结果">
      <div v-if="isLoading" class="search-bar__hint">正在搜索…</div>
      <div v-else-if="errorMessage" class="search-bar__hint search-bar__hint--error">{{ errorMessage }}</div>
      <div v-else-if="showEmptyHint" class="search-bar__hint">没有匹配结果</div>
      <template v-else>
        <div v-for="group in resultGroups" :key="group.key">
          <div v-if="group.items.length" class="search-bar__group">
            <h4>{{ group.title }} ({{ group.items.length }})</h4>
            <ul>
              <li v-for="item in group.items" :key="`${group.kind}-${item.code || item.id || item.slug || item.href}`">
                <button type="button" @click="visitResult(item.href)">
                  <strong v-if="item.title || item.name">{{ item.title || item.name }}</strong>
                  <span v-if="item.code && group.kind === 'course'" class="search-bar__code">{{ item.code }}</span>
                  <em v-if="item.summary">{{ item.summary }}</em>
                  <small v-if="item.author">
                    <span v-if="item.author">{{ item.author }}</span>
                    <span v-if="item.courseCode"> · {{ item.courseCode }}</span>
                  </small>
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div v-if="hasAnyResults" class="search-bar__footer">
          共 {{ total }} 条结果
        </div>
      </template>
    </div>
  </div>
</template>
