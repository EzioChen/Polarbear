<template>
  <div class="timeline-container">
    <h1 class="page-title">发布流程</h1>

    <!-- 发布主题输入 -->
    <div class="release-subject-section">
      <label class="subject-label">发布主题</label>
      <input
        v-model="releaseSubject"
        type="text"
        class="subject-input"
        placeholder="例如：Jieli_Home_iOS_V1.15.0_Beta1"
        :disabled="isProcessing || allCompleted"
        @change="saveSubject"
      />
      <p class="subject-hint">
        格式建议：项目名称_平台_版本号_类型
        <span v-if="releaseSubject">（最终文件名：{{ releaseSubject }}_{{ currentDate }}.zip）</span>
      </p>
    </div>

    <div class="timeline">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="timeline-item"
        :class="{
          'completed': step.status === 'completed',
          'in-progress': step.status === 'in-progress',
          'pending': step.status === 'pending'
        }"
      >
        <div class="timeline-marker">
          <div class="marker-circle">
            <svg v-if="step.status === 'completed'" class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else-if="step.status === 'in-progress'" class="loading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2" stroke-dasharray="60" stroke-dashoffset="20">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 12 12"
                  to="360 12 12"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
            <span v-else class="step-number">{{ index + 1 }}</span>
          </div>
          <div v-if="index < steps.length - 1" class="timeline-line" :class="{ 'active': step.status === 'completed' }"></div>
        </div>

        <div class="timeline-content">
          <h3 class="step-title">{{ step.title }}</h3>
          <p class="step-description">{{ step.description }}</p>
          <div class="step-status">
            <span class="status-badge" :class="step.status">
              {{ getStatusText(step.status) }}
            </span>
            <span v-if="step.timestamp" class="timestamp">
              {{ formatTime(step.timestamp) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button
        class="btn btn-primary"
        :disabled="allCompleted || isProcessing"
        @click="startNextStep"
      >
        {{ getActionButtonText() }}
      </button>
      <button
        class="btn btn-secondary"
        :disabled="isProcessing"
        @click="cancelTimeline"
      >
        取消
      </button>
    </div>

    <div v-if="currentStepData" class="step-detail-panel">
      <h3>{{ currentStepData.title }} - 详情</h3>
      <div class="detail-content">
        <!-- 打包步骤详情 -->
        <div v-if="currentStepData.id === 'pack'" class="pack-detail">
          <div v-if="packStatus === 'checking'" class="pack-status">
            <p>正在检查发布清单...</p>
          </div>
          <div v-else-if="packStatus === 'preparing'" class="pack-status">
            <p>准备打包...</p>
            <div class="pack-preview" v-if="packPreview.fileCount > 0">
              <p>待打包文件: {{ packPreview.fileCount }} 个</p>
              <p>总大小: {{ formatFileSize(packPreview.totalSize) }}</p>
              <p>文件夹: {{ packPreview.folders.join(', ') }}</p>
            </div>
          </div>
          <div v-else-if="packStatus === 'packing' || packStatus === 'completed'" class="pack-status">
            <p>{{ packStatus === 'completed' ? '打包完成!' : '正在打包...' }}</p>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: packProgress + '%' }"></div>
            </div>
            <p class="progress-text">{{ packProgress }}%</p>
          </div>
          <div v-else-if="packStatus === 'error'" class="pack-status error">
            <p class="error-text">打包失败: {{ packError }}</p>
          </div>
          <div v-if="packResult.zipPath" class="pack-result">
            <p class="success-text">✓ 打包成功</p>
            <p class="zip-path">文件路径: {{ packResult.zipPath }}</p>
            <p class="pack-stats">已打包: {{ packResult.packedFiles }} 个文件</p>
          </div>
        </div>

        <!-- 发布说明步骤详情 -->
        <div v-else-if="currentStepData.id === 'release-notes'" class="release-notes-detail">
          <!-- 文件检查状态 -->
          <div v-if="releaseNotesStatus === 'checking'" class="status-message">
            <p>正在检查发布说明文件...</p>
          </div>

          <!-- 文件不存在错误 -->
          <div v-else-if="releaseNotesStatus === 'error'" class="status-message error">
            <p class="error-text">❌ {{ releaseNotesError }}</p>
            <p class="hint-text">请先创建发布说明文件后再继续</p>
          </div>

          <!-- 文档生成和编辑界面 -->
          <div v-else-if="releaseNotesStatus === 'ready' || releaseNotesStatus === 'editing' || releaseNotesStatus === 'preview'" class="release-notes-editor">
            <!-- 工具栏 -->
            <div class="editor-toolbar">
              <button 
                class="btn btn-small" 
                :disabled="!generatedMarkdown"
                @click="toggleEditMode"
              >
                {{ releaseNotesStatus === 'editing' ? '预览' : '编辑' }}
              </button>
              <button
                class="btn btn-small btn-secondary"
                :disabled="!generatedMarkdown"
                @click="exportMarkdown"
              >
                导出 Markdown
              </button>
            </div>

            <!-- 编辑模式 -->
            <div v-if="releaseNotesStatus === 'editing'" class="editor-container">
              <textarea
                v-model="editedMarkdown"
                class="markdown-editor"
                placeholder="在此编辑发布说明内容..."
                :disabled="isProcessing"
              ></textarea>
            </div>

            <!-- 预览模式 -->
            <div v-else class="preview-container">
              <div class="markdown-preview" v-html="renderedMarkdown"></div>
            </div>

            <!-- 用户确认区域 -->
            <div v-if="generatedMarkdown && releaseNotesStatus !== 'editing'" class="confirmation-area">
              <label class="confirm-checkbox">
                <input 
                  type="checkbox" 
                  v-model="releaseNotesConfirmed"
                  :disabled="isProcessing"
                />
                <span>我已确认发布说明内容正确无误</span>
              </label>
            </div>

            <!-- 导出结果提示 -->
            <div v-if="exportResult.show" class="export-result" :class="exportResult.success ? 'success' : 'error'">
              <p>{{ exportResult.message }}</p>
              <p v-if="exportResult.filePath" class="file-path">文件: {{ exportResult.filePath }}</p>
            </div>
          </div>

          <!-- 处理中状态 -->
          <div v-else-if="releaseNotesStatus === 'generating'" class="status-message">
            <p>正在生成发布说明文档...</p>
            <div class="progress-bar">
              <div class="progress-fill indeterminate"></div>
            </div>
          </div>
        </div>

        <!-- 邮件步骤详情 -->
        <div v-else-if="currentStepData.id === 'email'" class="email-detail">
          <p>正在预编辑邮件...</p>
          <div class="email-preview">
            <div class="email-field"><strong>收件人:</strong> {{ emailPreview.to }}</div>
            <div class="email-field"><strong>主题:</strong> {{ emailPreview.subject }}</div>
            <div class="email-field"><strong>内容:</strong> {{ emailPreview.body }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useVscodeApi } from '../composables/useVscodeApi';

type StepStatus = 'pending' | 'in-progress' | 'completed';
type PackStatus = 'idle' | 'checking' | 'preparing' | 'packing' | 'completed' | 'error';
type ReleaseNotesStatus = 'idle' | 'checking' | 'error' | 'ready' | 'editing' | 'preview' | 'generating';

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  timestamp?: Date;
}

