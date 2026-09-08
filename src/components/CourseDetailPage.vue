<script setup>
import { computed } from 'vue';
import CommentSection from './CommentSection.vue';
import ContributionBox from './ContributionBox.vue';
import FavoriteButton from './FavoriteButton.vue';
import { buildCourseRoute, courseDetailTabs } from '../data/courses/resourcePaths.js';
import { getProfileHref } from '../services/demoNavigationService.js';
import { formatGrade } from '../utils/gradeConversion.js';
import { isUbbFormat, ubbToHtml } from '../utils/ubbParser.js';

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
  hasQuiz: {
    type: Boolean,
    default: false,
  },
  favoriteCount: {
    type: Number,
    default: 0,
  },
  favoriteKeys: {
    type: Array,
    default: () => [],
  },
  commentsByKey: {
    type: Object,
    default: () => ({}),
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  loadError: {
    type: String,
    default: '',
  },
  submissionNotice: {
    type: String,
    default: '',
  },
  likeNotice: {
    type: String,
    default: '',
  },
  commentNotice: { type: String, default: '' },
  commentBusy: { type: Boolean, default: false },
  cc98IconUrl: {
    type: String,
    required: true,
  },
});

const emit = defineEmits([
  'back', 'open-quiz', 'toggle-favorite', 'add-comment', 'update-comment', 'delete-comment',
  'submit-contribution', 'toggle-like',
]);

const activeTab = computed(
  () => courseDetailTabs.find((tab) => tab.id === props.activeTabId) ?? courseDetailTabs[0],
);
const activeCollection = computed(() => (
  Array.isArray(props.course[activeTab.value.id]) ? props.course[activeTab.value.id] : []
));
const activeItem = computed(() => activeCollection.value.find((item) => item.id === props.activeItemId) ?? null);
const favoriteCountLabel = computed(() => {
  const count = Number(props.favoriteCount) || 0;
  return `${count} 人收藏`;
});
const activeItemFavoriteKey = computed(() => {
  return activeItem.value?.contentId ?? '';
});
const activeItemComments = computed(() => props.commentsByKey[activeItemFavoriteKey.value] ?? []);

