<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  homeQuizSearchItems,
  homeResourceSearchItems,
  homeSearchKinds,
} from '../data/homeContent.js';
import { activityProgramLabel } from '../data/activityConfig.js';
import { loadResourceCatalog } from '../data/courses/resourceData.js';
import { activityApiClient } from '../services/activityApiClient.js';
import { buildHomeSearchIndex, searchHomeIndex } from '../services/homeSearchService.js';
import { searchProfiles } from '../services/profileApiClient.js';
import { imageFileToAvatarDataUrl, studentHomepageApiClient } from '../services/studentHomepageApiClient.js';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  activityClient: { type: Object, default: null },
  homepageClient: { type: Object, default: null },
  canSubmit: { type: Boolean, default: false },
});
const activeActivityClient = computed(() => props.activityClient ?? activityApiClient);
const activeHomepageClient = computed(() => props.homepageClient ?? studentHomepageApiClient);

const activeKind = ref('course');
const query = ref('');
const courses = ref([]);
const catalogMessage = ref('');
const users = ref([]);
const activities = ref([]);
const homepages = ref([]);
const homepageDialogOpen = ref(false);
const homepageForm = ref({ name: '', href: '', avatarUrl: '' });
const homepageNotice = ref('');
const homepageBusy = ref(false);
let userSearchSequence = 0;

const activeSearchKind = computed(
  () => homeSearchKinds.find((kind) => kind.id === activeKind.value) ?? homeSearchKinds[0],
);

const searchIndex = computed(() => buildHomeSearchIndex({
  courses: courses.value,
  resources: homeResourceSearchItems,
  quizzes: homeQuizSearchItems,
  activities: activities.value.map((item) => ({
    ...item,
    summary: activityProgramLabel(item.programId),
    href: item.externalUrl,
  })),
  users: users.value,
}));

const searchResults = computed(() => searchHomeIndex(searchIndex.value, query.value, activeKind.value));
const hasQuery = computed(() => Boolean(query.value.trim()));
const recentActivities = computed(() => activities.value.slice(0, 3));

function selectSearchKind(kindId) {
  activeKind.value = kindId;
}

function avatarImage(path) {
  return path?.startsWith('data:image/webp;base64,') || path?.startsWith('/zjubio/') ? path : (path ? publicAssetPath(path) : '');
}

async function selectHomepageAvatar(event) {
  homepageNotice.value = '';
  try {
    homepageForm.value.avatarUrl = await imageFileToAvatarDataUrl(event.target.files?.[0]);
  } catch (error) {
    homepageForm.value.avatarUrl = '';
    homepageNotice.value = error.message;
  }
}

async function submitHomepage() {
  if (!props.canSubmit) {
    homepageNotice.value = '完成学号认证后即可投稿个人主页。';
    return;
  }
  if (!homepageForm.value.avatarUrl) {
    homepageNotice.value = '请先选择头像。';
    return;
  }
  homepageBusy.value = true;
  const result = await activeHomepageClient.value.submitApplication(homepageForm.value);
  homepageBusy.value = false;
  if (!result.ok) {
    homepageNotice.value = result.message;
    return;
  }
  homepageDialogOpen.value = false;
  homepageForm.value = { name: '', href: '', avatarUrl: '' };
  homepageNotice.value = '投稿已提交，管理员审核后会显示在首页。';
}

watch([query, activeKind], async ([nextQuery, nextKind]) => {
  if (nextKind !== 'user' || nextQuery.trim().length < 1) {
    users.value = [];
    return;
  }
  const sequence = ++userSearchSequence;
  const result = await searchProfiles(nextQuery.trim());
  if (sequence === userSearchSequence) {
    users.value = result.ok ? result.profiles : [];
  }
});

onMounted(async () => {
  const [activityResult, catalogResult, homepageResult] = await Promise.all([
    activeActivityClient.value.fetchActivities(),
    loadResourceCatalog().then((catalog) => ({ ok: true, catalog })).catch(() => ({ ok: false })),
    activeHomepageClient.value.fetchHomepages(),
  ]);
  if (activityResult.ok) activities.value = activityResult.activities;
  if (homepageResult.ok) homepages.value = homepageResult.homepages;
  if (catalogResult.ok) courses.value = catalogResult.catalog.courses;
  else catalogMessage.value = '课程目录暂时无法读取，请稍后再试。';
});
</script>

