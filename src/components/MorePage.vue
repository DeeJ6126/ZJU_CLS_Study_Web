<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { imageFileToAvatarDataUrl, studentHomepageApiClient } from '../services/studentHomepageApiClient.js';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  homepageClient: { type: Object, default: null },
  canSubmit: { type: Boolean, default: false },
  viewerKey: { type: String, default: 'guest' },
});
const emit = defineEmits(['request-login']);
const client = computed(() => props.homepageClient ?? studentHomepageApiClient);
const homepages = ref([]);
const loading = ref(false);
const loadError = ref('');
const notice = ref('');
const formNotice = ref('');
const dialogOpen = ref(false);
const submitting = ref(false);
const avatarBusy = ref(false);
const form = reactive({ name: '', href: '', avatarUrl: '' });
const trigger = ref(null);
const panel = ref(null);
let loadSequence = 0;
let avatarSequence = 0;
let submissionSequence = 0;
let previousOverflow = '';

function avatarImage(value) {
  if (value.startsWith('data:')) return value;
  return publicAssetPath(value.replace(/^\/zjubio\//, ''));
}

async function loadHomepages() {
  const sequence = ++loadSequence;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await client.value.fetchHomepages();
    if (sequence !== loadSequence) return;
    if (!result.ok) { loadError.value = result.message || '同学主页暂时无法读取。'; return; }
    homepages.value = result.homepages ?? [];
  } catch {
    if (sequence === loadSequence) loadError.value = '同学主页暂时无法读取。';
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

function resetForm() {
  ++avatarSequence;
  avatarBusy.value = false;
  Object.assign(form, { name: '', href: '', avatarUrl: '' });
  formNotice.value = '';
}

function openSubmission() {
  if (!props.canSubmit) { emit('request-login'); return; }
  notice.value = '';
  resetForm();
  dialogOpen.value = true;
}

function closeSubmission() {
  if (submitting.value) return;
  dialogOpen.value = false;
  resetForm();
}

async function selectAvatar(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const sequence = ++avatarSequence;
  avatarBusy.value = true;
  formNotice.value = '';
  form.avatarUrl = '';
  try {
    const image = await imageFileToAvatarDataUrl(file);
    if (sequence === avatarSequence) form.avatarUrl = image;
  } catch (error) {
    if (sequence === avatarSequence) formNotice.value = error.message;
  } finally {
    if (sequence === avatarSequence) avatarBusy.value = false;
  }
}

async function submitHomepage() {
  if (submitting.value || avatarBusy.value) return;
  if (!props.canSubmit) { formNotice.value = '完成学号认证后即可投稿同学主页。'; return; }
  if (!form.avatarUrl) { formNotice.value = '请先选择头像。'; return; }
  const sequence = ++submissionSequence;
  submitting.value = true;
  formNotice.value = '';
  try {
    const result = await client.value.submitApplication({ ...form });
    if (sequence !== submissionSequence) return;
    if (!result.ok) { formNotice.value = result.message || '投稿失败，请重试。'; return; }
    dialogOpen.value = false;
    resetForm();
    notice.value = '投稿已提交，审核通过后会显示在同学主页目录中。';
  } catch {
    if (sequence === submissionSequence) formNotice.value = '投稿失败，请稍后重试。';
  } finally {
    if (sequence === submissionSequence) submitting.value = false;
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); closeSubmission(); return; }
  if (event.key !== 'Tab') return;
  const controls = [...(panel.value?.querySelectorAll('button:not(:disabled), input:not(:disabled)') ?? [])];
  const first = controls[0], last = controls.at(-1);
  if (first && event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (last && !event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

watch(dialogOpen, async (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeydown);
    await nextTick();
    panel.value?.querySelector('input')?.focus();
  } else {
    document.body.style.overflow = previousOverflow;
    document.removeEventListener('keydown', handleKeydown);
    trigger.value?.focus();
  }
});

watch(() => [props.viewerKey, props.homepageClient], () => {
  ++submissionSequence;
  submitting.value = false;
  dialogOpen.value = false;
  resetForm();
  notice.value = '';
  homepages.value = [];
  loadHomepages();
}, { immediate: true });

onBeforeUnmount(() => {
  ++loadSequence; ++avatarSequence; ++submissionSequence;
  if (dialogOpen.value) document.body.style.overflow = previousOverflow;
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <section class="more-page" aria-labelledby="more-title">
    <header class="more-page__head"><h1 id="more-title">更多</h1></header>
    <nav class="more-page__nav" aria-label="更多栏目"><a href="#more" aria-current="page">同学主页</a></nav>
    <section class="more-homepages" aria-labelledby="more-homepages-title">
      <header class="more-homepages__head">
        <h2 id="more-homepages-title">同学主页</h2>
        <button ref="trigger" type="button" class="more-primary-action" @click="openSubmission">投稿</button>
      </header>
      <p v-if="notice" class="more-notice" role="status">{{ notice }}</p>
      <p v-if="loading" class="more-state" role="status">正在读取同学主页...</p>
      <div v-else-if="loadError" class="more-state" role="alert">{{ loadError }} <button type="button" @click="loadHomepages">重试</button></div>
      <p v-else-if="!homepages.length" class="more-state">暂无同学主页。</p>
      <div v-else class="more-homepages__list">
        <component :is="homepage.href ? 'a' : 'div'" v-for="(homepage, index) in homepages" :key="homepage.id"
          class="more-homepage-row" :class="{ 'is-placeholder': !homepage.href }"
          :href="homepage.href || undefined" :target="homepage.href ? '_blank' : undefined" :rel="homepage.href ? 'noopener noreferrer' : undefined">
          <img v-if="homepage.avatarUrl" :src="avatarImage(homepage.avatarUrl)" :alt="`${homepage.name}的头像`" width="64" height="64">
          <span v-else class="more-homepage-row__avatar" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
          <div><strong>{{ homepage.name }}</strong><span>{{ homepage.href || '期待你的主页' }}</span></div>
        </component>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="dialogOpen" class="more-submission-overlay" @click.self="closeSubmission">
        <section ref="panel" class="more-submission-dialog" role="dialog" aria-modal="true" aria-labelledby="homepage-submit-title">
          <header><h2 id="homepage-submit-title">投稿同学主页</h2><button type="button" aria-label="关闭投稿窗口" :disabled="submitting" @click="closeSubmission">×</button></header>
          <form @submit.prevent="submitHomepage">
            <fieldset :disabled="submitting">
              <label>名称<input v-model.trim="form.name" required maxlength="40" autocomplete="nickname"></label>
              <label>头像<input type="file" accept="image/png,image/jpeg,image/webp" required @change="selectAvatar"></label>
              <p v-if="avatarBusy" role="status">正在处理头像...</p>
              <img v-if="form.avatarUrl" class="more-avatar-preview" :src="form.avatarUrl" alt="头像预览" width="64" height="64">
              <label>主页链接<input v-model.trim="form.href" required type="url" maxlength="500" placeholder="https://" autocomplete="url"></label>
            </fieldset>
            <p v-if="formNotice" class="more-notice" role="alert">{{ formNotice }}</p>
            <footer><button type="button" :disabled="submitting" @click="closeSubmission">取消</button><button class="more-primary-action" type="submit" :disabled="submitting || avatarBusy">{{ submitting ? '正在提交...' : '提交审核' }}</button></footer>
          </form>
        </section>
      </div>
    </Teleport>
  </section>
</template>
