<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { MAX_BATCH_ITEMS, readContentBatchFile, downloadContentBatch, prepareContentBatchRequest, completeContentBatchRequest } from '../../services/contentBatchFileService.js';

const props = defineProps({ mode: { type: String, required: true }, apiClient: { type: Object, required: true }, scope: { type: String, required: true }, isDemo: Boolean });
const emit = defineEmits(['close', 'imported']);
const batchDocument = ref(null), fileName = ref(''), preview = ref(null), importResult = ref(null);
const requestId = ref(''), busy = ref(false), fileBusy = ref(false), error = ref(''), success = ref('');
const exportType = ref(''), courses = ref([]), selectedCodes = ref([]), courseQuery = ref(''), catalogBusy = ref(false);
const types = { experience: '学习心得', material: '复习资料' };
const previewValid = computed(() => preview.value?.total > 0 && preview.value.invalidCount === 0 && !importResult.value);
const filteredCourses = computed(() => {
  const query = courseQuery.value.trim().toLocaleLowerCase('zh-CN');
  return courses.value.filter(course => !query || `${course.name} ${course.code}`.toLocaleLowerCase('zh-CN').includes(query));
});
const selectedCount = computed(() => courses.value.reduce((total, course) => total + (selectedCodes.value.includes(course.code) ? course.count : 0), 0));
const exportReady = computed(() => selectedCount.value > 0 && selectedCount.value <= MAX_BATCH_ITEMS && !busy.value && !catalogBusy.value);
let disposed = false, catalogSequence = 0, fileSequence = 0;

async function selectFile(event) {
  const sequence = ++fileSequence;
  fileBusy.value = true;
  batchDocument.value = null; preview.value = null; importResult.value = null;
  error.value = ''; success.value = ''; requestId.value = '';
  const file = event.target.files?.[0];
  fileName.value = file?.name ?? '';
  try {
    const result = await readContentBatchFile(file);
    if (disposed || sequence !== fileSequence) return;
    if (result.ok) { batchDocument.value = result.document; requestId.value = crypto.randomUUID(); }
    else error.value = result.message;
  } finally { if (!disposed && sequence === fileSequence) fileBusy.value = false; }
}

async function previewImport() {
  if (busy.value || fileBusy.value || !batchDocument.value || props.isDemo) return;
  busy.value = true; error.value = ''; success.value = ''; preview.value = null;
  try {
    const result = await props.apiClient.previewContentBatch(batchDocument.value);
    if (disposed) return;
    if (result.ok) preview.value = result.preview;
    else error.value = result.message || '校验失败，请重试。';
  } catch { if (!disposed) error.value = '校验失败，请重试。'; }
  finally { if (!disposed) busy.value = false; }
}

async function confirmImport() {
  if (busy.value || !previewValid.value || props.isDemo) return;
  const pending = prepareContentBatchRequest(props.scope, preview.value.fingerprint, requestId.value);
  if (!pending.ok) { error.value = pending.message; return; }
  requestId.value = pending.requestId;
  busy.value = true; error.value = ''; success.value = '';
  try {
    const result = await props.apiClient.importContentBatch(batchDocument.value, { fingerprint: preview.value.fingerprint, requestId: requestId.value });
    if (disposed) return;
    if (!result.ok) { error.value = result.message || '导入失败，可以重试。'; return; }
    importResult.value = result.result;
    const cleanup = completeContentBatchRequest(props.scope, preview.value.fingerprint, requestId.value);
    if (!cleanup.ok) error.value = cleanup.message;
    success.value = `已生成 ${result.result.createdCount} 条草稿。`;
    emit('imported', result.result);
  } catch { if (!disposed) error.value = '导入失败，可以重试。'; }
  finally { if (!disposed) busy.value = false; }
}

async function loadCatalog() {
  const sequence = ++catalogSequence;
  catalogBusy.value = true;
  selectedCodes.value = []; courses.value = []; error.value = ''; success.value = '';
  if (props.isDemo) { catalogBusy.value = false; return; }
  try {
    const result = await props.apiClient.fetchBatchCatalog(exportType.value);
    if (disposed || sequence !== catalogSequence) return;
    if (result.ok) courses.value = result.courses ?? [];
    else error.value = result.message || '导出课程加载失败。';
  } catch { if (!disposed && sequence === catalogSequence) error.value = '导出课程加载失败。'; }
  finally { if (!disposed && sequence === catalogSequence) catalogBusy.value = false; }
}

function selectAll() { if (!busy.value) selectedCodes.value = filteredCourses.value.map(course => course.code); }
async function exportJson() {
  if (!exportReady.value || props.isDemo) return;
  busy.value = true; error.value = ''; success.value = '';
  try {
    const result = await props.apiClient.exportContentBatch({ type: exportType.value, courseCodes: [...selectedCodes.value] });
    if (disposed) return;
    if (!result.ok) { error.value = result.message || '导出失败，请重试。'; return; }
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
    downloadContentBatch(result.document, `zjubio-${exportType.value || 'resources'}-${day}.json`);
    success.value = `已导出 ${result.count} 条内容。`;
  } catch { if (!disposed) error.value = '导出失败，请重试。'; }
  finally { if (!disposed) busy.value = false; }
}

