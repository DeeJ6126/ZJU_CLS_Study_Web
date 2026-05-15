<script setup>
import { computed, ref, watch } from 'vue';
import { buildCourseRoute, courseDetailTabs } from '../data/resourcePaths.js';
import {
  bodyToParagraphs,
  fetchMarkdownDocument,
  splitPipeList,
  splitTimeline,
} from '../utils/markdownContent.js';

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
});

const emit = defineEmits(['back']);

const overviewContent = ref(null);
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
const teacher = computed(() => overviewContent.value?.teacher ?? {
  name: '待整理',
  role: '任课教师',
  note: '课程授课信息待整理。',
});
const focus = computed(() => overviewContent.value?.focus ?? []);
const timeline = computed(() => overviewContent.value?.timeline ?? []);

function tabHref(tabId) {
  return buildCourseRoute(props.course.code, tabId);
}

async function loadOverview() {
  const document = await fetchMarkdownDocument(props.course.content.overviewUrl);
  overviewContent.value = {
    teacher: {
      name: document.frontmatter.teacherName || '待整理',
      role: document.frontmatter.teacherRole || '任课教师',
      note: document.frontmatter.teacherNote || '课程授课信息待整理。',
    },
    focus: splitPipeList(document.frontmatter.focus),
    timeline: splitTimeline(document.frontmatter.timeline),
  };
}

async function loadCollection(tabId) {
  const sourceItems = props.course[tabId] ?? [];
  const documents = await Promise.all(sourceItems.map(async (sourceItem) => {
    const document = await fetchMarkdownDocument(sourceItem.url);
    return {
      ...sourceItem,
      ...document.frontmatter,
      id: String(document.frontmatter.id || sourceItem.id),
      body: document.body,
      paragraphs: bodyToParagraphs(document.body),
      file: document.frontmatter.fileUrl ? {
        url: document.frontmatter.fileUrl,
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
    if (!overviewContent.value) {
      await loadOverview();
    }

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
            <div>
              <dt>学分</dt>
              <dd>{{ course.credits }}</dd>
            </div>
            <div>
              <dt>学时</dt>
              <dd>{{ course.totalHours }}</dd>
            </div>
            <div>
              <dt>类型</dt>
              <dd>{{ course.courseType }}</dd>
            </div>
            <div>
              <dt>建议</dt>
              <dd>{{ course.semester }}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <section class="course-detail__section course-detail__section--teachers" aria-labelledby="teacher-title">
        <div>
          <p class="course-detail__kicker">授课信息</p>
          <h2 id="teacher-title">任课老师</h2>
        </div>
        <div class="teacher-list">
          <article class="teacher-card">
            <div class="teacher-card__avatar" aria-hidden="true">
              {{ teacher.name.slice(0, 1) }}
            </div>
            <div>
              <h3>{{ teacher.name }}</h3>
              <p>{{ teacher.role }}</p>
              <span>{{ teacher.note }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="course-detail__split">
        <div class="course-detail__section">
          <p class="course-detail__kicker">学习路径</p>
          <h2>怎么学</h2>
          <ol class="study-timeline">
            <li v-for="step in timeline" :key="step.title">
              <strong>{{ step.title }}</strong>
              <span>{{ step.text }}</span>
            </li>
          </ol>
        </div>

        <div class="course-detail__section">
          <p class="course-detail__kicker">重点范围</p>
          <h2>核心主题</h2>
          <div class="focus-tags">
            <span v-for="item in focus" :key="item">{{ item }}</span>
          </div>
        </div>
      </section>
    </template>

    <section v-else-if="activeTab.id === 'experiences'" class="course-subpage" aria-labelledby="experience-title">
      <template v-if="activeItem">
        <a class="course-subpage__return" :href="tabHref('experiences')">返回学习心得</a>
        <article class="article-detail-card">
          <p class="course-detail__kicker">学习心得</p>
          <h1 id="experience-title">{{ activeItem.title }}</h1>
          <p class="article-detail-card__meta">{{ activeItem.author }}</p>
          <p v-for="paragraph in activeItem.paragraphs" :key="paragraph">{{ paragraph }}</p>
        </article>
      </template>

      <template v-else>
        <header class="subpage-header">
          <p class="course-detail__kicker">学习心得</p>
          <h1 id="experience-title">同学经验卡片</h1>
          <p>卡片只保留作者和简介，点击后进入完整心得页。</p>
        </header>
        <p v-if="isLoading" class="resource-empty">正在加载学习心得...</p>
        <p v-else-if="loadError" class="resource-empty">{{ loadError }}</p>
        <div class="three-column-cards">
          <a v-for="item in activeCollection" :key="item.id" class="learning-card" :href="item.href">
            <strong>{{ item.author }}</strong>
            <p>{{ item.summary }}</p>
          </a>
        </div>
      </template>
    </section>

    <section v-else-if="activeTab.id === 'materials'" class="course-subpage" aria-labelledby="material-title">
      <template v-if="activeItem">
        <a class="course-subpage__return" :href="tabHref('materials')">返回复习资料</a>
        <article class="article-detail-card">
          <p class="course-detail__kicker">复习资料</p>
          <h1 id="material-title">{{ activeItem.title }}</h1>
          <p class="article-detail-card__meta">{{ activeItem.author }}</p>
          <p v-for="paragraph in activeItem.paragraphs" :key="paragraph">{{ paragraph }}</p>
          <a v-if="activeItem.externalUrl" class="course-action-link" :href="activeItem.externalUrl" target="_blank" rel="noreferrer">
            打开刷题网站
          </a>
        </article>
      </template>

      <template v-else>
        <header class="subpage-header">
          <p class="course-detail__kicker">复习资料</p>
          <h1 id="material-title">资料入口</h1>
          <p>先用卡片归档资料说明，后续可以替换为 Markdown、PDF、网页笔记或外部工具。</p>
        </header>
        <p v-if="isLoading" class="resource-empty">正在加载复习资料...</p>
        <p v-else-if="loadError" class="resource-empty">{{ loadError }}</p>
        <div class="three-column-cards">
          <a v-for="item in activeCollection" :key="item.id" class="learning-card" :href="item.href">
            <strong>{{ item.author }}</strong>
            <p>{{ item.summary }}</p>
          </a>
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
        <header class="subpage-header">
          <p class="course-detail__kicker">历年试卷</p>
          <h1 id="paper-title">试卷归档</h1>
          <p>横向卡片用于承载年份、教师、考试类型和后续题型分析。</p>
        </header>
        <p v-if="isLoading" class="resource-empty">正在加载历年试卷...</p>
        <p v-else-if="loadError" class="resource-empty">{{ loadError }}</p>
        <div class="paper-list">
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