const activeItemBody = computed(() => {
  const item = activeItem.value;
  if (!item) return { html: '', isUbb: false };
  const body = String(item.body ?? '');
  const isUbb = isUbbFormat(item.bodyFormat) || /\[\/?(b|i|u|s|url|img|size|color|quote|code|smiley|align)\b/i.test(body);
  return {
    html: isUbb ? ubbToHtml(body) : '',
    paragraphs: isUbb ? [] : String(item.body ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    isUbb,
  };
});

const activeItemGradeLabel = computed(() => {
  const item = activeItem.value;
  if (!item) return '';
  if (item.gradePercentage != null && item.gradePercentage !== '') {
    return formatGrade(item.gradePercentage);
  }
  if (item.gpa != null && item.gpa !== '') {
    const gpa = Number(item.gpa);
    if (Number.isFinite(gpa) && gpa > 0) {
      return `${gpa.toFixed(1)}`;
    }
  }
  return '';
});

function tabHref(tabId) {
  return buildCourseRoute(props.course.code, tabId);
}

function emitFavorite(contentId) {
  if (!props.canFavorite) {
    return;
  }
  emit('toggle-favorite', contentId);
}

function emitComment(payload) {
  emit('add-comment', {
    contentId: activeItemFavoriteKey.value,
    ...payload,
  });
}

function emitContribution(payload) {
  emit('submit-contribution', {
    tabId: activeTab.value.id,
    ...payload,
  });
}

</script>

<template>
  <article class="course-detail" aria-labelledby="course-detail-title">
    <aside class="course-detail__nav" aria-label="课程详情页导航">
      <button class="course-detail__back" type="button" @click="emit('back')">
        返回课程概览
      </button>
      <strong>{{ course.name }}</strong>
      <nav class="course-tabs">
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
    </aside>

    <main class="course-detail__content">
    <template v-if="activeTab.id === 'overview'">
      <header class="course-detail__hero">
        <div class="course-detail__hero-main">
          <div class="course-detail__label-row">
            <span>{{ course.category }}</span>
            <span>{{ course.code }}</span>
            <span
              class="course-detail__favorite-count"
              data-testid="course-detail-favorite-count"
              :title="favoriteCount > 0 ? `${favoriteCount} 位同学收藏了这门课` : '还没有同学收藏这门课'"
            >❤️ {{ favoriteCountLabel }}</span>
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
          <button
            v-if="hasQuiz"
            class="course-detail__quiz-link"
            type="button"
            @click="emit('open-quiz', course.code)"
          >
            刷题网页
          </button>
        </aside>
      </header>

    </template>

    <section v-else-if="activeTab.id === 'experiences'" class="course-subpage" aria-labelledby="experience-title">
      <template v-if="activeItem">
        <a class="course-subpage__return" :href="tabHref('experiences')">返回学习心得</a>
        <article class="article-detail-card">
          <div class="article-detail-card__head">
            <div class="article-detail-card__title-block">
              <p class="course-detail__kicker">学习心得</p>
              <h1 id="experience-title">{{ activeItem.title }}</h1>
              <p v-if="activeItem.subtitle" class="article-detail-card__subtitle">{{ activeItem.subtitle }}</p>
            </div>
            <div class="article-detail-card__author">
              <a v-if="activeItem.owner" class="article-author-link" :href="getProfileHref(activeItem.owner.publicId)">{{ activeItem.owner.nickname }}</a>
              <strong v-else>{{ activeItem.author }}</strong>
              <a
                v-if="activeItem.cc98Url"
                class="article-cc98-badge"
                :href="activeItem.cc98Url"
                target="_blank"
                rel="noopener noreferrer"
                title="查看作者的 CC98 帖子"
              >
                <img class="cc98-icon" :src="cc98IconUrl" alt="CC98" />
              </a>
            </div>
          </div>
          <p v-if="likeNotice" class="article-detail-card__notice">{{ likeNotice }}</p>
          <div v-if="activeItemBody.isUbb" class="article-body article-body--ubb" v-html="activeItemBody.html"></div>
          <template v-else>
            <p v-for="paragraph in activeItemBody.paragraphs" :key="paragraph">{{ paragraph }}</p>
          </template>
          <div class="article-detail-card__actions">
            <span
              v-if="activeItemGradeLabel"
              class="article-detail-card__grade"
              aria-label="本资源关联的成绩"
            >成绩 {{ activeItemGradeLabel }}</span>
            <span
              v-else
              class="article-detail-card__grade article-detail-card__grade--empty"
              aria-label="本资源暂无成绩"
            >暂无成绩</span>
            <button
              class="article-action-button"
              :class="{ 'is-active': activeItem.viewerLiked }"
              type="button"
              :disabled="!canFavorite"
              :title="canFavorite ? '' : '完成学号认证后可点赞'"
              @click="emit('toggle-like', activeItem.contentId)"
            >
              {{ activeItem.viewerLiked ? '已赞' : '点赞' }} {{ activeItem.likeCount || 0 }}
            </button>
            <FavoriteButton
              :active="favoriteKeys.includes(activeItemFavoriteKey)"
              :disabled="!canFavorite"
              @toggle="emitFavorite(activeItem.contentId)"
            />
          </div>
        </article>

        <CommentSection
          :comments="activeItemComments"
          :can-comment="canComment"
          :user="user"
          :busy="commentBusy"
          :notice="commentNotice"
          @add-comment="emitComment"
          @update-comment="emit('update-comment', $event)"
          @delete-comment="emit('delete-comment', $event)"
        />
      </template>

      <template v-else>
        <header class="subpage-header subpage-header--compact">
          <div>
            <p class="course-detail__kicker">学习心得</p>
            <h1 id="experience-title">学习心得</h1>
          </div>
          <ContributionBox tab-label="学习心得" :can-submit="canSubmit" :submission-notice="submissionNotice" @submit-contribution="emitContribution" />
        </header>
        <p v-if="isLoading" class="resource-empty">正在加载学习心得...</p>
        <p v-else-if="loadError" class="resource-empty">{{ loadError }}</p>
        <p v-else-if="!activeCollection.length" class="resource-empty">暂无学习心得，欢迎认证用户投稿。</p>
        <div v-else class="three-column-cards">
          <article v-for="item in activeCollection" :key="item.id" class="learning-card">
            <a class="learning-card__main-link" :href="item.href">
              <strong class="learning-card__title">{{ item.title }}</strong>
              <p>{{ item.summary }}</p>
            </a>
            <a v-if="item.owner" class="learning-card__author" :href="getProfileHref(item.owner.publicId)">{{ item.owner.nickname }}</a>
            <span v-else class="learning-card__author">{{ item.author }}</span>
          </article>
        </div>
      </template>
    </section>

    <section v-else-if="activeTab.id === 'materials'" class="course-subpage" aria-labelledby="material-title">
      <template v-if="activeItem">
        <a class="course-subpage__return" :href="tabHref('materials')">返回复习资料</a>
        <article class="article-detail-card">
          <div class="article-detail-card__head">
            <div class="article-detail-card__title-block">
              <p class="course-detail__kicker">复习资料</p>
              <h1 id="material-title">{{ activeItem.title }}</h1>
              <p v-if="activeItem.subtitle" class="article-detail-card__subtitle">{{ activeItem.subtitle }}</p>
            </div>
            <div class="article-detail-card__author">
              <a v-if="activeItem.owner" class="article-author-link" :href="getProfileHref(activeItem.owner.publicId)">{{ activeItem.owner.nickname }}</a>
              <strong v-else>{{ activeItem.author }}</strong>
              <a
                v-if="activeItem.cc98Url"
                class="article-cc98-badge"
                :href="activeItem.cc98Url"
                target="_blank"
                rel="noopener noreferrer"
                title="查看作者的 CC98 帖子"
              >
                <img class="cc98-icon" :src="cc98IconUrl" alt="CC98" />
              </a>
            </div>
          </div>
          <p v-if="likeNotice" class="article-detail-card__notice">{{ likeNotice }}</p>
          <div v-if="activeItemBody.isUbb" class="article-body article-body--ubb" v-html="activeItemBody.html"></div>
          <template v-else>
            <p v-for="paragraph in activeItemBody.paragraphs" :key="paragraph">{{ paragraph }}</p>
          </template>
          <a v-if="activeItem.externalUrl" class="course-action-link" :href="activeItem.externalUrl" target="_blank" rel="noreferrer">
            打开刷题网站
          </a>
          <div class="article-detail-card__actions">
            <span
              v-if="activeItemGradeLabel"
              class="article-detail-card__grade"
              aria-label="本资源关联的成绩"
            >成绩 {{ activeItemGradeLabel }}</span>
            <span
              v-else
              class="article-detail-card__grade article-detail-card__grade--empty"
              aria-label="本资源暂无成绩"
            >暂无成绩</span>
            <button
              class="article-action-button"
              :class="{ 'is-active': activeItem.viewerLiked }"
              type="button"
              :disabled="!canFavorite"
              :title="canFavorite ? '' : '完成学号认证后可点赞'"
              @click="emit('toggle-like', activeItem.contentId)"
            >
              {{ activeItem.viewerLiked ? '已赞' : '点赞' }} {{ activeItem.likeCount || 0 }}
            </button>
            <FavoriteButton
              :active="favoriteKeys.includes(activeItemFavoriteKey)"
              :disabled="!canFavorite"
              @toggle="emitFavorite(activeItem.contentId)"
            />
          </div>
        </article>

        <CommentSection
          :comments="activeItemComments"
          :can-comment="canComment"
          :user="user"
          :busy="commentBusy"
          :notice="commentNotice"
          @add-comment="emitComment"
          @update-comment="emit('update-comment', $event)"
          @delete-comment="emit('delete-comment', $event)"
        />
      </template>

      <template v-else>
        <header class="subpage-header subpage-header--compact">
          <div>
            <p class="course-detail__kicker">复习资料</p>
            <h1 id="material-title">复习资料</h1>
          </div>
          <ContributionBox tab-label="复习资料" :can-submit="canSubmit" :submission-notice="submissionNotice" @submit-contribution="emitContribution" />
        </header>
        <p v-if="isLoading" class="resource-empty">正在加载复习资料...</p>
        <p v-else-if="loadError" class="resource-empty">{{ loadError }}</p>
        <p v-else-if="!activeCollection.length" class="resource-empty">暂无复习资料，欢迎认证用户投稿。</p>
        <div v-else class="three-column-cards">
          <article v-for="item in activeCollection" :key="item.id" class="learning-card">
            <a class="learning-card__main-link" :href="item.href">
              <strong class="learning-card__title">{{ item.title }}</strong>
              <p>{{ item.summary }}</p>
            </a>
            <a v-if="item.owner" class="learning-card__author" :href="getProfileHref(item.owner.publicId)">{{ item.owner.nickname }}</a>
            <span v-else class="learning-card__author">{{ item.author }}</span>
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
            <div class="paper-actions">
              <a v-if="activeItem.file" :href="activeItem.file.url" target="_blank" rel="noreferrer">打开 PDF</a>
              <a v-if="activeItem.file" :href="activeItem.file.url" :download="activeItem.file.fileName">下载 PDF</a>
              <FavoriteButton
                :active="favoriteKeys.includes(activeItemFavoriteKey)"
                :disabled="!canFavorite"
                @toggle="emitFavorite(activeItem.contentId)"
              />
            </div>
          </div>
          <object v-if="activeItem.file" class="pdf-viewer" :data="activeItem.file.url" type="application/pdf">
            <p>
              当前浏览器无法直接预览 PDF。
              <a :href="activeItem.file.url" target="_blank" rel="noreferrer">打开 PDF 文件</a>
            </p>
          </object>
        </article>
        <CommentSection
          :comments="activeItemComments"
          :can-comment="canComment"
          :user="user"
          :busy="commentBusy"
          :notice="commentNotice"
          @add-comment="emitComment"
          @update-comment="emit('update-comment', $event)"
          @delete-comment="emit('delete-comment', $event)"
        />
      </template>

      <template v-else>
        <header class="subpage-header subpage-header--compact">
          <div>
            <p class="course-detail__kicker">历年试卷</p>
            <h1 id="paper-title">历年试卷</h1>
          </div>
          <ContributionBox tab-label="历年试卷" :can-submit="canSubmit" :submission-notice="submissionNotice" @submit-contribution="emitContribution" />
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
    </main>
  </article>
</template>