interface PackPreview {
  fileCount: number;
  totalSize: number;
  folders: string[];
}

interface PackResult {
  zipPath: string;
  packedFiles: number;
  skippedFiles: string[];
}

interface ExportResult {
  show: boolean;
  success: boolean;
  message: string;
  filePath?: string;
}

const { vscode, onMessage } = useVscodeApi();

// 监听来自 extension 的消息
onMessage((message) => {
  switch (message.type) {
    case 'releaseSubjectResult':
      if (message.payload?.subject) {
        releaseSubject.value = message.payload.subject;
      }
      break;
    case 'releaseSubjectSaved':
      console.log('发布主题已保存');
      break;
    case 'releaseNotesFileCheckResult':
      handleReleaseNotesFileCheckResult(message.payload);
      break;
    case 'releaseNotesGenerated':
      handleReleaseNotesGenerated(message.payload);
      break;
    case 'releaseNotesExported':
      handleReleaseNotesExported(message.payload);
      break;
    case 'releaseNotesSaved':
      handleReleaseNotesSaved(message.payload);
      break;
  }
});

const steps = ref<Step[]>([
  {
    id: 'pack',
    title: '打包工程代码资料',
    description: '将工程代码打包成可发布的压缩包',
    status: 'pending'
  },
  {
    id: 'release-notes',
    title: '整理发布说明内容',
    description: '编写和整理版本发布说明文档',
    status: 'pending'
  },
  {
    id: 'email',
    title: '邮件预编辑',
    description: '预编辑发送给相关人员的邮件内容',
    status: 'pending'
  }
]);

