<script setup>
defineProps({
  items: {
    type: Array,
    required: true,
  },
  activeSection: {
    type: String,
    required: true,
  },
  settingsActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['select-navigation', 'open-settings']);
</script>

<template>
  <aside class="app-sidebar" aria-label="学习平台主导航">
    <div class="brand-panel">
      <a class="brand" href="#top" aria-label="返回学习平台首页">
        <span class="brand__seal" aria-hidden="true">
          <span class="brand__helix"></span>
        </span>
        <span class="brand__copy">
          <span class="brand__eyebrow">生命科学学院</span>
          <span class="brand__name">生科智学</span>
        </span>
      </a>
      <p class="brand__note">面向生命科学学子的学习与成长平台</p>
    </div>

    <nav class="sidebar-nav">
      <ul class="nav-list">
        <li
          v-for="(item, index) in items"
          :key="item.id"
          class="nav-list__item"
          :class="{ 'nav-list__item--group': item.children?.length }"
        >
          <a
            class="nav-item"
            :class="{ 'is-active': !settingsActive && activeSection === item.id }"
            :href="item.href"
            :aria-expanded="item.children?.length ? 'true' : undefined"
            @click="emit('select-navigation', item.id)"
          >
            <span class="nav-item__symbol" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="nav-item__copy">
              <span class="nav-item__label">{{ item.label }}</span>
              <span class="nav-item__meta">{{ item.kicker }}</span>
            </span>
          </a>

          <ul v-if="item.children?.length" class="nav-sublist" aria-label="最美活动子导航">
            <li v-for="child in item.children" :key="child.id" class="nav-sublist__item">
              <a class="nav-sublist__link" :href="child.href" @click="emit('select-navigation', item.id)">
                <span class="nav-sublist__mark" aria-hidden="true"></span>
                <span>{{ child.label }}</span>
              </a>
            </li>
          </ul>
        </li>
      </ul>
    </nav>

    <button
      class="settings-entry"
      :class="{ 'is-active': settingsActive }"
      type="button"
      aria-label="打开设置"
      @click="emit('open-settings')"
    >
      <span class="settings-entry__icon" aria-hidden="true">
        <span></span>
      </span>
      <span>
        <strong>设置</strong>
        <em>账号与主题</em>
      </span>
    </button>
  </aside>
</template>
