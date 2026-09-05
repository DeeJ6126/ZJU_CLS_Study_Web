<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';

const props = defineProps({
  tabLabel: {
    type: String,
    required: true,
  },
  canSubmit: {
    type: Boolean,
    required: true,
  },
  submissionNotice: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['submit-contribution']);
const isOpen = ref(false);
const notice = ref('');
const form = reactive({
  title: '',
  subtitle: '',
  cc98Name: '',
  cc98Link: '',
  body: '',
  materialLink: '',
  gradePercentage: '',
  bodyFormat: 'markdown',
});
const pdfFile = ref(null);
const bodyTextarea = ref(null);

const isUbb = computed(() => form.bodyFormat === 'ubb');

function resetForm() {
  form.title = '';
  form.subtitle = '';
  form.cc98Name = '';
  form.cc98Link = '';
  form.body = '';
  form.materialLink = '';
  form.gradePercentage = '';
  form.bodyFormat = 'markdown';
  pdfFile.value = null;
}

function openModal() {
  notice.value = props.canSubmit ? '' : '需要登录并完成 CC98 或浙大邮箱认证后才可以投稿。';
  isOpen.value = true;
}

function closeModal() {
  isOpen.value = false;
  notice.value = '';
}

const panelRef = ref(null);

function focusableElements() {
  const root = panelRef.value;
  if (!root) return [];
  return Array.from(root.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ));
}

function trapTab(event) {
  if (event.key !== 'Tab') return;
  const focusables = focusableElements();
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onKeydown(event) {
  if (!isOpen.value) return;
  if (event.key === 'Escape') {
    event.stopPropagation();
    closeModal();
    return;
  }
  trapTab(event);
}

watch(isOpen, async (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown);
    await nextTick();
    const first = focusableElements()[0];
    if (first) first.focus();
  } else {
    document.removeEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
});

function handlePdfChange(event) {
  pdfFile.value = event.target.files?.[0] ?? null;
}

function switchFormat(format) {
  form.bodyFormat = format;
}

function wrapSelection(openTag, closeTag) {
  const textarea = bodyTextarea.value;
  if (!textarea) return;
  const start = textarea.selectionStart ?? form.body.length;
  const end = textarea.selectionEnd ?? form.body.length;
  const before = form.body.slice(0, start);
  const selected = form.body.slice(start, end);
  const after = form.body.slice(end);
  form.body = `${before}${openTag}${selected}${closeTag}${after}`;
  nextTick(() => {
    textarea.focus();
    const caret = start + openTag.length + selected.length;
    textarea.setSelectionRange(caret, caret);
  });
}

const ubbToolbar = [
  { label: 'B', title: '加粗', wrap: ['[b]', '[/b]'] },
  { label: 'I', title: '斜体', wrap: ['[i]', '[/i]'] },
  { label: 'U', title: '下划线', wrap: ['[u]', '[/u]'] },
  { label: 'S', title: '删除线', wrap: ['[s]', '[/s]'] },
  { label: '🔗', title: '链接', wrap: ['[url=]', '[/url]'], prompt: '请输入链接地址' },
  { label: '🖼', title: '图片', wrap: ['[img]', '[/img]'], prompt: '请输入图片地址' },
  { label: '"', title: '引用', wrap: ['[quote]', '[/quote]'] },
  { label: '< >', title: '代码', wrap: ['[code]', '[/code]'] },
  { label: 'T1', title: '字号', wrap: ['[size=3]', '[/size]'] },
  { label: '🎨', title: '颜色', wrap: ['[color=#333]', '[/color]'], prompt: '请输入颜色（#hex 或 red）' },
  { label: '☺', title: '表情', wrap: ['[smiley]', '[/smiley]'], prompt: '表情代号' },
];

function applyUbbTag(action) {
  if (!isUbb.value) {
    form.bodyFormat = 'ubb';
    nextTick(() => applyUbbTag(action));
    return;
  }
  let openTag = action.wrap[0];
  let closeTag = action.wrap[1];
  if (action.prompt) {
    if (typeof window === 'undefined') return;
    const value = window.prompt(action.title + '：' + (action.prompt || ''));
    if (!value) return;
    if (action.label === '🔗') openTag = `[url=${value}]`;
    else if (action.label === '🖼') {
      form.body = `${form.body}[img]${value}[/img]`;
      return;
    } else if (action.label === '🎨') openTag = `[color=${value}]`;
    else if (action.label === '☺') {
      form.body = `${form.body}[smiley]${value}[/smiley]`;
      return;
    }
  }
  wrapSelection(openTag, closeTag);
}