const isProcessing = ref(false);
const packStatus = ref<PackStatus>('idle');
const packProgress = ref(0);
const packError = ref('');
const packPreview = ref<PackPreview>({ fileCount: 0, totalSize: 0, folders: [] });
const packResult = ref<PackResult>({ zipPath: '', packedFiles: 0, skippedFiles: [] });

// 发布主题
const releaseSubject = ref('');

// 发布说明相关状态
const releaseNotesStatus = ref<ReleaseNotesStatus>('idle');
const releaseNotesError = ref('');
const generatedMarkdown = ref('');
const editedMarkdown = ref('');
const releaseNotesConfirmed = ref(false);
const exportResult = ref<ExportResult>({ show: false, success: false, message: '' });

// 当前日期（yyyyMMdd 格式）
const currentDate = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
});

// Markdown 渲染（简化版本）
const renderedMarkdown = computed(() => {
  if (!generatedMarkdown.value) return '';
  
  const content = releaseNotesStatus.value === 'editing' ? editedMarkdown.value : generatedMarkdown.value;
  
  // 简单的 Markdown 到 HTML 转换
  return content
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\n/gim, '<br>');
});

const emailPreview = ref({
  to: 'team@example.com',
  subject: '【发布通知】新版本已发布',
  body: '大家好，新版本已经发布，请查收...'
});

const currentStepIndex = computed(() => {
  return steps.value.findIndex(s => s.status === 'in-progress');
});

const currentStepData = computed(() => {
  const index = currentStepIndex.value;
  return index >= 0 ? steps.value[index] : null;
});

const allCompleted = computed(() => {
  return steps.value.every(s => s.status === 'completed');
});

