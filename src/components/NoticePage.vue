<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import NoticeDetail from './NoticeDetail.vue';
import { majorOptions } from '../data/courses/programCatalog.js';
import { noticeCategories, noticeCategoryLabel } from '../data/noticeConfig.js';
import { noticeApiClient } from '../services/noticeApiClient.js';
import {
  formatNoticeDate, noticeAudienceLabel, noticeCohortOptions, noticeDeadlineState,
  noticeDetailHref, safeNoticeUrl,
} from '../services/noticeViewService.js';

const props = defineProps({
  noticeId: { type: String, default: '' },
  studyProfile: { type: Object, default: () => ({}) },
});
const searchText = ref('');
const filters = reactive({ query: '', category: '', majorId: '', cohortYear: '', timing: '', page: 1, pageSize: 12 });
const items = ref([]);
const notice = ref(null);
const total = ref(0);
const loading = ref(false);
const message = ref('');
const notFound = ref(false);
const now = ref(new Date());
const cohorts = computed(() => noticeCohortOptions(now.value, props.studyProfile?.cohortYear));
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / filters.pageSize)));
const hasFilters = computed(() => Object.entries(filters).some(([key, value]) => !['page', 'pageSize'].includes(key) && value));
const hasStudyProfile = computed(() => Boolean(props.studyProfile?.majorId || props.studyProfile?.cohortYear));
const displayedItems = computed(() => items.value.map((item) => ({
  ...item, deadlineState: noticeDeadlineState(item, now.value), sourceHref: safeNoticeUrl(item.sourceUrl),
})));
let requestSequence = 0;
let clockTimer;

