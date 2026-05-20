<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AuthDialog from './components/account/AuthDialog.vue';
import AccountPopover from './components/account/AccountPopover.vue';
import MailboxPopover from './components/account/MailboxPopover.vue';
import AppSidebar from './components/AppSidebar.vue';
import CourseDetailPage from './components/CourseDetailPage.vue';
import ResourcePage from './components/ResourcePage.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import { getCourseDetail } from './data/courses/courseDetails.js';
import { seedMessages } from './data/config/mockMessages.js';
import { navigationItems } from './data/config/navigation.js';
import { getResourceCourseByCode } from './data/courses/resourceData.js';
import { buildResourceRoute, defaultCourseDetailTab, parseResourceHash } from './data/courses/resourcePaths.js';
import { defaultUserId, getTestUserById, testUsers } from './data/config/testUsers.js';
import { defaultThemeId, themes } from './data/config/themes.js';
import {
  canComment,
  canFavorite,
  canSubmitResource,
  createCommentMessage,
  createSubmissionMessage,
  getAccountState,
  getVerificationBadges,
  messageBelongsToUser,
} from './services/authService.js';
import { fetchCurrentUser, loginCc98Account, logoutAccount, registerCc98Account } from './services/authApiClient.js';
import { getNextAvatarColor } from './services/avatarService.js';
import { toggleFavorite } from './services/favoriteService.js';

const activeSection = ref(navigationItems[0].id);
const isSidebarOpen = ref(false);
const isSettingsOpen = ref(false);
const isAccountPanelOpen = ref(false);
const isMailboxOpen = ref(false);
const authDialogMode = ref('');
const activeThemeId = ref(defaultThemeId);
const activeCourseCode = ref('');
const activeCourseTabId = ref(defaultCourseDetailTab);
const activeCourseItemId = ref('');
const activeSourceCourse = ref(null);
const favoriteKeys = ref([]);
const commentsByKey = ref({
  'BIO2110F:experiences:1': [
    {
      id: 'comment-exp-1',
      author: '青莲同学',
      body: '这个结构图方法很适合期中前重新整理章节关系。',
      createdAt: '测试评论',
    },
  ],
  'BIO2110F:materials:1': [
    {
      id: 'comment-mat-1',
      author: '蓝桥同学',
      body: '刷题后最好把错题对应到讲义章节，不要只看答案。',
      createdAt: '测试评论',
    },
  ],
});
const messages = ref([...seedMessages]);
const avatarOverrides = ref({});
const currentUserState = ref(getTestUserById(defaultUserId));
const authDialogMessage = ref('');

const activeTheme = computed(
  () => themes.find((theme) => theme.id === activeThemeId.value) ?? themes[0],
);
const currentUser = computed(() => ({
  ...currentUserState.value,
  avatarColor: avatarOverrides.value[currentUserState.value.id] ?? currentUserState.value.avatarColor,
}));
const accountState = computed(() => getAccountState(currentUser.value));
const verificationBadges = computed(() => getVerificationBadges(currentUser.value));
const isGuest = computed(() => accountState.value.id === 'guest');
const activeCourse = computed(() => getCourseDetail(activeSourceCourse.value));
const userCanSubmit = computed(() => canSubmitResource(currentUser.value));
const userCanComment = computed(() => canComment(currentUser.value));
const userCanFavorite = computed(() => canFavorite(currentUser.value));
const visibleMessages = computed(() => messages.value.filter((message) => messageBelongsToUser(message, currentUser.value)));
const unreadMessageCount = computed(() => visibleMessages.value.filter((message) => !message.read).length);
const topbarTitle = computed(() => {
  if (isSettingsOpen.value) {
    return '设置';
  }

  if (activeCourse.value) {
    return activeCourse.value.code;
  }

  return activeSection.value === 'resources' ? '资源中心' : '初版导航结构';
});

function readJsonStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function syncRouteFromHash() {
  const route = parseResourceHash(window.location.hash);
  activeCourseCode.value = route.courseCode || '';
  activeCourseTabId.value = route.tabId;
  activeCourseItemId.value = route.itemId;

  if (activeCourseCode.value) {
    activeSection.value = 'resources';
    isSettingsOpen.value = false;
  } else if (route.section === 'resources') {
    activeSection.value = 'resources';
    isSettingsOpen.value = false;
  }
}

function closeTopbarPanels() {
  isAccountPanelOpen.value = false;
  isMailboxOpen.value = false;
}

function selectNavigation(id) {
  activeSection.value = id;
  activeCourseCode.value = '';
  activeCourseTabId.value = defaultCourseDetailTab;
  activeCourseItemId.value = '';
  isSettingsOpen.value = false;
  isSidebarOpen.value = false;
  closeTopbarPanels();

  if (id === 'resources') {
    window.location.hash = buildResourceRoute();
  } else if (window.location.hash) {
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
  }
}

