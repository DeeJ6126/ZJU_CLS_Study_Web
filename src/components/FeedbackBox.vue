<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { feedbackApiClient } from '../services/feedbackApiClient.js';
const props = defineProps({ client: { type: Object, default: null }, viewerKey: { type: String, default: 'guest' } });
const api = computed(() => props.client ?? feedbackApiClient);
const open = ref(false), body = ref(''), busy = ref(false), notice = ref(''), error = ref('');
const textarea = ref(null), panel = ref(null), trigger = ref(null);
let sequence = 0, previousOverflow = '';
function show() { error.value = ''; notice.value = ''; open.value = true; }
function close() { if (!busy.value) open.value = false; }
async function send() {
  if (busy.value) return;
  const text = body.value.trim();
  if (!text || text.length > 2000) { error.value = '请填写1至2000字的意见。'; return; }
  const current = ++sequence; busy.value = true; error.value = '';
  try {
    const result = await api.value.submit(text);
    if (current !== sequence) return;
    if (!result.ok) { error.value = result.message || '发送失败，请重试。'; return; }
    body.value = ''; open.value = false; notice.value = result.persistenceWarning || '意见已发送，感谢反馈。';
  } catch { if (current === sequence) error.value = '发送失败，请稍后重试。'; }
  finally { if (current === sequence) busy.value = false; }
}
function keydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); close(); }
  if (event.key !== 'Tab') return;
  const controls = [...(panel.value?.querySelectorAll('button:not(:disabled), textarea:not(:disabled)') ?? [])];
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
watch(open, async (value) => {
  if (value) {
    previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', keydown); await nextTick(); textarea.value?.focus();
  } else {
    document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); trigger.value?.focus();
  }
});
watch(() => props.viewerKey, () => { ++sequence; busy.value = false; open.value = false; body.value = ''; error.value = ''; notice.value = ''; });
onBeforeUnmount(() => { ++sequence; if (open.value) document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); });
</script>
<template>
  <section class="feedback-entry" aria-labelledby="feedback-title">
    <h2 id="feedback-title">意见反馈</h2><button ref="trigger" type="button" @click="show">反馈意见</button>
    <p v-if="notice" role="status">{{ notice }}</p>
    <Teleport to="body"><div v-if="open" class="feedback-overlay" @click.self="close">
      <section ref="panel" class="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
        <header><h2 id="feedback-dialog-title">意见反馈</h2><button type="button" aria-label="关闭意见反馈" :disabled="busy" @click="close">×</button></header>
        <form @submit.prevent="send"><label for="feedback-body">意见内容</label>
          <textarea id="feedback-body" ref="textarea" v-model="body" required maxlength="2000" rows="8" :disabled="busy"></textarea>
          <p v-if="error" role="alert">{{ error }}</p>
          <footer><button type="button" :disabled="busy" @click="close">取消</button><button type="submit" :disabled="busy">{{ busy ? '正在发送...' : '发送' }}</button></footer>
        </form>
      </section>
    </div></Teleport>
  </section>
</template>
