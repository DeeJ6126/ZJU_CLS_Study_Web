<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import TeacherNameInput from './TeacherNameInput.vue';

const props = defineProps({
  teacherNames: { type: Array, default: () => [] },
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
  year: '',
  teacher: '',
  subtitle: '',
  authorName: '',
  cc98Link: '',
  body: '',
  gradePercentage: '',
  bodyFormat: 'markdown',
});
const bodyTextarea = ref(null);
const pdfInput = ref(null);
const pdfFile = ref(null);
const isDraggingPdf = ref(false);
const isSubmittingPaper = ref(false);
const pendingPaperSubmissionId = ref('');

const isPaper = computed(() => props.tabLabel === '历年试卷');
const isUbb = computed(() => form.bodyFormat === 'ubb');

function resetForm() {
  form.title = '';
  form.year = '';
  form.teacher = '';
  form.subtitle = '';
  form.authorName = '';
  form.cc98Link = '';
  form.body = '';
  form.gradePercentage = '';
  form.bodyFormat = 'markdown';
  pdfFile.value = null;
  pendingPaperSubmissionId.value = '';
  if (pdfInput.value) pdfInput.value.value = '';
}

function openModal() {
  notice.value = props.canSubmit ? '' : '需要完成学号认证后才可以投稿。';
  isOpen.value = true;
}