function openSettings() {
  activeCourseCode.value = '';
  activeCourseTabId.value = defaultCourseDetailTab;
  activeCourseItemId.value = '';
  isSettingsOpen.value = true;
  isSidebarOpen.value = false;
  closeTopbarPanels();

  if (window.location.hash) {
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
  }
}

function selectTheme(id) {
  activeThemeId.value = id;
}

function changeAvatarColor() {
  avatarOverrides.value = {
    ...avatarOverrides.value,
    [currentUser.value.id]: getNextAvatarColor(currentUser.value.avatarColor),
  };
}

function openAuthDialog(mode) {
  authDialogMode.value = mode;
  authDialogMessage.value = '';
  closeTopbarPanels();
}

function closeAuthDialog() {
  authDialogMode.value = '';
  authDialogMessage.value = '';
}

async function refreshCurrentUser() {
  const result = await fetchCurrentUser();
  if (result.ok) {
    currentUserState.value = result.user;
  }
}

async function registerCc98({ cc98Name, code, password }) {
  const result = await registerCc98Account({ cc98Name, code, password });
  if (!result.ok) {
    authDialogMessage.value = result.message;
    return;
  }
  authDialogMessage.value = '注册成功，请使用 CC98 名字和密码登录。';
  authDialogMode.value = 'login';
}

async function loginCc98({ cc98Name, password }) {
  const result = await loginCc98Account({ cc98Name, password });
  if (!result.ok) {
    authDialogMessage.value = result.message;
    return;
  }
  currentUserState.value = result.user;
  closeAuthDialog();
}

async function logoutCurrentUser() {
  const result = await logoutAccount();
  if (result.ok) {
    currentUserState.value = result.user;
  }
}

function toggleAccountPanel() {
  isAccountPanelOpen.value = !isAccountPanelOpen.value;
  isMailboxOpen.value = false;
}

function toggleMailbox() {
  isMailboxOpen.value = !isMailboxOpen.value;
  isAccountPanelOpen.value = false;
}

function backToResources() {
  activeCourseCode.value = '';
  activeCourseTabId.value = defaultCourseDetailTab;
  activeCourseItemId.value = '';
  activeSection.value = 'resources';
  isSettingsOpen.value = false;
  closeTopbarPanels();

  window.location.hash = buildResourceRoute();
}

function toggleFavoriteKey(key) {
  if (!userCanFavorite.value) {
    return;
  }

  favoriteKeys.value = toggleFavorite(favoriteKeys.value, key);
}

function addComment({ key, text, tabId, itemTitle }) {
  if (!userCanComment.value || !key) {
    return;
  }

  const nextComment = {
    id: `${key}-${Date.now()}`,
    author: currentUser.value.nickname,
    body: text,
    createdAt: '刚刚',
  };
  commentsByKey.value = {
    ...commentsByKey.value,
    [key]: [...(commentsByKey.value[key] ?? []), nextComment],
  };

  const targetUserId = currentUser.value.id === 'dual-user' ? 'cc98-user' : 'dual-user';
  messages.value = [
    createCommentMessage({
      fromUser: currentUser.value,
      toUserId: targetUserId,
      courseCode: activeCourseCode.value,
      tabId,
      itemTitle,
    }),
    ...messages.value,
  ];
}

function submitContribution({ tabId, title, subtitle = '', cc98Name = '', cc98Link = '', body = '', materialLink = '' }) {
  if (!userCanSubmit.value) {
    return;
  }

  messages.value = [
    createSubmissionMessage({
      fromUser: currentUser.value,
      courseCode: activeCourseCode.value,
      tabId,
      title,
      subtitle,
      cc98Name,
      cc98Link,
      body,
      materialLink,
    }),
    ...messages.value,
  ];
}

onMounted(() => {
  const storedTheme = window.localStorage.getItem('study-platform-theme');
  if (themes.some((theme) => theme.id === storedTheme)) {
    activeThemeId.value = storedTheme;
  }

  favoriteKeys.value = readJsonStorage('study-platform-favorites', []);
  commentsByKey.value = readJsonStorage('study-platform-comments', commentsByKey.value);
  avatarOverrides.value = readJsonStorage('study-platform-avatars', {});

  refreshCurrentUser();
  syncRouteFromHash();
  window.addEventListener('hashchange', syncRouteFromHash);
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncRouteFromHash);
});

watch(activeCourseCode, async (courseCode) => {
  activeSourceCourse.value = null;

  if (!courseCode) {
    return;
  }

  activeSourceCourse.value = await getResourceCourseByCode(courseCode);
}, { immediate: true });

