<template>
  <div class="release-notes-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1>发布说明</h1>
      <div class="header-actions">
        <button class="btn-secondary" @click="handleImport">
          导入Markdown
        </button>
        <button
          class="btn-primary"
          @click="handleManualSave"
        >
          保存
        </button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errors.length > 0" class="error-banner">
      <div class="error-title">请修正以下错误：</div>
      <ul>
        <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
      </ul>
      <button class="error-close" @click="errors = []">×</button>
    </div>

    <!-- 表单内容 -->
    <div class="form-container">
      <!-- 版本等级 -->
      <section class="form-section" :class="{ 'has-error': hasFieldError('versionLevel') }">
        <h3>
          版本等级
          <span class="required">*</span>
        </h3>
        <VersionLevelSelector
          v-model="form.versionLevel"
          :options="versionLevelOptions"
        />
      </section>

      <!-- 发布说明 -->
      <section class="form-section" :class="{ 'has-error': hasFieldError('releaseNotes') }">
        <h3>
          发布说明
          <span class="required">*</span>
        </h3>
        <MarkdownEditor
          v-model="form.releaseNotes"
          :preview="true"
        />
      </section>

      <!-- 使用芯片范围 -->
      <section class="form-section" :class="{ 'has-error': hasFieldError('chipRange') }">
        <h3>
          使用芯片范围
          <span class="required">*</span>
        </h3>
        <ChipRangeInput v-model="form.chipRange" />
      </section>

      <!-- SDK版本信息 -->
      <section class="form-section">
        <h3>固件SDK版本信息</h3>
        <SdkVersionTable v-model="form.sdkVersions" />
      </section>

      <!-- 版本信息 -->
      <section class="form-section">
        <h3>版本信息</h3>
        <div class="version-row">
          <VersionInput
            v-model="form.sdkVersion"
            label="SDK版本 *"
            placeholder="如：v2.1.0"
            :class="{ 'has-error': hasFieldError('sdkVersion') }"
          />
          <VersionInput
            v-model="form.appVersion"
            label="APP版本 *"
            placeholder="如：v1.0.0"
            :class="{ 'has-error': hasFieldError('appVersion') }"
          />
        </div>
      </section>

      <!-- 注意事项 -->
      <section class="form-section">
        <h3>注意事项（可选）</h3>
        <textarea
          v-model="form.remarks"
          class="remarks-textarea"
          rows="4"
          placeholder="请输入注意事项..."
        />
      </section>

      <!-- 元数据 -->
      <section class="form-section metadata-section">
        <div class="metadata-info">
          <span>创建者：{{ form.metadata.createdBy }}</span>
          <span v-if="form.metadata.author">作者：{{ form.metadata.author }}</span>
          <span>创建时间：{{ formatDate(form.createdAt) }}</span>
          <span>更新时间：{{ formatDate(form.updatedAt) }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue';
import type { ReleaseNotesConfig, VersionLevelInfo } from '../types/releaseNotes';
import MarkdownEditor from '../components/releaseNotes/MarkdownEditor.vue';
import VersionLevelSelector from '../components/releaseNotes/VersionLevelSelector.vue';
import ChipRangeInput from '../components/releaseNotes/ChipRangeInput.vue';
import SdkVersionTable from '../components/releaseNotes/SdkVersionTable.vue';
import VersionInput from '../components/releaseNotes/VersionInput.vue';

declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

// 版本等级选项
const versionLevelOptions: VersionLevelInfo[] = [
  { level: 'A', name: '问题修复', description: '修复严重问题，客户必须修复', required: true },
  { level: 'B', name: '性能优化', description: '性能改进，客户可选择修复', required: false },
  { level: 'C', name: '功能增加', description: '新增功能，客户可选择修复', required: false }
];

// 表单数据
const form = reactive<ReleaseNotesConfig>({
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  versionLevel: 'C',
  releaseNotes: '',
  chipRange: [],
  sdkVersions: [],
  sdkVersion: '',
  appVersion: '',
  remarks: '',
  metadata: { createdBy: '', author: '' }
});

// 保存状态
const saveStatus = ref<{ type: 'saving' | 'saved' | 'error' | 'unsaved'; message: string } | null>(null);
const isSaving = ref(false);
const errors = ref<string[]>([]);
const fieldErrors = ref<Set<string>>(new Set());

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let statusClearTimer: ReturnType<typeof setTimeout> | null = null;

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (saveStatus.value?.type === 'unsaved') {
    e.preventDefault();
    e.returnValue = '';
  }
};