function canLeave() {
  if (busy.value || fileBusy.value) return false;
  return !batchDocument.value || Boolean(importResult.value) || window.confirm('导入尚未完成，确定离开吗？');
}
function close() { if (canLeave()) emit('close'); }
defineExpose({ canLeave, shouldBlockUnload: () => busy.value || fileBusy.value });
watch(exportType, loadCatalog);
onMounted(() => { if (props.mode === 'export') loadCatalog(); });
onBeforeUnmount(() => { disposed = true; ++catalogSequence; ++fileSequence; });
</script>

<template>
  <section class="admin-batch-panel" :aria-label="mode === 'import' ? '批量导入' : '批量导出'">
    <header class="admin-editor__head">
      <div><span>课程资源</span><strong>{{ mode === 'import' ? '批量导入' : '批量导出' }}</strong></div>
      <button type="button" :disabled="busy || fileBusy" @click="close">关闭</button>
    </header>
    <p v-if="isDemo" class="admin-notice" role="status">批量导入与导出在真实管理员账号中使用。</p>
    <p v-if="error" class="admin-batch-error" role="alert">{{ error }}</p>
    <p v-if="success" class="admin-notice" role="status">{{ success }}</p>
    <template v-if="mode === 'import'">
      <div class="admin-batch-upload">
        <label><span>JSON 文件（最多 200 条，8 MB）</span><input type="file" accept=".json,application/json" aria-label="选择 JSON 文件" :disabled="busy || fileBusy || isDemo" @change="selectFile"></label>
        <button type="button" class="admin-primary-action" :disabled="busy || fileBusy || !batchDocument || isDemo || Boolean(importResult)" @click="previewImport">{{ busy && !preview ? '正在校验...' : '校验并预览' }}</button>
      </div>
      <div v-if="preview" class="admin-batch-preview">
        <div class="admin-batch-summary"><strong>{{ fileName }}</strong><span>{{ preview.total }} 条 · 有效 {{ preview.validCount }} 条 · 错误 {{ preview.invalidCount }} 条</span></div>
        <div class="admin-batch-table-wrap">
          <table class="admin-batch-table">
            <thead><tr><th>序号</th><th>课程</th><th>类别</th><th>标题 / 作者</th><th>校验结果</th></tr></thead>
            <tbody><tr v-for="row in preview.rows" :key="row.index" :class="{ 'has-error': row.errors.length }">
              <td>{{ row.index }}</td><td>{{ row.courseName || row.courseCode }}<small>{{ row.courseCode }}</small></td>
              <td>{{ types[row.type] || row.type }}</td><td>{{ row.title || '未填写标题' }}<small>{{ row.author || '未填写作者' }}</small></td>
              <td><span v-if="!row.errors.length" class="admin-batch-valid">有效 · {{ row.bodyFormat === 'ubb' ? 'UBB' : 'Markdown' }}</span><p v-for="message in row.errors" :key="message">{{ message }}</p><small v-for="message in row.warnings" :key="message">{{ message }}</small></td>
            </tr></tbody>
          </table>
        </div>
      </div>
      <footer class="admin-editor__actions admin-batch-actions">
        <span>{{ importResult ? '草稿已生成' : '导入状态：草稿' }}</span>
        <button type="button" :disabled="busy || fileBusy" @click="close">返回列表</button>
        <button class="admin-primary-action" type="button" :disabled="busy || !previewValid || isDemo" @click="confirmImport">{{ busy && preview ? '正在生成...' : '确认生成草稿' }}</button>
      </footer>
    </template>
    <template v-else>
      <div class="admin-batch-export-filters">
        <label><span>类别</span><select v-model="exportType" aria-label="导出类别" :disabled="busy || isDemo"><option value="">全部类别</option><option value="experience">学习心得</option><option value="material">复习资料</option></select></label>
        <label><span>课程</span><input v-model="courseQuery" type="search" aria-label="筛选导出课程" placeholder="搜索课程名称" :disabled="busy || isDemo"></label>
      </div>
      <div class="admin-batch-selection"><span>已发布内容</span><button type="button" :disabled="busy || catalogBusy || !filteredCourses.length" @click="selectAll">选择全部</button><button type="button" :disabled="busy || !selectedCodes.length" @click="selectedCodes = []">清空选择</button><button v-if="error" type="button" :disabled="busy || catalogBusy" @click="loadCatalog">重新加载</button></div>
      <p v-if="catalogBusy" class="admin-list__empty">正在加载课程...</p>
      <fieldset v-else class="admin-batch-courses" :disabled="busy || isDemo" aria-label="导出课程">
        <label v-for="course in filteredCourses" :key="course.code"><input v-model="selectedCodes" type="checkbox" :value="course.code"><span>{{ course.name }} [{{ course.count }}]</span></label>
        <p v-if="!filteredCourses.length" class="admin-list__empty">没有符合条件的已发布内容。</p>
      </fieldset>
      <footer class="admin-editor__actions admin-batch-actions"><span>已选 {{ selectedCount }} 条<span v-if="selectedCount > MAX_BATCH_ITEMS" class="admin-batch-error"> · 每次最多 200 条，请缩小范围</span></span><button type="button" :disabled="busy" @click="close">返回列表</button><button class="admin-primary-action" type="button" :disabled="!exportReady || isDemo" @click="exportJson">{{ busy ? '正在导出...' : '导出 JSON' }}</button></footer>
    </template>
  </section>
</template>