function getStatusText(status: StepStatus): string {
  const statusMap: Record<StepStatus, string> = {
    'pending': '等待中',
    'in-progress': '进行中',
    'completed': '已完成'
  };
  return statusMap[status];
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getActionButtonText(): string {
  if (isProcessing.value) {
    return '处理中...';
  }
  if (allCompleted.value) {
    return '全部完成';
  }
  const currentIndex = steps.value.findIndex(s => s.status === 'in-progress');
  if (currentIndex >= 0) {
    return '完成当前步骤';
  }
  const nextPending = steps.value.findIndex(s => s.status === 'pending');
  if (nextPending >= 0) {
    return `开始: ${steps.value[nextPending].title}`;
  }
  return '开始发布';
}

async function startNextStep() {
  const currentIndex = steps.value.findIndex(s => s.status === 'in-progress');

  if (currentIndex >= 0) {
    isProcessing.value = true;

    // 完成当前步骤
    const completed = await completeCurrentStep(steps.value[currentIndex].id);

    if (completed) {
      steps.value[currentIndex].status = 'completed';
      steps.value[currentIndex].timestamp = new Date();

      // 启动下一步
      if (currentIndex < steps.value.length - 1) {
        steps.value[currentIndex + 1].status = 'in-progress';
        await startStep(steps.value[currentIndex + 1].id);
      }
    }

    isProcessing.value = false;
  } else {
    // 开始第一个待处理的步骤
    const pendingIndex = steps.value.findIndex(s => s.status === 'pending');
    if (pendingIndex >= 0) {
      // 检查是否是打包步骤，且是否填写了发布主题
      if (steps.value[pendingIndex].id === 'pack' && !releaseSubject.value.trim()) {
        packStatus.value = 'error';
        packError.value = '请先填写发布主题，再开始打包工程代码资料';
        return;
      }

      isProcessing.value = true;
      steps.value[pendingIndex].status = 'in-progress';
      await startStep(steps.value[pendingIndex].id);
      isProcessing.value = false;
    }
  }
}

async function completeCurrentStep(stepId: string): Promise<boolean> {
  switch (stepId) {
    case 'pack':
      return await completePackStep();
    case 'release-notes':
      return await completeReleaseNotesStep();
    case 'email':
      return await completeEmailStep();
    default:
      return true;
  }
}

async function startStep(stepId: string): Promise<void> {
  switch (stepId) {
    case 'pack':
      await startPackStep();
      break;
    case 'release-notes':
      await startReleaseNotesStep();
      break;
    case 'email':
      await startEmailStep();
      break;
  }
}

// ============ 打包步骤 ============

async function startPackStep(): Promise<void> {
  packStatus.value = 'checking';
  packProgress.value = 0;
  packError.value = '';
  packResult.value = { zipPath: '', packedFiles: 0, skippedFiles: [] };

  // 1. 检查前置条件
  vscode?.postMessage({ type: 'checkPackPrerequisites' });

  // 等待检查结果
  const prerequisitesResult = await waitForMessage('packPrerequisitesResult');

  if (!prerequisitesResult.payload.success) {
    packStatus.value = 'error';
    packError.value = prerequisitesResult.payload.error || '前置条件检查失败';
    return;
  }

  // 2. 获取打包预览
  packStatus.value = 'preparing';
  vscode?.postMessage({ type: 'getPackPreview' });

  const previewResult = await waitForMessage('packPreviewResult');
  packPreview.value = previewResult.payload;

  // 3. 开始打包
  packStatus.value = 'packing';
  // 如果有自定义主题，则使用主题作为文件名基础
  const fileName = releaseSubject.value.trim() || undefined;
  vscode?.postMessage({ type: 'startPack', payload: { fileName } });

  // 模拟进度更新
  const progressInterval = setInterval(() => {
    if (packProgress.value < 90) {
      packProgress.value += Math.random() * 10;
    }
  }, 300);

  // 等待打包完成（跳过 'started' 状态，只等待 'completed' 或 'error'）
  const packResult_msg = await waitForMessage('packProgress', (payload) => payload.status !== 'started');
  clearInterval(progressInterval);

  if (packResult_msg.payload.status === 'completed') {
    packStatus.value = 'completed';
    packProgress.value = 100;
    packResult.value = {
      zipPath: packResult_msg.payload.zipPath,
      packedFiles: packResult_msg.payload.packedFiles,
      skippedFiles: packResult_msg.payload.skippedFiles || []
    };
  } else {
    packStatus.value = 'error';
    packError.value = packResult_msg.payload.error || '打包失败';
  }
}

async function completePackStep(): Promise<boolean> {
  // 检查打包是否成功完成
  return packStatus.value === 'completed';
}

// ============ 发布说明步骤 ============

async function startReleaseNotesStep(): Promise<void> {
  // 重置状态
  releaseNotesStatus.value = 'checking';
  releaseNotesError.value = '';
  generatedMarkdown.value = '';
  editedMarkdown.value = '';
  releaseNotesConfirmed.value = false;
  exportResult.value = { show: false, success: false, message: '' };

  // 1. 检查发布说明文件是否存在
  vscode?.postMessage({ type: 'checkReleaseNotesFile' });
}

// 处理文件检查结果
function handleReleaseNotesFileCheckResult(payload: any) {
  if (!payload.exists) {
    releaseNotesStatus.value = 'error';
    releaseNotesError.value = payload.error || '发布说明文件不存在';
    return;
  }

  // 文件存在，开始生成文档
  releaseNotesStatus.value = 'generating';
  vscode?.postMessage({ 
    type: 'generateReleaseNotes',
    payload: { releaseSubject: releaseSubject.value }
  });
}

// 处理文档生成结果
function handleReleaseNotesGenerated(payload: any) {
  if (!payload.success) {
    releaseNotesStatus.value = 'error';
    releaseNotesError.value = payload.error || '生成发布说明文档失败';
    return;
  }

  generatedMarkdown.value = payload.markdown || '';
  editedMarkdown.value = payload.markdown || '';
  releaseNotesStatus.value = 'preview';
}

// 切换编辑/预览模式
function toggleEditMode() {
  if (releaseNotesStatus.value === 'editing') {
    // 保存编辑内容并切换到预览
    generatedMarkdown.value = editedMarkdown.value;
    releaseNotesStatus.value = 'preview';
  } else {
    // 切换到编辑模式
    editedMarkdown.value = generatedMarkdown.value;
    releaseNotesStatus.value = 'editing';
  }
}

// 导出 Markdown
function exportMarkdown() {
  const content = releaseNotesStatus.value === 'editing' ? editedMarkdown.value : generatedMarkdown.value;
  vscode?.postMessage({
    type: 'exportReleaseNotesMarkdown',
    payload: { content, releaseSubject: releaseSubject.value }
  });
}

// 处理导出结果
function handleReleaseNotesExported(payload: any) {
  exportResult.value = {
    show: true,
    success: payload.success,
    message: payload.success
      ? '导出 Markdown 成功！' 
      : `导出失败: ${payload.error}`,
    filePath: payload.filePath
  };

  // 3秒后隐藏导出结果
  setTimeout(() => {
    exportResult.value.show = false;
  }, 5000);
}

// 保存编辑后的内容
function saveEditedReleaseNotes() {
  const content = editedMarkdown.value;
  vscode?.postMessage({
    type: 'saveEditedReleaseNotes',
    payload: { content }
  });
}

// 处理保存结果
function handleReleaseNotesSaved(payload: any) {
  if (payload.success) {
    console.log('发布说明已保存');
  } else {
    console.error('保存失败:', payload.error);
  }
}

async function completeReleaseNotesStep(): Promise<boolean> {
  // 如果有编辑内容，先保存
  if (releaseNotesStatus.value === 'editing') {
    saveEditedReleaseNotes();
  }

  // 检查用户是否已确认
  if (!releaseNotesConfirmed.value) {
    // 显示提示，要求用户确认
    exportResult.value = {
      show: true,
      success: false,
      message: '请先确认发布说明内容正确无误（勾选确认框）'
    };
    setTimeout(() => {
      exportResult.value.show = false;
    }, 3000);
    return false;
  }

  // 检查是否有生成内容
  return generatedMarkdown.value.length > 0;
}

// ============ 邮件步骤 ============

async function startEmailStep(): Promise<void> {
  // 模拟从后端获取邮件预览数据
  await new Promise(resolve => setTimeout(resolve, 800));
}

async function completeEmailStep(): Promise<boolean> {
  // 邮件步骤总是可以完成
  return true;
}

// ============ 工具函数 ============

function waitForMessage(expectedType: string, filter?: (payload: any) => boolean): Promise<any> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === expectedType) {
        // 如果有过滤器，检查 payload 是否满足条件
        if (filter && !filter(message.payload)) {
          return; // 不满足条件，继续等待
        }
        window.removeEventListener('message', handler);
        resolve(message);
      }
    };
    window.addEventListener('message', handler);
  });
}