watch(activeThemeId, (themeId) => {
  document.documentElement.dataset.theme = themeId;
  window.localStorage.setItem('study-platform-theme', themeId);
}, { immediate: true });

watch(favoriteKeys, (keys) => {
  window.localStorage.setItem('study-platform-favorites', JSON.stringify(keys));
});

watch(commentsByKey, (comments) => {
  window.localStorage.setItem('study-platform-comments', JSON.stringify(comments));
});

watch(avatarOverrides, (overrides) => {
  window.localStorage.setItem('study-platform-avatars', JSON.stringify(overrides));
});

</script>

<template>
  <div class="site-shell" :class="{ 'is-sidebar-open': isSidebarOpen }" id="top">
    <AppSidebar
      :items="navigationItems"
      :active-section="activeSection"
      :settings-active="isSettingsOpen"
      @select-navigation="selectNavigation"
      @open-settings="openSettings"
    />

    <main class="main-content">
      <header class="topbar">
        <div class="topbar__left">
          <button class="sidebar-toggle" type="button" aria-label="打开或收起侧边栏" @click="isSidebarOpen = !isSidebarOpen">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div class="topbar__identity">
            <span>生命科学学子学习平台</span>
            <strong>{{ topbarTitle }}</strong>
          </div>
        </div>

        <div class="topbar__actions">
          <button class="mailbox-button" type="button" aria-label="打开信箱" @click="toggleMailbox">
            <span>信箱</span>
            <strong v-if="unreadMessageCount">{{ unreadMessageCount }}</strong>
          </button>
          <button class="account-button" type="button" aria-label="打开账号面板" @click="toggleAccountPanel">
            <span class="account-avatar" :style="{ backgroundColor: currentUser.avatarColor }">
              {{ currentUser.avatarInitials }}
            </span>
            <span>
              <strong>{{ currentUser.nickname }}</strong>
              <em>{{ accountState.label }}</em>
            </span>
          </button>

          <AccountPopover
            v-if="isAccountPanelOpen"
            :user="currentUser"
            :account-state="accountState"
            :badges="verificationBadges"
            :is-guest="isGuest"
            @change-avatar="changeAvatarColor"
            @logout="logoutCurrentUser"
            @open-login="openAuthDialog('login')"
            @open-register-cc98="openAuthDialog('register-cc98')"
            @open-register-email="openAuthDialog('register-email')"
          />

          <MailboxPopover
            v-if="isMailboxOpen"
            :messages="visibleMessages"
          />
        </div>
      </header>

      <SettingsPanel
        v-if="isSettingsOpen"
        :themes="themes"
        :active-theme-id="activeTheme.id"
        :account-state="accountState"
        :badges="verificationBadges"
        @select-theme="selectTheme"
      />

      <CourseDetailPage
        v-else-if="activeCourse"
        :course="activeCourse"
        :active-tab-id="activeCourseTabId"
        :active-item-id="activeCourseItemId"
        :user="currentUser"
        :can-submit="userCanSubmit"
        :can-comment="userCanComment"
        :can-favorite="userCanFavorite"
        :favorite-keys="favoriteKeys"
        :comments-by-key="commentsByKey"
        @back="backToResources"
        @toggle-favorite="toggleFavoriteKey"
        @add-comment="addComment"
        @submit-contribution="submitContribution"
      />

      <ResourcePage v-else-if="activeSection === 'resources'" />

      <template v-else>
        <div class="intro-panel">
          <p class="intro-panel__eyebrow">生命科学学习平台</p>
          <h1>把课程资源、朋辈支持和实验室机会放在同一个清晰入口。</h1>
          <p>
            当前版本先完成前端导航、主题、账号状态和课程资源骨架。后续接入真实后端后，
            投稿、评论、收藏和信箱会迁移到服务器持久化。
          </p>
        </div>

        <div class="section-grid" aria-label="栏目预览">
          <section v-for="item in navigationItems" :key="item.id" class="section-card" :id="item.id">
            <span class="section-card__kicker">{{ item.kicker }}</span>
            <h2>{{ item.label }}</h2>
            <p>{{ item.description }}</p>
            <p v-if="item.children?.length" class="section-card__meta">
              {{ item.children.map((child) => child.label).join(' / ') }}
            </p>
          </section>
        </div>
      </template>

      <AuthDialog
        v-if="authDialogMode"
        :mode="authDialogMode"
        :message="authDialogMessage"
        @close="closeAuthDialog"
        @submit-register-cc98="registerCc98"
        @submit-login-cc98="loginCc98"
      />
    </main>
  </div>
</template>