function closeModal() {
  if (isSubmittingPaper.value) return;
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


function switchFormat(format) {
  form.bodyFormat = format;
  cancelPrompt();
}

// HI-UI-4: replace blocking window.prompt with an inline input shown
// directly in the toolbar. `pendingPrompt` holds the toolbar action that
// needs a parameter; clearing it cancels the action.
const pendingPrompt = ref(null);
const promptInput = ref('');
const promptInputRef = ref(null);
const selectedUbbSize = ref('');
const selectedUbbColor = ref('#ff0000');

function openPrompt(action) {
  pendingPrompt.value = action;
  promptInput.value = '';
  nextTick(() => promptInputRef.value?.focus());
}

function cancelPrompt() {
  pendingPrompt.value = null;
  promptInput.value = '';
}

function confirmPrompt() {
  const action = pendingPrompt.value;
  const value = promptInput.value.trim();
  if (!action || !value) {
    cancelPrompt();
    return;
  }
  applyPromptedUbbTag(action, value);
  cancelPrompt();
}

function applyPromptedUbbTag(action, value) {
  if (action.id === 'link' && action.format === 'ubb') wrapSelection(`[url=${value}]`, '[/url]');
  if (action.id === 'link' && action.format === 'markdown') wrapSelection('[', `](${value})`);
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

function prefixSelectedLines(prefix) {
  const textarea = bodyTextarea.value;
  if (!textarea) return;
  const start = textarea.selectionStart ?? form.body.length;
  const end = textarea.selectionEnd ?? start;
  const lineStart = form.body.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = form.body.indexOf('\n', end);
  const lineEnd = nextBreak < 0 ? form.body.length : nextBreak;
  const selected = form.body.slice(lineStart, lineEnd);
  const transformed = selected.split('\n').map((line) => `${prefix}${line}`).join('\n');
  form.body = `${form.body.slice(0, lineStart)}${transformed}${form.body.slice(lineEnd)}`;
  nextTick(() => {
    textarea.focus();
    textarea.setSelectionRange(lineStart + prefix.length, lineStart + transformed.length);
  });
}

const markdownToolbar = [
  { id: 'heading', label: 'H', title: '标题', prefix: '## ' },
  { id: 'bold', label: 'B', title: '加粗', wrap: ['**', '**'] },
  { id: 'italic', label: 'I', title: '斜体', wrap: ['*', '*'] },
  { id: 'strike', label: 'S', title: '删除线', wrap: ['~~', '~~'] },
  { id: 'link', label: '🔗', title: '插入链接', format: 'markdown', prompt: '请输入链接地址' },
  { id: 'quote', label: '❞', title: '引用块', prefix: '> ' },
  { id: 'code', label: '</>', title: '代码块', wrap: ['\n```\n', '\n```\n'] },
  { id: 'list', label: '•', title: '无序列表', prefix: '- ' },
];

const ubbToolbar = [
  { id: 'bold', label: 'B', title: '加粗', wrap: ['[b]', '[/b]'] },
  { id: 'italic', label: 'I', title: '斜体', wrap: ['[i]', '[/i]'] },
  { id: 'underline', label: 'U', title: '下划线', wrap: ['[u]', '[/u]'] },
  { id: 'strike', label: 'S', title: '删除线', wrap: ['[del]', '[/del]'] },
  { id: 'left', label: '≡', title: '靠左', wrap: ['[align=left]', '[/align]'] },
  { id: 'center', label: '≡', title: '居中', wrap: ['[align=center]', '[/align]'] },
  { id: 'right', label: '≡', title: '靠右', wrap: ['[align=right]', '[/align]'] },
];
const ubbLinkAction = { id: 'link', label: '🔗', title: '插入链接', format: 'ubb', prompt: '请输入链接地址' };

function applyToolbarAction(action) {
  if (action.prompt) openPrompt(action);
  else if (action.prefix) prefixSelectedLines(action.prefix);
  else wrapSelection(...action.wrap);
}

function applyUbbSize(event) {
  const size = event.target.value;
  if (!size) return;
  wrapSelection(`[size=${size}]`, '[/size]');
  selectedUbbSize.value = '';
}

function applyUbbColor(event) {
  selectedUbbColor.value = event.target.value;
  wrapSelection(`[color=${selectedUbbColor.value}]`, '[/color]');
}

function selectPdf(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) {
    notice.value = '只能上传 PDF 文件。';
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    notice.value = 'PDF 文件不能超过 25 MB。';
    return;
  }
  pdfFile.value = file;
  notice.value = '';
}

function onPdfInput(event) {
  selectPdf(event.target.files?.[0]);
}

function onPdfDrop(event) {
  isDraggingPdf.value = false;
  selectPdf(event.dataTransfer?.files?.[0]);
}

function completePaperSubmission(result) {
  isSubmittingPaper.value = false;
  if (!result?.ok) {
    if (result?.submissionId) pendingPaperSubmissionId.value = result.submissionId;
    notice.value = result?.message || '投稿失败，请重试。';
    return;
  }
  notice.value = '';
  resetForm();
  isOpen.value = false;
}

async function submitContribution() {
  if (!props.canSubmit) {
    notice.value = '需要完成学号认证后才可以投稿。';
    return;
  }

  if (isPaper.value) {
    const year = form.year.trim();
    if (!year) {
      notice.value = '请填写年份。';
      return;
    }
    if (!pdfFile.value) {
      notice.value = '请选择 PDF 文件。';
      return;
    }
    if (await pdfFile.value.slice(0, 5).text() !== '%PDF-') {
      notice.value = '文件内容不是有效的 PDF。';
      return;
    }
    isSubmittingPaper.value = true;
    notice.value = '';
    emit('submit-contribution', {
      title: `${year} 历年试卷`,
      year,
      teacher: form.teacher.trim(),
      authorName: form.authorName.trim(),
      cc98Link: form.cc98Link.trim(),
      body: '',
      pdfFile: pdfFile.value,
      submissionId: pendingPaperSubmissionId.value,
      onComplete: completePaperSubmission,
    });
    return;
  }

  if (!form.title.trim() || !form.body.trim()) {
    notice.value = '请至少填写标题和内容。';
    return;
  }

  const percentage = String(form.gradePercentage ?? '').trim();
  if (percentage && (Number.isNaN(Number(percentage)) || Number(percentage) < 0 || Number(percentage) > 100)) {
    notice.value = '百分制成绩需要在 0-100 之间。';
    return;
  }

  emit('submit-contribution', {
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    teacher: form.teacher.trim(),
    authorName: form.authorName.trim(),
    cc98Link: form.cc98Link.trim(),
    body: form.body.trim(),
    bodyFormat: form.bodyFormat,
    gradePercentage: percentage,
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
            <label v-if="isPaper" class="contribution-form__wide">
              <span>年份</span>
              <input v-model.trim="form.year" type="text" maxlength="20" placeholder="如 2025-2026" required autocomplete="off" />
            </label>

            <label v-else class="contribution-form__wide">
              <span>标题</span>
              <input v-model="form.title" type="text" autocomplete="off" />
            </label>

            <div
              class="contribution-form__optional-row contribution-form__wide"
              :class="{ 'contribution-form__optional-row--with-grade': tabLabel === '学习心得' }"
            >
              <label v-if="!isPaper">
                <span>副标题（选填）</span>
                <input v-model="form.subtitle" type="text" autocomplete="off" />
              </label>

              <label>
                <span>老师姓名（选填）</span>
                <TeacherNameInput v-model="form.teacher" :names="teacherNames" />
              </label>

              <label>
                <span>名称（选填）</span>
                <input v-model.trim="form.authorName" type="text" maxlength="40" autocomplete="off" />
              </label>

              <label>
                <span>cc98链接（选填）</span>
                <input v-model="form.cc98Link" type="url" autocomplete="off" />
              </label>

              <label v-if="tabLabel === '学习心得'">
                <span>成绩百分制（选填，0-100）</span>
                <input v-model="form.gradePercentage" type="number" min="0" max="100" step="1" placeholder="如 95" />
              </label>
            </div>

            <div v-if="!isPaper" class="contribution-form__wide contribution-form__format">
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
              <div v-if="!isUbb" class="contribution-form__toolbar" aria-label="Markdown 工具栏">
                <button
                  v-for="action in markdownToolbar"
                  :key="action.id"
                  type="button"
                  class="contribution-form__tool-button"
                  :class="{ 'is-italic': action.id === 'italic', 'is-strike': action.id === 'strike' }"
                  :title="action.title"
                  :aria-label="action.title"
                  @click="applyToolbarAction(action)"
                >{{ action.label }}</button>
              </div>
              <div v-else class="contribution-form__toolbar" aria-label="UBB 工具栏">
                <button
                  v-for="action in ubbToolbar"
                  :key="action.id"
                  type="button"
                  class="contribution-form__tool-button"
                  :class="{ 'is-italic': action.id === 'italic', 'is-underline': action.id === 'underline', 'is-strike': action.id === 'strike', [`is-align-${action.id}`]: ['left', 'center', 'right'].includes(action.id) }"
                  :title="action.title"
                  :aria-label="action.title"
                  @click="applyToolbarAction(action)"
                >{{ action.label }}</button>
                <select v-model="selectedUbbSize" class="contribution-form__tool-select" title="字号大小" aria-label="字号大小" @change="applyUbbSize">
                  <option value="" disabled>字号</option>
                  <option v-for="size in 7" :key="size" :value="size">{{ size }}</option>
                </select>
                <input v-model="selectedUbbColor" class="contribution-form__color-picker" type="color" title="取色器" aria-label="取色器" @change="applyUbbColor">
                <button type="button" class="contribution-form__tool-button" title="插入链接" aria-label="插入链接" @click="applyToolbarAction(ubbLinkAction)">🔗</button>
              </div>
              <div v-if="pendingPrompt" class="contribution-form__ubb-prompt" role="dialog" aria-label="链接地址输入">
                <label>
                  <span>{{ pendingPrompt.title }}</span>
                  <input
                    ref="promptInputRef"
                    v-model.trim="promptInput"
                    :placeholder="pendingPrompt.prompt || ''"
                    @keydown.enter.prevent="confirmPrompt"
                    @keydown.escape.prevent="cancelPrompt"
                  />
                </label>
                <button type="button" class="secondary-button" @click="confirmPrompt">确定</button>
                <button type="button" class="secondary-button" @click="cancelPrompt">取消</button>
              </div>
              <textarea
                ref="bodyTextarea"
                v-model="form.body"
                :placeholder="isUbb ? '支持加粗、斜体、下划线、删除线、对齐、字号、颜色和链接；仍可直接粘贴 CC98 图片链接' : '支持标题、加粗、斜体、删除线、链接、引用块、代码块和无序列表'"
                rows="6"
              ></textarea>
            </div>

            <div v-if="isPaper" class="contribution-form__wide">
              <span class="contribution-form__file-label">PDF 文件</span>
              <input
                ref="pdfInput"
                class="contribution-form__file-input"
                type="file"
                accept="application/pdf,.pdf"
                aria-label="选择 PDF 文件"
                @change="onPdfInput"
              />
              <button
                type="button"
                class="contribution-form__dropzone"
                :class="{ 'is-dragging': isDraggingPdf }"
                :disabled="isSubmittingPaper"
                @click="pdfInput?.click()"
                @dragenter.prevent="isDraggingPdf = true"
                @dragover.prevent="isDraggingPdf = true"
                @dragleave.prevent="isDraggingPdf = false"
                @drop.prevent="onPdfDrop"
              >
                <strong>{{ pdfFile ? pdfFile.name : '选择 PDF 文件或拖到这里' }}</strong>
                <small>{{ pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB` : '仅支持 PDF，最大 25 MB' }}</small>
              </button>
            </div>

            <p v-if="notice" class="contribution-box__notice">{{ notice }}</p>

            <div class="contribution-form__actions">
              <button type="button" :disabled="isSubmittingPaper" @click="closeModal">取消</button>
              <button type="submit" :disabled="isSubmittingPaper">{{ isSubmittingPaper ? '正在提交...' : '发送审核' }}</button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
