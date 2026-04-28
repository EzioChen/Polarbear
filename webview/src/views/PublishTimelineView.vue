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
          <p>正在整理发布说明内容...</p>
          <ul class="check-list">
            <li v-for="item in releaseNotesItems" :key="item.id" :class="{ checked: item.checked }">
              {{ item.text }}
            </li>
          </ul>
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

const { vscode, onMessage } = useVscodeApi();

// 监听来自 extension 的消息
onMessage((message) => {
  switch (message.type) {
    case 'releaseSubjectResult':
      // 加载保存的发布主题
      if (message.payload?.subject) {
        releaseSubject.value = message.payload.subject;
      }
      break;
    case 'releaseSubjectSaved':
      console.log('发布主题已保存');
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

// 当前日期（yyyyMMdd 格式）
const currentDate = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
});

const releaseNotesItems = ref([
  { id: '1', text: '版本号确认', checked: false },
  { id: '2', text: '更新日志整理', checked: false },
  { id: '3', text: 'SDK 版本信息', checked: false },
  { id: '4', text: '芯片支持范围', checked: false }
]);

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
        // 显示错误提示
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
  // 重置检查项
  releaseNotesItems.value.forEach(item => item.checked = false);

  // 模拟检查过程
  for (let i = 0; i < releaseNotesItems.value.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    releaseNotesItems.value[i].checked = true;
  }
}

async function completeReleaseNotesStep(): Promise<boolean> {
  // 检查所有项是否都已勾选
  return releaseNotesItems.value.every(item => item.checked);
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
  releaseNotesItems.value.forEach(item => item.checked = false);
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

.btn-secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.step-detail-panel {
  margin-top: 24px;
  padding: 20px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
}

.step-detail-panel h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--vscode-foreground);
}

.pack-detail {
  color: var(--vscode-foreground);
}

.pack-status {
  margin-bottom: 16px;
}

.pack-status.error {
  color: var(--vscode-errorForeground);
}

.pack-preview {
  background: var(--vscode-editor-inactiveSelectionBackground);
  padding: 12px;
  border-radius: 4px;
  margin-top: 12px;
}

.pack-preview p {
  margin: 4px 0;
  font-size: 13px;
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
  background: var(--vscode-testing-iconPassed);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
  margin: 8px 0 0 0;
}

.pack-result {
  margin-top: 16px;
  padding: 12px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 4px;
}

.success-text {
  color: var(--vscode-testing-iconPassed);
  font-weight: 600;
  margin: 0 0 8px 0;
}

.error-text {
  color: var(--vscode-errorForeground);
  margin: 0;
}

.zip-path {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin: 4px 0;
  word-break: break-all;
}

.pack-stats {
  font-size: 13px;
  color: var(--vscode-foreground);
  margin: 8px 0 0 0;
}

.check-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.check-list li {
  padding: 8px 0;
  padding-left: 28px;
  position: relative;
  color: var(--vscode-foreground);
  transition: all 0.3s ease;
}

.check-list li::before {
  content: '○';
  position: absolute;
  left: 0;
  color: var(--vscode-descriptionForeground);
}

.check-list li.checked::before {
  content: '✓';
  color: var(--vscode-testing-iconPassed);
}

.check-list li.checked {
  color: var(--vscode-descriptionForeground);
  text-decoration: line-through;
}

.email-preview {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 16px;
}

.email-field {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--vscode-foreground);
}

.email-field:last-child {
  margin-bottom: 0;
}

.email-field strong {
  color: var(--vscode-descriptionForeground);
  margin-right: 8px;
}
</style>
