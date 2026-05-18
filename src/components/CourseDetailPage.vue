<script setup>
import { computed, ref, watch } from 'vue';
import CommentSection from './CommentSection.vue';
import ContributionBox from './ContributionBox.vue';
import FavoriteButton from './FavoriteButton.vue';
import { buildCourseRoute, courseDetailTabs } from '../data/courses/resourcePaths.js';
import { createFavoriteKey } from '../services/favoriteService.js';
import {
  bodyToParagraphs,
  fetchMarkdownDocument,
} from '../utils/markdownContent.js';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  course: {
    type: Object,
    required: true,
  },
  activeTabId: {
    type: String,
    default: 'overview',
  },
  activeItemId: {
    type: String,
    default: '',
  },
  user: {
    type: Object,
    required: true,
  },
  canSubmit: {
    type: Boolean,
    required: true,
  },
  canComment: {
    type: Boolean,
    required: true,
  },
  canFavorite: {
    type: Boolean,
    required: true,
  },
  favoriteKeys: {
    type: Array,
    default: () => [],
  },
  commentsByKey: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['back', 'toggle-favorite', 'add-comment', 'submit-contribution']);

const tabItems = ref({
  experiences: [],
  materials: [],
  papers: [],
});
const isLoading = ref(false);
const loadError = ref('');

const activeTab = computed(
  () => courseDetailTabs.find((tab) => tab.id === props.activeTabId) ?? courseDetailTabs[0],
);
const activeCollection = computed(() => tabItems.value[activeTab.value.id] ?? []);
const activeItem = computed(() => activeCollection.value.find((item) => item.id === props.activeItemId) ?? null);
const activeItemFavoriteKey = computed(() => {
  if (!activeItem.value || !['experiences', 'materials'].includes(activeTab.value.id)) {
    return '';
  }

  return createFavoriteKey(props.course.code, activeTab.value.id, activeItem.value.id);
});
const activeItemComments = computed(() => props.commentsByKey[activeItemFavoriteKey.value] ?? []);

function tabHref(tabId) {
  return buildCourseRoute(props.course.code, tabId);
}

function itemFavoriteKey(tabId, itemId) {
  return createFavoriteKey(props.course.code, tabId, itemId);
}

function isItemFavorited(tabId, itemId) {
  return props.favoriteKeys.includes(itemFavoriteKey(tabId, itemId));
}

function emitFavorite(tabId, itemId) {
  if (!props.canFavorite) {
    return;
  }

  emit('toggle-favorite', itemFavoriteKey(tabId, itemId));
}

function emitComment(text) {
  emit('add-comment', {
    key: activeItemFavoriteKey.value,
    text,
    tabId: activeTab.value.id,
    itemTitle: activeItem.value?.title ?? '',
  });
}

function emitContribution(payload) {
  emit('submit-contribution', {
    tabId: activeTab.value.id,
    ...payload,
  });
}

async function loadCollection(tabId) {
  const sourceItems = props.course[tabId] ?? [];

  if (!sourceItems.length) {
    tabItems.value = {
      ...tabItems.value,
      [tabId]: [],
    };
    return;
  }

  const documents = await Promise.all(sourceItems.map(async (sourceItem) => {
    const document = await fetchMarkdownDocument(sourceItem.url);
    return {
      ...sourceItem,
      ...document.frontmatter,
      id: String(document.frontmatter.id || sourceItem.id),
      body: document.body,
      paragraphs: bodyToParagraphs(document.body),
      file: document.frontmatter.fileUrl ? {
        url: publicAssetPath(document.frontmatter.fileUrl),
        fileName: document.frontmatter.fileName,
      } : null,
    };
  }));

  tabItems.value = {
    ...tabItems.value,
    [tabId]: documents,
  };
}