function submitContribution() {
  if (!props.canSubmit) {
    notice.value = '需要登录并完成 CC98 或浙大邮箱认证后才可以投稿。';
    return;
  }

  if (!form.title.trim() || !form.body.trim()) {
    notice.value = '请至少填写标题和内容。';
    return;
  }

  const percentage = form.gradePercentage.trim();
  if (percentage && (Number.isNaN(Number(percentage)) || Number(percentage) < 0 || Number(percentage) > 100)) {
    notice.value = '百分制成绩需要在 0-100 之间。';
    return;
  }

  emit('submit-contribution', {
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    cc98Name: form.cc98Name.trim(),
    cc98Link: form.cc98Link.trim(),
    body: form.body.trim(),
    bodyFormat: form.bodyFormat,
    materialLink: form.materialLink.trim(),
    gradePercentage: percentage,
    pdfFile: pdfFile.value,
  });
  notice.value = '投稿已发送审核。';
  resetForm();
  isOpen.value = false;
}
</script>

<template>
  <div class="contribution-entry">
    <button class="contribution-trigger" type="button" @click="openModal">投稿</button>
    <small v-if="submissionNotice" class="contribution-entry__notice">{{ submissionNotice }}</small>

    <Teleport to="body">
      <div v-if="isOpen" class="contribution-modal" role="dialog" aria-modal="true" aria-labelledby="contribution-title">
        <button class="contribution-modal__scrim" type="button" aria-label="关闭投稿窗口" @click="closeModal"></button>
        <section ref="panelRef" class="contribution-modal__panel">
          <header class="contribution-modal__head">
            <div>
              <p class="course-detail__kicker">{{ tabLabel }}</p>
              <h2 id="contribution-title">投稿审核</h2>
            </div>
            <button class="contribution-modal__close" type="button" aria-label="关闭" @click="closeModal">×</button>
          </header>

          <form class="contribution-form" @submit.prevent="submitContribution">
            <label>
              <span>标题</span>
              <input v-model="form.title" type="text" autocomplete="off" />
            </label>

            <label>
              <span>副标题（选填）</span>
              <input v-model="form.subtitle" type="text" autocomplete="off" />
            </label>

            <label>
              <span>cc98名字（选填）</span>
              <input v-model="form.cc98Name" type="text" autocomplete="off" />
            </label>

            <label>
              <span>cc98链接（选填）</span>
              <input v-model="form.cc98Link" type="url" autocomplete="off" />
            </label>

            <label v-if="tabLabel === '学习心得'">
              <span>成绩百分制（选填，0-100）</span>
              <input v-model="form.gradePercentage" type="number" min="0" max="100" step="1" placeholder="如 95" />
            </label>

            <div v-if="tabLabel === '学习心得'" class="contribution-form__wide contribution-form__format">
              <div class="contribution-form__format-head">
                <span>内容格式</span>
                <div class="contribution-form__format-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    :class="{ 'is-active': form.bodyFormat === 'markdown' }"
                    @click="switchFormat('markdown')"
                  >Markdown</button>
                  <button
                    type="button"
                    role="tab"
                    :class="{ 'is-active': form.bodyFormat === 'ubb' }"
                    @click="switchFormat('ubb')"
                  >UBB（论坛格式）</button>
                </div>
              </div>
              <div v-if="isUbb" class="contribution-form__ubb-toolbar" aria-label="UBB 工具栏">
                <button
                  v-for="action in ubbToolbar"
                  :key="action.label"
                  type="button"
                  class="contribution-form__ubb-button"
                  :title="action.title"
                  @click="applyUbbTag(action)"
                >{{ action.label }}</button>
              </div>
              <textarea
                ref="bodyTextarea"
                v-model="form.body"
                :placeholder="isUbb ? '支持 [b] 加粗 [i] 斜体 [u] 下划线 [s] 删除线 [url=...] 链接 [img] 图片 [quote] 引用 [code] 代码 [size=3] 字号 [color=#xxx] 颜色 [smiley] 表情 [align=left|center|right] 对齐' : '支持 Markdown 格式：**加粗** *斜体* [链接](url) > 引用 等'"
                rows="6"
              ></textarea>
            </div>

            <label v-else class="contribution-form__wide">
              <span>内容</span>
              <textarea v-model="form.body" rows="5"></textarea>
            </label>

            <!-- CRIT-RES-1: the file input was a stub — only the filename
                 was sent to the server, the binary was never uploaded. Use
                 the UBB [img]URL[/img] tag (above) or paste a CC98 image
                 link to embed images in your post. -->
            <p class="contribution-form__hint">
              插入图片请在内容里用 UBB <code>[img]图片地址[/img]</code>,
              或在 CC98 上传后粘贴图片链接。
            </p>

            <label>
              <span>复习资料链接</span>
              <input v-model="form.materialLink" type="url" autocomplete="off" />
            </label>

            <label v-if="tabLabel !== '学习心得'">
              <span>PDF（选填）</span>
              <input type="file" accept="application/pdf,.pdf" @change="handlePdfChange" />
            </label>

            <p v-if="notice" class="contribution-box__notice">{{ notice }}</p>

            <div class="contribution-form__actions">
              <button type="button" @click="closeModal">取消</button>
              <button type="submit">发送审核</button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