function saveSubject() {
  // 保存发布主题到后端
  vscode?.postMessage({
    type: 'saveReleaseSubject',
    payload: { subject: releaseSubject.value.trim() }
  });
}

function cancelTimeline() {
  // 清除打包缓存
  vscode?.postMessage({ type: 'clearPackCache' });

  // 重置所有状态
  steps.value.forEach(step => {
    step.status = 'pending';
    step.timestamp = undefined;
  });

  packStatus.value = 'idle';
  packProgress.value = 0;
  packError.value = '';
  packResult.value = { zipPath: '', packedFiles: 0, skippedFiles: [] };
  
  // 重置发布说明状态
  releaseNotesStatus.value = 'idle';
  releaseNotesError.value = '';
  generatedMarkdown.value = '';
  editedMarkdown.value = '';
  releaseNotesConfirmed.value = false;
}

onMounted(() => {
  // 从后端获取状态
  vscode?.postMessage({ type: 'getPublishTimelineStatus' });

  // 检查是否有缓存的 zip
  vscode?.postMessage({ type: 'getCachedZipPath' });

  // 加载保存的发布主题
  vscode?.postMessage({ type: 'getReleaseSubject' });
});
</script>

<style scoped>
.timeline-container {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.release-subject-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 8px;
  border: 1px solid var(--vscode-panel-border);
}

.subject-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--vscode-foreground);
  margin-bottom: 8px;
}

.subject-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.subject-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.subject-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.subject-hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 32px;
  color: var(--vscode-foreground);
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  gap: 16px;
  padding: 16px 0;
  position: relative;
}

.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.marker-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
  z-index: 1;
}

.timeline-item.completed .marker-circle {
  background: var(--vscode-testing-iconPassed);
  color: white;
}

.timeline-item.in-progress .marker-circle {
  background: var(--vscode-progressBar-background);
  color: white;
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: var(--vscode-badge-background);
  margin-top: 8px;
  min-height: 60px;
  transition: all 0.3s ease;
}

.timeline-line.active {
  background: var(--vscode-testing-iconPassed);
}

.timeline-content {
  flex: 1;
  padding-top: 8px;
}

.step-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--vscode-foreground);
}