<template>
  <div class="home-page">
    <section class="home-search-stage" aria-labelledby="home-title">
      <div class="home-search-stage__copy">
        <p>浙江大学生命科学学院课程资源</p>
        <h1 id="home-title">今天想找哪门课？</h1>
        <span>从课程入口出发，也可以查找资料、题库与学生会活动。</span>
      </div>

      <div class="home-search" role="search">
        <div class="home-search__kinds" aria-label="搜索类型">
          <button
            v-for="kind in homeSearchKinds"
            :key="kind.id"
            type="button"
            :class="{ 'is-active': activeKind === kind.id }"
            @click="selectSearchKind(kind.id)"
          >
            {{ kind.label }}
          </button>
        </div>

        <label class="home-search__field">
          <span class="home-search__icon" aria-hidden="true">⌕</span>
          <input v-model="query" type="search" :placeholder="activeSearchKind.placeholder" autocomplete="off" />
          <kbd>Enter</kbd>
        </label>

        <div v-if="hasQuery" class="home-search__results" aria-live="polite">
          <a v-for="item in searchResults" :key="`${item.kind}-${item.id}`" :href="item.href">
            <span>{{ item.kindLabel }}</span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.code || item.courseCode || item.subtitle || item.summary }}</small>
          </a>
          <p v-if="!searchResults.length">没有找到相关{{ activeSearchKind.label }}，试试更短的关键词。</p>
        </div>

        <p v-if="catalogMessage" class="home-search__message">{{ catalogMessage }}</p>
      </div>

      <div v-if="!hasQuery" class="home-search-stage__quicklinks" aria-label="常用入口">
        <span>常用入口</span>
        <a href="#quiz">开始刷题</a>
        <a href="#overview">查看培养方案</a>
      </div>
    </section>

    <section class="home-feed" aria-label="首页动态">
      <div class="home-feed__main">
        <header class="home-section-head">
          <div>
            <p>Student Union</p>
            <h2>近期活动</h2>
          </div>
          <a href="#activities">全部活动</a>
        </header>

        <div class="home-activity-grid">
          <article v-for="(activity, index) in recentActivities" :key="activity.id" :class="`is-${['green', 'amber', 'blue'][index % 3]}`">
            <span class="home-activity-card__number">0{{ index + 1 }}</span>
            <div>
              <p>{{ activityProgramLabel(activity.programId) }}</p>
              <h3>{{ activity.title }}</h3>
              <span>查看公众号原文</span>
            </div>
            <a :href="activity.externalUrl" target="_blank" rel="noopener noreferrer">阅读推文 <b aria-hidden="true">↗</b></a>
          </article>
          <p v-if="!recentActivities.length" class="home-activity-grid__empty">暂无近期活动。</p>
        </div>
      </div>

      <aside class="home-popular" aria-labelledby="homepages-title">
        <header class="home-section-head">
          <div>
            <p>Student Pages</p>
            <h2 id="homepages-title">同学主页</h2>
          </div>
          <button class="home-homepages__submit" type="button" @click="homepageNotice = ''; homepageDialogOpen = true">投稿</button>
        </header>

        <template v-for="(homepage, index) in homepages" :key="homepage.id">
          <a v-if="homepage.href" class="home-homepages__row" :href="homepage.href" target="_blank" rel="noopener noreferrer">
            <img v-if="homepage.avatarUrl" :src="avatarImage(homepage.avatarUrl)" :alt="`${homepage.name}的头像`" />
            <span v-else>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <strong>{{ homepage.name }}</strong>
              <small>{{ homepage.href }}</small>
            </div>
          </a>
          <div v-else class="home-homepages__row is-placeholder">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <strong>{{ homepage.name }}</strong>
              <small>期待你的主页</small>
            </div>
          </div>
        </template>
        <p v-if="!homepages.length" class="home-homepages__empty">暂无同学主页。</p>
        <p v-if="homepageNotice && !homepageDialogOpen" class="home-homepages__notice" role="status">{{ homepageNotice }}</p>
      </aside>
    </section>

    <div v-if="homepageDialogOpen" class="home-homepages__overlay" @click.self="homepageDialogOpen = false">
      <section class="home-homepages__dialog" role="dialog" aria-modal="true" aria-labelledby="homepage-submit-title">
        <header>
          <h2 id="homepage-submit-title">投稿同学主页</h2>
          <button type="button" aria-label="关闭" @click="homepageDialogOpen = false">×</button>
        </header>
        <form @submit.prevent="submitHomepage">
          <label>名称<input v-model.trim="homepageForm.name" required maxlength="40" placeholder="你的名称"></label>
          <label>头像<input type="file" required accept="image/png,image/jpeg,image/webp" @change="selectHomepageAvatar"></label>
          <img v-if="homepageForm.avatarUrl" class="home-homepages__preview" :src="homepageForm.avatarUrl" alt="头像预览">
          <label>主页链接<input v-model.trim="homepageForm.href" required type="url" maxlength="500" placeholder="https://"></label>
          <p v-if="homepageNotice" role="status">{{ homepageNotice }}</p>
          <footer>
            <button type="button" @click="homepageDialogOpen = false">取消</button>
            <button type="submit" :disabled="homepageBusy">{{ homepageBusy ? '提交中...' : '提交审核' }}</button>
          </footer>
        </form>
      </section>
    </div>
  </div>
</template>
