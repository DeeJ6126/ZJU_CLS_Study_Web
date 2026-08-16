<script setup>
import { reactive, ref } from 'vue';

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
  imageName: '',
  materialLink: '',
  gpa: '',
});
const pdfFile = ref(null);

function resetForm() {
  form.title = '';
  form.subtitle = '';
  form.cc98Name = '';
  form.cc98Link = '';
  form.body = '';
  form.imageName = '';
  form.materialLink = '';
  form.gpa = '';
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

function handleImageChange(event) {
  form.imageName = event.target.files?.[0]?.name ?? '';
}

function handlePdfChange(event) {
  pdfFile.value = event.target.files?.[0] ?? null;
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

  emit('submit-contribution', {
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    cc98Name: form.cc98Name.trim(),
    cc98Link: form.cc98Link.trim(),
    body: form.body.trim(),
    imageName: form.imageName,
    materialLink: form.materialLink.trim(),
    gpa: form.gpa.trim(),
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
        <section class="contribution-modal__panel">
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
              <span>绩点（选填）</span>
              <input v-model="form.gpa" type="text" inputmode="decimal" placeholder="0.00 - 5.00" />
            </label>

            <label class="contribution-form__wide">
              <span>内容</span>
              <textarea v-model="form.body" rows="5"></textarea>
            </label>

            <label>
              <span>图片（选填）</span>
              <input type="file" accept="image/*" @change="handleImageChange" />
            </label>

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