async function loadNotices() {
  const sequence = ++requestSequence;
  loading.value = true;
  message.value = '';
  notFound.value = false;
  notice.value = null;
  try {
    const result = props.noticeId
      ? await noticeApiClient.getPublic(props.noticeId)
      : await noticeApiClient.listPublic({ ...filters });
    if (sequence !== requestSequence) return;
    if (!result.ok) {
      notFound.value = Boolean(props.noticeId && result.status === 404);
      message.value = result.message || '通知暂时无法读取。';
      return;
    }
    if (props.noticeId) {
      notice.value = result.notice ?? null;
      notFound.value = !notice.value;
    } else {
      items.value = result.items;
      total.value = result.total;
      if (filters.page > pageCount.value) {
        filters.page = pageCount.value;
        await loadNotices();
      }
    }
  } catch {
    if (sequence === requestSequence) message.value = '通知服务暂时无法连接，请稍后重试。';
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

function applyFilters() {
  filters.query = searchText.value.trim();
  filters.page = 1;
  loadNotices();
}

function resetFilters() {
  searchText.value = '';
  Object.assign(filters, { query: '', category: '', majorId: '', cohortYear: '', timing: '', page: 1 });
  loadNotices();
}

function useStudyProfile() {
  filters.majorId = props.studyProfile?.majorId || '';
  filters.cohortYear = String(props.studyProfile?.cohortYear || '');
  applyFilters();
}

function changePage(page) {
  if (loading.value || page < 1 || page > pageCount.value) return;
  filters.page = page;
  loadNotices();
}

watch(() => props.noticeId, loadNotices, { immediate: true });
onMounted(() => { clockTimer = setInterval(() => { now.value = new Date(); }, 60000); });
onBeforeUnmount(() => { requestSequence += 1; clearInterval(clockTimer); });
</script>

<template>
  <div class="notices-page" :aria-busy="loading">
    <a v-if="noticeId" class="notice-back" href="#notices"><span aria-hidden="true">←</span> 通知列表</a>
    <template v-else>
      <header class="notices-page__head"><h1>通知</h1><span v-if="!loading && !message">{{ total }} 条</span></header>
      <form class="notice-filters" role="search" @submit.prevent="applyFilters">
        <div class="notice-search">
          <label for="notice-search">搜索通知</label>
          <div><input id="notice-search" v-model="searchText" type="search" placeholder="标题、关键词" maxlength="200"><button type="submit">搜索</button></div>
        </div>
        <label>分类<select v-model="filters.category" @change="applyFilters"><option value="">全部分类</option><option v-for="category in noticeCategories" :key="category.id" :value="category.id">{{ category.label }}</option></select></label>
        <label>专业<select v-model="filters.majorId" @change="applyFilters"><option value="">全部专业</option><option v-for="major in majorOptions" :key="major.id" :value="major.id">{{ major.label }}</option></select></label>
        <label>年级<select v-model="filters.cohortYear" @change="applyFilters"><option value="">全部年级</option><option v-for="cohort in cohorts" :key="cohort" :value="cohort">{{ cohort }}级</option></select></label>
        <label>截止状态<select v-model="filters.timing" @change="applyFilters"><option value="">全部状态</option><option value="active">未截止</option><option value="expired">已截止</option></select></label>
        <div class="notice-filter-actions"><button v-if="hasStudyProfile" type="button" @click="useStudyProfile">我的专业年级</button><button v-if="hasFilters || searchText" type="button" @click="resetFilters">重置</button></div>
      </form>
    </template>

    <div v-if="loading" class="notice-state" role="status">正在读取通知...</div>
    <div v-else-if="notFound" class="notice-state"><h2>通知不存在或已下架</h2><a href="#notices">返回通知列表</a></div>
    <div v-else-if="message" class="notice-state" role="alert"><p>{{ message }}</p><button type="button" @click="loadNotices">重试</button></div>
    <NoticeDetail v-else-if="noticeId && notice" :notice="notice" :now="now" />
    <template v-else-if="!noticeId">
      <div v-if="!items.length" class="notice-state" role="status"><h2>{{ hasFilters ? '没有符合条件的通知' : '暂无通知' }}</h2><button v-if="hasFilters" type="button" @click="resetFilters">清除筛选</button></div>
      <section v-else class="notice-list" aria-label="通知列表">
        <article v-for="item in displayedItems" :key="item.id" class="notice-list-item">
          <div class="notice-list-item__main">
            <div class="notice-labels"><span class="notice-category">{{ noticeCategoryLabel(item.category) }}</span><span v-if="item.pinned" class="notice-badge">置顶</span></div>
            <h2><a :href="noticeDetailHref(item.id)">{{ item.title }}</a></h2>
            <p v-if="item.summary" class="notice-list-item__summary">{{ item.summary }}</p>
            <div class="notice-list-item__meta"><span v-if="item.publisher">{{ item.publisher }}</span><time :datetime="item.publishedDate">{{ formatNoticeDate(item.publishedDate) }}</time><span>对象：{{ noticeAudienceLabel(item) }}</span></div>
            <div class="notice-list-item__links"><a :href="noticeDetailHref(item.id)">查看详情</a><a v-if="item.sourceHref" :href="item.sourceHref" target="_blank" rel="noopener noreferrer">原文 <span aria-hidden="true">↗</span></a><span v-if="item.attachments?.length">附件 {{ item.attachments.length }}</span></div>
          </div>
          <div class="notice-list-item__deadline"><span v-if="item.deadlineState.id !== 'none'" class="notice-badge" :class="`notice-badge--${item.deadlineState.id}`">{{ item.deadlineState.label }}</span><span v-else class="notice-deadline-none">未设截止日期</span><time v-if="item.deadlineState.date" :datetime="item.deadline">{{ item.deadlineState.date }}</time></div>
        </article>
      </section>
      <nav v-if="total > filters.pageSize" class="notice-pagination" aria-label="通知分页"><button type="button" :disabled="filters.page <= 1" @click="changePage(filters.page - 1)">上一页</button><span aria-live="polite">第 {{ filters.page }} / {{ pageCount }} 页</span><button type="button" :disabled="filters.page >= pageCount" @click="changePage(filters.page + 1)">下一页</button></nav>
    </template>
  </div>
</template>
