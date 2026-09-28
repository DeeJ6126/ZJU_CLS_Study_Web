<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { consultationApiClient } from '../services/consultationApiClient.js';
import { formatRelativeTime, isoDateTime } from '../utils/timeFormat.js';

const props = defineProps({
  status: { type: Object, default: null },
  initialConversationId: { type: String, default: '' },
});
const emit = defineEmits(['status-refresh']);

const currentStatus = ref(props.status);
const statusLoading = ref(!props.status);
const statusError = ref('');
const loading = ref(false);
const loadError = ref('');
const sendError = ref('');
const guestName = ref('');
const draft = ref('');
const sending = ref(false);
const conversations = ref([]);
const currentConversation = ref(null);
const activeConversationId = ref('');
const messages = ref([]);
const messageList = ref(null);
let timer = null;
let alive = false;
let loadingMessages = false;
let loadingMessageFor = '';
let loadingInbox = false;
let loadingStatus = false;
let messageVersion = 0;

const isOpen = computed(() => Boolean(currentStatus.value?.open));
const isMentor = computed(() => Boolean(currentStatus.value?.isMentor));
const activeConversation = computed(() => isMentor.value
  ? conversations.value.find((item) => String(item.id) === String(activeConversationId.value))
  : currentConversation.value);
const chatTitle = computed(() => isMentor.value
  ? activeConversation.value?.participantName || '选择咨询者'
  : currentStatus.value?.mentor?.nickname || '指导学长');
const senderIsMe = (message) => message.sender === (isMentor.value ? 'mentor' : 'visitor');

function scrollToLatest() {
  nextTick(() => {
    if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight;
  });
}

async function refreshStatus() {
  if (loadingStatus) return;
  loadingStatus = true;
  const result = await consultationApiClient.getStatus();
  loadingStatus = false;
  if (!alive) return;
  statusLoading.value = false;
  if (!result.ok) {
    statusError.value = result.message;
    return;
  }
  statusError.value = '';
  const wasOpen = isOpen.value;
  const wasMentor = isMentor.value;
  currentStatus.value = result;
  emit('status-refresh', result);
  if (result.open && (!wasOpen || wasMentor !== result.isMentor)) await loadInitial();
}

async function loadInitial() {
  if (!isOpen.value) return;
  loading.value = true;
  loadError.value = '';
  if (isMentor.value) {
    await refreshInbox();
  } else {
    const result = await consultationApiClient.getCurrentConversation();
    if (alive && result.ok) {
      currentConversation.value = result.conversation ?? null;
      activeConversationId.value = result.conversation?.id ?? '';
      if (result.conversation?.id) await refreshMessages(true);
      else messages.value = [];
    } else if (alive) {
      loadError.value = result.message;
    }
  }
  if (alive) loading.value = false;
}

async function refreshInbox() {
  if (!alive || !isOpen.value || !isMentor.value || loadingInbox) return;
  loadingInbox = true;
  const result = await consultationApiClient.listConversations();
  loadingInbox = false;
  if (!alive) return;
  if (!result.ok) {
    loadError.value = result.message;
    if (result.status === 401 || result.status === 403) {
      conversations.value = [];
      activeConversationId.value = '';
      messages.value = [];
    }
    return;
  }
  loadError.value = '';
  conversations.value = result.conversations ?? [];
  const requestedId = String(props.initialConversationId || '');
  const hasActive = conversations.value.some((item) => String(item.id) === String(activeConversationId.value));
  if (!hasActive) {
    const requested = conversations.value.find((item) => String(item.id) === requestedId);
    const nextId = requested?.id ?? conversations.value[0]?.id ?? '';
    if (nextId) await selectConversation(nextId);
    else {
      activeConversationId.value = '';
      messages.value = [];
    }
  }
}

async function selectConversation(id) {
  if (String(id) === String(activeConversationId.value)) return;
  activeConversationId.value = id;
  messages.value = [];
  sendError.value = '';
  await refreshMessages(true);
  await refreshInbox();
}

async function refreshMessages(scroll = false) {
  const id = activeConversationId.value;
  if (!alive || !id || (loadingMessages && String(loadingMessageFor) === String(id)) || !isOpen.value) return;
  loadingMessages = true;
  loadingMessageFor = id;
  const version = ++messageVersion;
  const result = await consultationApiClient.listMessages(id);
  if (version === messageVersion) loadingMessages = false;
  if (!alive || version !== messageVersion || String(id) !== String(activeConversationId.value)) return;
  if (!result.ok) {
    loadError.value = result.message;
    if (result.status === 401 || result.status === 403 || result.status === 404) {
      activeConversationId.value = '';
      currentConversation.value = null;
      messages.value = [];
    }
    return;
  }
  loadError.value = '';
  const hadNew = result.messages?.at(-1)?.id !== messages.value.at(-1)?.id;
  messages.value = result.messages ?? [];
  if (scroll || hadNew) scrollToLatest();
}

async function send() {
  const text = draft.value.trim();
  if (!text || sending.value || !isOpen.value) return;
  sending.value = true;
  sendError.value = '';
  let id = activeConversationId.value;
  if (!isMentor.value && !id) {
    const created = await consultationApiClient.createConversation({ guestName: guestName.value });
    if (!created.ok) {
      sendError.value = created.message;
      sending.value = false;
      return;
    }
    currentConversation.value = created.conversation;
    id = created.conversation?.id;
    activeConversationId.value = id ?? '';
  }
  if (!id) {
    sendError.value = '请选择一位咨询者。';
    sending.value = false;
    return;
  }
  const result = await consultationApiClient.sendMessage(id, text);
  sending.value = false;
  if (!alive) return;
  if (!result.ok) {
    sendError.value = result.message;
    if (result.status === 403) refreshStatus();
    return;
  }
  draft.value = '';
  if (result.message?.id && !messages.value.some((item) => item.id === result.message.id)) {
    messages.value = [...messages.value, result.message];
    scrollToLatest();
  }
  await refreshMessages(true);
  if (isMentor.value) await refreshInbox();
}

function onComposerKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send();
  }
}

watch(() => props.status, (value) => {
  if (!value) return;
  const wasOpen = isOpen.value;
  const wasMentor = isMentor.value;
  currentStatus.value = value;
  statusLoading.value = false;
  statusError.value = '';
  if (alive && value.open && (!wasOpen || wasMentor !== value.isMentor)) loadInitial();
});
watch(() => props.initialConversationId, (id) => {
  if (isMentor.value && id && conversations.value.some((item) => String(item.id) === String(id))) {
    selectConversation(id);
  }
});

onMounted(async () => {
  alive = true;
  if (props.status) await loadInitial();
  else await refreshStatus();
  timer = setInterval(() => {
    refreshStatus();
    if (isMentor.value) refreshInbox();
    refreshMessages();
  }, 4000);
});
onUnmounted(() => {
  alive = false;
  clearInterval(timer);
  messageVersion += 1;
});
</script>

<template>
  <article class="consultation-page">
    <header class="consultation-heading">
      <div>
        <p class="consultation-kicker">学业交流</p>
        <h1>咨询室</h1>
      </div>
      <span v-if="isOpen" class="consultation-live"><span aria-hidden="true"></span>开放中</span>
    </header>

    <div v-if="statusLoading" class="consultation-state" role="status">正在查看咨询室状态...</div>
    <div v-else-if="statusError && !isOpen" class="consultation-state consultation-state-error" role="alert">
      <p>{{ statusError }}</p>
      <button type="button" @click="refreshStatus">重试</button>
    </div>
    <div v-else-if="!isOpen" class="consultation-state">
      <h2>咨询室暂未开放</h2>
      <p>开放后可在这里与指导学长交流。</p>
    </div>

    <section v-else class="consultation-workspace" :class="{ 'is-mentor': isMentor }" aria-label="咨询聊天">
      <aside v-if="isMentor" class="consultation-inbox" aria-label="咨询者列表">
        <div class="consultation-inbox-heading">
          <h2>咨询者</h2>
          <span>{{ conversations.length }}</span>
        </div>
        <p v-if="loading && !conversations.length" class="consultation-inbox-empty">正在加载...</p>
        <p v-else-if="!conversations.length" class="consultation-inbox-empty">还没有人发起咨询。</p>
        <button v-for="item in conversations" :key="item.id" type="button" class="consultation-contact"
          :class="{ 'is-active': String(item.id) === String(activeConversationId) }"
          @click="selectConversation(item.id)">
          <span class="consultation-contact-avatar" aria-hidden="true">{{ item.participantName?.slice(0, 1) || '访' }}</span>
          <span class="consultation-contact-body">
            <strong>{{ item.participantName || '访客' }}</strong>
            <small>{{ item.latestMessage?.text || (item.latestMessageId ? '有新消息' : '等待消息') }}</small>
          </span>
          <span v-if="item.unreadCount" class="consultation-unread" :aria-label="`${item.unreadCount} 条未读消息`">{{ item.unreadCount }}</span>
        </button>
      </aside>

      <div class="consultation-chat">
        <header class="consultation-chat-header">
          <div class="consultation-chat-avatar" aria-hidden="true">{{ chatTitle.slice(0, 1) }}</div>
          <div>
            <h2>{{ chatTitle }}</h2>
            <p>{{ isMentor ? '一对一咨询' : '在线咨询' }}</p>
          </div>
        </header>

        <div ref="messageList" class="consultation-messages" role="log" aria-label="聊天记录" aria-live="polite">
          <p v-if="loading && !messages.length" class="consultation-chat-empty">正在加载聊天记录...</p>
          <p v-else-if="!activeConversationId && isMentor" class="consultation-chat-empty">选择左侧咨询者，开始交流。</p>
          <p v-else-if="!messages.length" class="consultation-chat-empty">发送第一条消息，开始咨询。</p>
          <article v-for="message in messages" :key="message.id" class="consultation-message" :class="{ 'is-mine': senderIsMe(message) }">
            <div class="consultation-bubble">{{ message.text }}</div>
            <time :datetime="isoDateTime(message.createdAt)">{{ formatRelativeTime(message.createdAt) }}</time>
          </article>
        </div>

        <form class="consultation-composer" @submit.prevent="send">
          <label v-if="!isMentor && !currentConversation" class="consultation-guest-name">
            <span>称呼（选填）</span>
            <input v-model="guestName" maxlength="32" autocomplete="nickname" placeholder="怎么称呼你？" />
          </label>
          <label class="consultation-message-input">
            <span class="consultation-visually-hidden">咨询消息</span>
            <textarea v-model="draft" rows="2" maxlength="1000" :disabled="isMentor && !activeConversationId"
              placeholder="输入你想咨询的问题" @keydown="onComposerKeydown"></textarea>
          </label>
          <div class="consultation-composer-foot">
            <p v-if="sendError || loadError" role="alert">{{ sendError || loadError }}</p>
            <span v-else></span>
            <button type="submit" :disabled="sending || !draft.trim() || (isMentor && !activeConversationId)">{{ sending ? '发送中' : '发送' }}</button>
          </div>
        </form>
      </div>
    </section>
  </article>
</template>