async function ensureActiveContent() {
  isLoading.value = true;
  loadError.value = '';

  try {
    if (activeTab.value.id !== 'overview' && !tabItems.value[activeTab.value.id]?.length) {
      await loadCollection(activeTab.value.id);
    }
  } catch (error) {
    loadError.value = '资料加载失败，请稍后重试。';
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => props.course.code,
  () => {
    tabItems.value = {
      experiences: [],
      materials: [],
      papers: [],
    };
  },
);

watch(
  () => [props.course.code, props.activeTabId],
  () => {
    ensureActiveContent();
  },
  { immediate: true },
);
</script>

<template>
  <article class="course-detail" aria-labelledby="course-detail-title">
    <button class="course-detail__back" type="button" @click="emit('back')">
      返回资源中心
    </button>

    <nav class="course-tabs" aria-label="课程详情页切换">
      <a
        v-for="tab in courseDetailTabs"
        :key="tab.id"
        :href="tabHref(tab.id)"
        class="course-tabs__item"
        :class="{ 'is-active': activeTab.id === tab.id }"
        :aria-current="activeTab.id === tab.id ? 'page' : undefined"
      >
        {{ tab.label }}
      </a>
    </nav>

    <template v-if="activeTab.id === 'overview'">
      <header class="course-detail__hero">
        <div class="course-detail__hero-main">
          <div class="course-detail__label-row">
            <span>{{ course.category }}</span>
            <span>{{ course.code }}</span>
          </div>
          <h1 id="course-detail-title">{{ course.name }}</h1>
          <p>{{ course.overview }}</p>
        </div>

        <aside class="course-detail__facts" aria-label="课程概况">
          <dl>
            <div v-for="field in course.summaryFacts" :key="field.key">
              <dt>{{ field.label }}</dt>
              <dd>{{ field.value }}</dd>
            </div>
          </dl>
        </aside>
      </header>
    </template>

    <section v-else-if="activeTab.id === 'experiences'" class="course-subpage" aria-labelledby="experience-title">
      <template v-if="activeItem">
        <a class="course-subpage__return" :href="tabHref('experiences')">返回学习心得</a>
        <article class="article-detail-card">
          <div class="article-detail-card__head">
            <div>
              <p class="course-detail__kicker">学习心得</p>
              <h1 id="experience-title">{{ activeItem.title }}</h1>
              <p class="article-detail-card__meta">{{ activeItem.author }}</p>
            </div>
            <FavoriteButton
              :active="favoriteKeys.includes(activeItemFavoriteKey)"
              :disabled="!canFavorite"
              @toggle="emitFavorite('experiences', activeItem.id)"
            />
          </div>
          <p v-for="paragraph in activeItem.paragraphs" :key="paragraph">{{ paragraph }}</p>
        </article>

        <CommentSection
          :comments="activeItemComments"
          :can-comment="canComment"
          :user="user"
          @add-comment="emitComment"
        />
      </template>

      <template v-else>
        <header class="subpage-header subpage-header--compact">
          <div>
            <p class="course-detail__kicker">学习心得</p>
            <h1 id="experience-title">学习心得</h1>
          </div>
          <ContributionBox tab-label="学习心得" :can-submit="canSubmit" @submit-contribution="emitContribution" />
        </header>
        <p v-if="isLoading" class="resource-empty">正在加载学习心得...</p>
        <p v-else-if="loadError" class="resource-empty">{{ loadError }}</p>
        <p v-else-if="!activeCollection.length" class="resource-empty">暂无学习心得，欢迎认证用户投稿。</p>
        <div v-else class="three-column-cards">
          <article v-for="item in activeCollection" :key="item.id" class="learning-card">
            <a :href="item.href">
              <strong>{{ item.author }}</strong>
              <p>{{ item.summary }}</p>
            </a>
            <FavoriteButton
              :active="isItemFavorited('experiences', item.id)"
              :disabled="!canFavorite"
              @toggle="emitFavorite('experiences', item.id)"
            />
          </article>
        </div>
      </template>
    </section>

    <section v-else-if="activeTab.id === 'materials'" class="course-subpage" aria-labelledby="material-title">
      <template v-if="activeItem">
        <a class="course-subpage__return" :href="tabHref('materials')">返回复习资料</a>
        <article class="article-detail-card">
          <div class="article-detail-card__head">
            <div>
              <p class="course-detail__kicker">复习资料</p>
              <h1 id="material-title">{{ activeItem.title }}</h1>
              <p class="article-detail-card__meta">{{ activeItem.author }}</p>
            </div>
            <FavoriteButton
              :active="favoriteKeys.includes(activeItemFavoriteKey)"
              :disabled="!canFavorite"
              @toggle="emitFavorite('materials', activeItem.id)"
            />
          </div>
          <p v-for="paragraph in activeItem.paragraphs" :key="paragraph">{{ paragraph }}</p>
          <a v-if="activeItem.externalUrl" class="course-action-link" :href="activeItem.externalUrl" target="_blank" rel="noreferrer">
            打开刷题网站
          </a>
        </article>

        <CommentSection
          :comments="activeItemComments"
          :can-comment="canComment"
          :user="user"
          @add-comment="emitComment"
        />
      </template>

      <template v-else>
        <header class="subpage-header subpage-header--compact">
          <div>
            <p class="course-detail__kicker">复习资料</p>
            <h1 id="material-title">复习资料</h1>
          </div>
          <ContributionBox tab-label="复习资料" :can-submit="canSubmit" @submit-contribution="emitContribution" />
        </header>
        <p v-if="isLoading" class="resource-empty">正在加载复习资料...</p>
        <p v-else-if="loadError" class="resource-empty">{{ loadError }}</p>
        <p v-else-if="!activeCollection.length" class="resource-empty">暂无复习资料，欢迎认证用户投稿。</p>
        <div v-else class="three-column-cards">
          <article v-for="item in activeCollection" :key="item.id" class="learning-card">
            <a :href="item.href">
              <strong>{{ item.author }}</strong>
              <p>{{ item.summary }}</p>
            </a>
            <FavoriteButton
              :active="isItemFavorited('materials', item.id)"
              :disabled="!canFavorite"
              @toggle="emitFavorite('materials', item.id)"
            />
          </article>
        </div>
      </template>
    </section>

    <section v-else class="course-subpage" aria-labelledby="paper-title">
      <template v-if="activeItem">
        <a class="course-subpage__return" :href="tabHref('papers')">返回历年试卷</a>
        <article class="paper-detail">
          <div class="paper-detail__head">
            <div>
              <p class="course-detail__kicker">历年试卷</p>
              <h1 id="paper-title">{{ activeItem.title }}</h1>
              <p v-for="paragraph in activeItem.paragraphs" :key="paragraph">{{ paragraph }}</p>
            </div>
            <div v-if="activeItem.file" class="paper-actions">
              <a :href="activeItem.file.url" target="_blank" rel="noreferrer">打开 PDF</a>
              <a :href="activeItem.file.url" :download="activeItem.file.fileName">下载 PDF</a>
            </div>
          </div>
          <object v-if="activeItem.file" class="pdf-viewer" :data="activeItem.file.url" type="application/pdf">
            <p>
              当前浏览器无法直接预览 PDF。
              <a :href="activeItem.file.url" target="_blank" rel="noreferrer">打开 PDF 文件</a>
            </p>
          </object>
        </article>
      </template>

      <template v-else>
        <header class="subpage-header subpage-header--compact">
          <div>
            <p class="course-detail__kicker">历年试卷</p>
            <h1 id="paper-title">历年试卷</h1>
          </div>
          <ContributionBox tab-label="历年试卷" :can-submit="canSubmit" @submit-contribution="emitContribution" />
        </header>
        <p v-if="isLoading" class="resource-empty">正在加载历年试卷...</p>
        <p v-else-if="loadError" class="resource-empty">{{ loadError }}</p>
        <p v-else-if="!activeCollection.length" class="resource-empty">暂无历年试卷，欢迎认证用户投稿。</p>
        <div v-else class="paper-list">
          <a v-for="paper in activeCollection" :key="paper.id" class="paper-row-card" :href="paper.href">
            <span>
              <strong>{{ paper.title }}</strong>
              <em>{{ paper.summary }}</em>
            </span>
            <span>{{ paper.year }}</span>
            <span>{{ paper.teacher }}班</span>
          </a>
        </div>
      </template>
    </section>
  </article>
</template>
