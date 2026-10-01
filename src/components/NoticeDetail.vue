<script setup>
import { computed } from 'vue';
import { noticeCategoryLabel } from '../data/noticeConfig.js';
import { renderCourseMarkdown } from '../utils/renderCourseMarkdown.js';
import {
  formatNoticeDate, formatNoticeFileSize, noticeAttachmentType, noticeAudienceLabel,
  noticeDeadlineState, safeNoticeUrl,
} from '../services/noticeViewService.js';

const props = defineProps({
  notice: { type: Object, required: true },
  now: { type: Date, default: () => new Date() },
});
const deadline = computed(() => noticeDeadlineState(props.notice, props.now));
const bodyHtml = computed(() => renderCourseMarkdown(props.notice.body));
const sourceUrl = computed(() => safeNoticeUrl(props.notice.sourceUrl));
const attachments = computed(() => (props.notice.attachments ?? []).map((attachment) => ({
  ...attachment, safeUrl: safeNoticeUrl(attachment.url, { attachment: true }),
})));
</script>

<template>
  <article class="notice-detail">
    <header class="notice-detail__head">
      <div class="notice-labels">
        <span class="notice-category">{{ noticeCategoryLabel(notice.category) }}</span>
        <span v-if="notice.pinned" class="notice-badge">置顶</span>
        <span v-if="deadline.id !== 'none'" class="notice-badge" :class="`notice-badge--${deadline.id}`">{{ deadline.label }}</span>
      </div>
      <h1>{{ notice.title }}</h1>
      <dl class="notice-detail__facts">
        <div v-if="notice.publisher"><dt>发布单位</dt><dd>{{ notice.publisher }}</dd></div>
        <div><dt>发布日期</dt><dd><time :datetime="notice.publishedDate">{{ formatNoticeDate(notice.publishedDate) || '未标注' }}</time></dd></div>
        <div><dt>适用对象</dt><dd>{{ noticeAudienceLabel(notice) }}</dd></div>
        <div><dt>截止时间</dt><dd :class="{ 'notice-expired': deadline.id === 'expired' }">{{ deadline.date || deadline.label }}</dd></div>
      </dl>
      <p v-if="notice.summary" class="notice-detail__summary">{{ notice.summary }}</p>
      <a v-if="sourceUrl" class="notice-source-link" :href="sourceUrl" target="_blank" rel="noopener noreferrer">查看原文 <span aria-hidden="true">↗</span></a>
    </header>

    <div v-if="notice.body" class="notice-body" v-html="bodyHtml"></div>

    <section v-if="attachments.length" class="notice-attachments" aria-labelledby="notice-attachments-title">
      <h2 id="notice-attachments-title">附件 <span>{{ attachments.length }}</span></h2>
      <ul>
        <li v-for="attachment in attachments" :key="attachment.id">
          <span class="notice-attachment-type">{{ noticeAttachmentType(attachment) }}</span>
          <div>
            <a v-if="attachment.safeUrl" :href="attachment.safeUrl" :download="attachment.fileName">{{ attachment.fileName }}</a>
            <span v-else>{{ attachment.fileName }}</span>
            <small>{{ formatNoticeFileSize(attachment.size) }}</small>
          </div>
          <a v-if="attachment.safeUrl" class="notice-attachment-download" :href="attachment.safeUrl" :download="attachment.fileName" :aria-label="`下载 ${attachment.fileName}`">下载</a>
          <span v-else class="notice-attachment-unavailable">暂不可用</span>
        </li>
      </ul>
    </section>
  </article>
</template>
