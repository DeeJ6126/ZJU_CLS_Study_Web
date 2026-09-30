<script setup>
import { computed, ref, useId, watch } from 'vue';
import { filterTeacherSuggestions } from '../services/teacherSuggestionService.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  names: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);
const listId = `teacher-options-${useId()}`;
const open = ref(false);
const activeIndex = ref(-1);
const list = ref(null);
const prefix = computed(() => props.modelValue.trim());
const suggestions = computed(() => filterTeacherSuggestions(props.names, props.modelValue));
const expanded = computed(() => open.value && !props.readonly && suggestions.value.length > 0);
watch(suggestions, () => { activeIndex.value = -1; });

function select(name) {
  emit('update:modelValue', name);
  open.value = false;
  activeIndex.value = -1;
}

function onKeydown(event) {
  if (props.readonly || event.isComposing) return;
  if (event.key === 'Escape' && open.value) {
    event.preventDefault();
    event.stopPropagation();
    open.value = false;
    activeIndex.value = -1;
  } else if (['ArrowDown', 'ArrowUp'].includes(event.key) && suggestions.value.length) {
    event.preventDefault();
    open.value = true;
    const length = suggestions.value.length;
    activeIndex.value = activeIndex.value < 0
      ? (event.key === 'ArrowDown' ? 0 : length - 1)
      : (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + length) % length;
    list.value?.children[activeIndex.value]?.scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter' && expanded.value && activeIndex.value >= 0) {
    event.preventDefault();
    select(suggestions.value[activeIndex.value]);
  }
}
</script>

<template>
  <div class="teacher-name-input">
    <input
      :value="modelValue" type="text" maxlength="40" autocomplete="off"
      :placeholder="placeholder" :readonly="readonly" role="combobox"
      aria-autocomplete="list" :aria-expanded="expanded" :aria-controls="listId"
      :aria-activedescendant="expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined"
      @input="emit('update:modelValue', $event.target.value); open = true"
      @focus="open = true" @blur="open = false; activeIndex = -1" @keydown="onKeydown"
    />
    <ul v-if="expanded" :id="listId" ref="list" role="listbox" aria-label="老师名单">
      <li
        v-for="(name, index) in suggestions" :id="`${listId}-${index}`" :key="name"
        role="option" :aria-selected="activeIndex === index" :class="{ 'is-active': activeIndex === index }"
        @pointerdown.prevent="select(name)"
      ><strong v-if="prefix">{{ name.slice(0, prefix.length) }}</strong>{{ name.slice(prefix.length) }}</li>
    </ul>
  </div>
</template>

<style scoped>
.teacher-name-input { position: relative; width: 100%; min-width: 0; }
.teacher-name-input input { width: 100%; box-sizing: border-box; }
.teacher-name-input ul {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 30;
  max-height: 240px; overflow-y: auto; margin: 4px 0 0; padding: 4px;
  list-style: none; background: var(--color-surface); color: var(--color-ink);
  border: 1px solid var(--color-input-border); border-radius: 4px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
}
.teacher-name-input li { padding: 9px 12px; cursor: pointer; font-size: 15px; font-weight: 400; overflow-wrap: anywhere; }
.teacher-name-input li:hover, .teacher-name-input li.is-active { background: var(--color-soft); }
.teacher-name-input strong { color: #287448; font-weight: 800; }
:global(html[data-theme="silent-black"]) .teacher-name-input strong,
:global(html[data-theme="tech-innovation"]) .teacher-name-input strong,
:global(html[data-theme="dark"]) .teacher-name-input strong { color: #7fdaa2; }
</style>