.step-description {
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.step-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.pending {
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
}

.status-badge.in-progress {
  background: var(--vscode-progressBar-background);
  color: white;
}

.status-badge.completed {
  background: var(--vscode-testing-iconPassed);
  color: white;
}

.timestamp {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.check-icon {
  width: 20px;
  height: 20px;
}

.loading-icon {
  width: 20px;
  height: 20px;
}

.action-bar {
  display: flex;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--vscode-panel-border);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.btn-primary:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.btn-secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground);
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.step-detail-panel {
  margin-top: 32px;
  padding: 24px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 8px;
  border: 1px solid var(--vscode-panel-border);
}

.step-detail-panel h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--vscode-foreground);
}

.detail-content {
  font-size: 14px;
  color: var(--vscode-foreground);
}

.pack-status {
  padding: 16px;
}

.pack-status.error {
  color: var(--vscode-errorForeground);
}

.error-text {
  color: var(--vscode-errorForeground);
  font-weight: 500;
}

.success-text {
  color: var(--vscode-testing-iconPassed);
  font-weight: 500;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--vscode-progressBar-background);
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0;
}

.progress-fill {
  height: 100%;
  background: var(--vscode-progressBar-foreground);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.indeterminate {
  width: 30%;
  animation: indeterminate 1s infinite linear;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.progress-text {
  text-align: center;
  font-size: 14px;
  color: var(--vscode-foreground);
}

.pack-preview {
  margin-top: 16px;
  padding: 16px;
  background: var(--vscode-editor-background);
  border-radius: 4px;
}

.pack-preview p {
  margin: 8px 0;
}

.pack-result {
  margin-top: 16px;
  padding: 16px;
  background: var(--vscode-editor-background);
  border-radius: 4px;
  border-left: 4px solid var(--vscode-testing-iconPassed);
}

.zip-path {
  font-family: monospace;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  word-break: break-all;
}

.pack-stats {
  font-size: 13px;
  color: var(--vscode-foreground);
}

/* 发布说明样式 */
.release-notes-detail {
  padding: 16px 0;
}

.status-message {
  padding: 24px;
  text-align: center;
  color: var(--vscode-foreground);
}

.status-message.error {
  color: var(--vscode-errorForeground);
}

.status-message .hint-text {
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
  margin-top: 8px;
}

.release-notes-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.editor-container {
  flex: 1;
}

.markdown-editor {
  width: 100%;
  min-height: 400px;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  resize: vertical;
  box-sizing: border-box;
}

.markdown-editor:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.preview-container {
  flex: 1;
  max-height: 500px;
  overflow-y: auto;
}

.markdown-preview {
  padding: 24px;
  background: var(--vscode-editor-background);
  border-radius: 4px;
  line-height: 1.6;
}

.markdown-preview :deep(h1) {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--vscode-panel-border);
  color: var(--vscode-foreground);
}

.markdown-preview :deep(h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 12px 0;
  color: var(--vscode-foreground);
}

.markdown-preview :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 16px 0 8px 0;
  color: var(--vscode-foreground);
}

.markdown-preview :deep(blockquote) {
  margin: 16px 0;
  padding: 12px 16px;
  border-left: 4px solid var(--vscode-textBlockQuote-border);
  background: var(--vscode-textBlockQuote-background);
  color: var(--vscode-foreground);
}

.markdown-preview :deep(code) {
  padding: 2px 6px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
}

.markdown-preview :deep(strong) {
  font-weight: 600;
  color: var(--vscode-foreground);
}

.markdown-preview :deep(em) {
  font-style: italic;
  color: var(--vscode-foreground);
}

.markdown-preview :deep(li) {
  margin: 8px 0;
  padding-left: 8px;
}

.confirmation-area {
  padding: 16px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border);
}

.confirm-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--vscode-foreground);
}

.confirm-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.export-result {
  padding: 12px 16px;
  border-radius: 4px;
  font-size: 13px;
}

.export-result.success {
  background: var(--vscode-testing-iconPassed);
  color: white;
}

.export-result.error {
  background: var(--vscode-errorForeground);
  color: white;
}

.export-result .file-path {
  margin-top: 8px;
  font-family: monospace;
  font-size: 11px;
  opacity: 0.9;
}

.email-detail {
  padding: 16px;
}

.email-preview {
  margin-top: 16px;
  padding: 16px;
  background: var(--vscode-editor-background);
  border-radius: 4px;
}

.email-field {
  margin: 8px 0;
  line-height: 1.5;
}
</style>