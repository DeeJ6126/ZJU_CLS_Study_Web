<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  result: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['verify-cc98']);

const code = ref('');

function submitVerification() {
  emit('verify-cc98', { code: code.value });
}

watch(() => props.result, (result) => {
  if (result?.ok) {
    code.value = '';
  }
});
</script>

<template>
  <form class="cc98-verification" @submit.prevent="submitVerification">
    <div class="cc98-verification__copy">
      <strong>CC98 验证码注册</strong>
      <span>当前仅为前端原型状态，后续会迁移到后端接口。</span>
    </div>

    <label>
      <span>验证码</span>
      <input
        v-model="code"
        type="text"
        autocomplete="off"
        inputmode="text"
        placeholder="输入固定验证码"
      />
    </label>

    <button type="submit">匹配验证码</button>

    <p
      v-if="result?.message"
      class="cc98-verification__message"
      :class="{ 'is-success': result.ok, 'is-error': !result.ok }"
    >
      {{ result.message }}
    </p>
  </form>
</template>