onMounted(() => {
  vscode.postMessage({ type: 'getReleaseNotesConfig' });
  window.addEventListener('message', handleMessage);
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  if (statusClearTimer) clearTimeout(statusClearTimer);
});

// 处理 Extension 消息
const handleMessage = (event: MessageEvent) => {
  const message = event.data;

  switch (message.type) {
    case 'releaseNotesConfigUpdated':
      Object.assign(form, message.payload);
      break;

    case 'releaseNotesSaved':
      isSaving.value = false;
      saveStatus.value = { type: 'saved', message: '已保存' };
      errors.value = [];
      fieldErrors.value.clear();
      clearStatusAfterDelay();
      break;

    case 'releaseNotesSaveError':
      isSaving.value = false;
      saveStatus.value = { type: 'error', message: '保存失败' };
      if (message.payload?.errors) {
        errors.value = message.payload.errors;
        updateFieldErrors(message.payload.errors);
      } else if (message.payload?.message) {
        errors.value = [message.payload.message];
      }
      break;
  }
};

// 更新字段错误映射
const updateFieldErrors = (errorList: string[]) => {
  fieldErrors.value.clear();
  errorList.forEach(error => {
    if (error.includes('版本等级')) fieldErrors.value.add('versionLevel');
    if (error.includes('发布说明')) fieldErrors.value.add('releaseNotes');
    if (error.includes('芯片范围')) fieldErrors.value.add('chipRange');
    if (error.includes('SDK版本')) fieldErrors.value.add('sdkVersion');
    if (error.includes('APP版本')) fieldErrors.value.add('appVersion');
  });
};

const hasFieldError = (field: string): boolean => fieldErrors.value.has(field);

const clearStatusAfterDelay = () => {
  if (statusClearTimer) clearTimeout(statusClearTimer);
  statusClearTimer = setTimeout(() => { saveStatus.value = null; }, 3000);
};

// 自动保存 - 监听所有表单字段
watch(
  [
    () => form.versionLevel,
    () => form.releaseNotes,
    () => form.chipRange,
    () => form.sdkVersions,
    () => form.sdkVersion,
    () => form.appVersion,
    () => form.remarks
  ],
  () => {
    if (saveStatus.value?.type !== 'saving') {
      saveStatus.value = { type: 'unsaved', message: '未保存' };
    }
    debouncedAutoSave();
  },
  { deep: true }
);

// 获取表单数据的深拷贝
const getFormPayload = () => {
  return {
    version: form.version,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
    versionLevel: form.versionLevel,
    releaseNotes: form.releaseNotes,
    chipRange: [...form.chipRange],
    sdkVersions: form.sdkVersions.map(v => ({ ...v })),
    sdkVersion: form.sdkVersion,
    appVersion: form.appVersion,
    remarks: form.remarks,
    metadata: { ...form.metadata }
  };
};

const debouncedAutoSave = () => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveStatus.value = { type: 'saving', message: '保存中...' };
    vscode.postMessage({ type: 'autoSaveReleaseNotes', payload: getFormPayload() });
  }, 500);
};

const handleManualSave = () => {
  isSaving.value = true;
  saveStatus.value = { type: 'saving', message: '保存中...' };
  vscode.postMessage({ type: 'saveReleaseNotes', payload: getFormPayload() });
};

const handleImport = () => {
  vscode.postMessage({ type: 'importReleaseNotes' });
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};
</script>

<style scoped>
.release-notes-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-status {
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.save-status.saving,
.save-status.unsaved { color: var(--vscode-descriptionForeground); }
.save-status.saved { color: #27ae60; }
.save-status.error { color: #e74c3c; }

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--vscode-descriptionForeground);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.btn-primary,
.btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.2s;
}

.btn-primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.btn-primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

.error-banner {
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid #e74c3c;
  border-radius: 4px;
  padding: 12px 16px;
  margin-bottom: 16px;
  position: relative;
}

.error-title {
  font-weight: 600;
  color: #e74c3c;
  margin-bottom: 8px;
}

.error-banner ul {
  margin: 0;
  padding-left: 20px;
  color: #e74c3c;
}

.error-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  color: #e74c3c;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 20px;
}

.form-section.has-error {
  border-color: #e74c3c;
  background: rgba(231, 76, 60, 0.05);
}

.form-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.required { color: #e74c3c; margin-left: 4px; }

.version-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.remarks-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-size: 14px;
  resize: vertical;
}

.remarks-textarea:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.metadata-section {
  background: transparent;
  border: none;
  padding: 0;
}

.metadata-info {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
</style>
