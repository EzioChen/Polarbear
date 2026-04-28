<template>
  <div class="email-editor" :class="{ 'fullscreen': isFullscreen }">
    <!-- 标题栏 -->
    <div class="editor-titlebar">
      <h2>✉️ 邮件编辑器</h2>
      <div class="titlebar-actions">
        <button class="btn-icon" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏编辑'">
          {{ isFullscreen ? '⛶' : '⛶' }}
        </button>
        <button class="btn-icon" @click="openConfig" title="配置">⚙️</button>
      </div>
    </div>

    <!-- 头部信息区 -->
    <div class="header-section">
      <div class="form-row">
        <label>收件人:</label>
        <input
          type="text"
          v-model="form.to"
          placeholder="user1@example.com; user2@example.com"
          class="form-input"
        />
      </div>

      <div class="form-row">
        <label>抄送:</label>
        <input
          type="text"
          v-model="form.cc"
          placeholder="cc@example.com"
          class="form-input"
        />
      </div>

      <div class="form-row">
        <label>主题:</label>
        <input
          type="text"
          v-model="form.subject"
          placeholder="发布通知 - v1.0.0"
          class="form-input"
        />
      </div>
    </div>

    <!-- 内容编辑区 - 左右分屏 -->
    <div class="content-section" :class="{ 'editor-fullscreen': isEditorFullscreen }">
      <div class="editor-pane">
        <div class="pane-header">
          <span>内容编辑</span>
          <button class="btn-fullscreen" @click="toggleEditorFullscreen" :title="isEditorFullscreen ? '退出全屏' : '全屏编辑'">
            {{ isEditorFullscreen ? '⛶' : '⛶' }}
          </button>
        </div>
        
        <!-- 富文本工具栏 -->
        <div class="toolbar">
          <!-- 文本样式 -->
          <div class="toolbar-group">
            <button class="toolbar-btn" @click="insertFormat('bold')" title="加粗 (Ctrl+B)">
              <strong>B</strong>
            </button>
            <button class="toolbar-btn" @click="insertFormat('italic')" title="斜体 (Ctrl+I)">
              <em>I</em>
            </button>
            <button class="toolbar-btn" @click="insertFormat('strikethrough')" title="删除线">
              <s>S</s>
            </button>
          </div>
          
          <div class="toolbar-divider"></div>
          
          <!-- 标题 -->
          <div class="toolbar-group">
            <button class="toolbar-btn" @click="insertFormat('h1')" title="标题 1">H1</button>
            <button class="toolbar-btn" @click="insertFormat('h2')" title="标题 2">H2</button>
            <button class="toolbar-btn" @click="insertFormat('h3')" title="标题 3">H3</button>
          </div>
          
          <div class="toolbar-divider"></div>
          
          <!-- 列表 -->
          <div class="toolbar-group">
            <button class="toolbar-btn" @click="insertFormat('ul')" title="无序列表">
              ☰
            </button>
            <button class="toolbar-btn" @click="insertFormat('ol')" title="有序列表">
              1.
            </button>
            <button class="toolbar-btn" @click="insertFormat('task')" title="任务列表">
              ☑
            </button>
          </div>
          
          <div class="toolbar-divider"></div>
          
          <!-- 插入 -->
          <div class="toolbar-group">
            <button class="toolbar-btn" @click="insertFormat('link')" title="链接">
              🔗
            </button>
            <button class="toolbar-btn" @click="insertFormat('image')" title="图片">
              🖼️
            </button>
            <button class="toolbar-btn" @click="insertFormat('code')" title="代码">
              &lt;/&gt;
            </button>
            <button class="toolbar-btn" @click="insertFormat('codeblock')" title="代码块">
              📋
            </button>
            <button class="toolbar-btn" @click="insertFormat('table')" title="表格">
              ⊞
            </button>
            <button class="toolbar-btn" @click="insertFormat('quote')" title="引用">
              ❝
            </button>
            <button class="toolbar-btn" @click="insertFormat('divider')" title="分割线">
              ─
            </button>
          </div>
        </div>
        
        <textarea
          ref="textareaRef"
          v-model="form.markdown"
          placeholder="输入邮件内容（支持 Markdown）"
          class="markdown-textarea"
          spellcheck="false"
        />
      </div>

      <div class="preview-pane">
        <div class="pane-header">
          <span>预览</span>
        </div>
        <div class="preview-content" v-html="renderedMarkdown" />
      </div>
    </div>

    <!-- 附件区 -->
    <div class="attachment-section">
      <div class="attachment-header">
        <span class="attachment-label">附件:</span>
        <button class="btn-attachment" @click="addAttachment">
          📎 添加附件
        </button>
      </div>
      <div v-if="attachments.length > 0" class="attachment-list">
        <div
          v-for="att in attachments"
          :key="att.id"
          class="attachment-item"
        >
          <span class="attachment-icon">📎</span>
          <span class="attachment-name">{{ att.filename }}</span>
          <span class="attachment-size">({{ formatFileSize(att.size) }})</span>
          <button class="btn-remove" @click="removeAttachment(att.id)">✕</button>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="footer-actions">
      <button class="btn-primary" @click="sendEmail" :disabled="!canSend">
        📤 发送邮件
      </button>
      <button class="btn-secondary" @click="saveDraft">
        💾 保存草稿
      </button>
      <button class="btn-secondary" @click="closeEditor">
        取消
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useVscodeApi } from '../composables/useVscodeApi';

const vscode = useVscodeApi();
const textareaRef = ref<HTMLTextAreaElement | null>(null);

interface Attachment {
  id: string;
  filename: string;
  path: string;
  size: number;
  contentType: string;
}

const isFullscreen = ref(false);
const isEditorFullscreen = ref(false);

const form = ref({
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  markdown: '',
});

const attachments = ref<Attachment[]>([]);

const canSend = computed(() => {
  return form.value.to.trim() && form.value.subject.trim() && form.value.markdown.trim();
});

// 获取 textarea 的选中范围
function getSelection() {
  const textarea = textareaRef.value;
  if (!textarea) return { start: 0, end: 0, text: '' };
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = form.value.markdown.substring(start, end);
  
  return { start, end, text };
}

// 在指定位置插入文本
function insertText(before: string, after: string = '', placeholder: string = '') {
  const textarea = textareaRef.value;
  if (!textarea) return;
  
  const { start, end, text } = getSelection();
  const selectedText = text || placeholder;
  const newText = form.value.markdown.substring(0, start) + before + selectedText + after + form.value.markdown.substring(end);
  
  form.value.markdown = newText;
  
  // 恢复焦点并设置光标位置
  setTimeout(() => {
    textarea.focus();
    const newCursorPos = start + before.length + selectedText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
}

// 格式化插入
function insertFormat(type: string) {
  switch (type) {
    case 'bold':
      insertText('**', '**', '粗体文本');
      break;
    case 'italic':
      insertText('*', '*', '斜体文本');
      break;
    case 'strikethrough':
      insertText('~~', '~~', '删除线文本');
      break;
    case 'h1':
      insertText('# ', '', '标题 1');
      break;
    case 'h2':
      insertText('## ', '', '标题 2');
      break;
    case 'h3':
      insertText('### ', '', '标题 3');
      break;
    case 'ul':
      insertText('- ', '', '列表项');
      break;
    case 'ol':
      insertText('1. ', '', '列表项');
      break;
    case 'task':
      insertText('- [ ] ', '', '任务项');
      break;
    case 'link':
      insertText('[', '](https://example.com)', '链接文本');
      break;
    case 'image':
      insertText('![', '](https://example.com/image.png)', '图片描述');
      break;
    case 'code':
      insertText('`', '`', '代码');
      break;
    case 'codeblock':
      insertText('```typescript\n', '\n```', '// 代码块');
      break;
    case 'table':
      insertText('| 列1 | 列2 | 列3 |\n|------|------|------|\n| 内容1 | 内容2 | 内容3 |\n', '', '');
      break;
    case 'quote':
      insertText('> ', '', '引用文本');
      break;
    case 'divider':
      insertText('\n---\n', '', '');
      break;
  }
}

const renderedMarkdown = computed(() => {
  let html = form.value.markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 删除线
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');

  // 粗体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 斜体
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;">');

  // 标题
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 无序列表
  html = html.replace(/^- \[ \] (.*$)/gim, '<li><input type="checkbox" disabled> $1</li>');
  html = html.replace(/^- \[x\] (.*$)/gim, '<li><input type="checkbox" checked disabled> $1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  
  // 有序列表
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

  // 引用
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 分割线
  html = html.replace(/^---$/gim, '<hr>');

  // 换行
  html = html.replace(/\n/g, '<br>');

  return html;
});

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

function toggleEditorFullscreen() {
  isEditorFullscreen.value = !isEditorFullscreen.value;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function sendEmail() {
  vscode.postMessage({
    type: 'sendEmail',
    data: {
      to: form.value.to,
      cc: form.value.cc,
      bcc: form.value.bcc,
      subject: form.value.subject,
      markdown: form.value.markdown,
    },
  });
}

function saveDraft() {
  vscode.postMessage({
    type: 'saveDraft',
    data: {
      to: form.value.to,
      cc: form.value.cc,
      bcc: form.value.bcc,
      subject: form.value.subject,
      markdown: form.value.markdown,
    },
  });
}

function closeEditor() {
  vscode.postMessage({ type: 'closeEditor' });
}

function openConfig() {
  vscode.postMessage({ type: 'openConfig' });
}

function addAttachment() {
  vscode.postMessage({ type: 'addAttachment' });
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter(a => a.id !== id);
  vscode.postMessage({
    type: 'removeAttachment',
    data: { id },
  });
}

// 监听来自扩展的消息
window.addEventListener('message', (event) => {
  const message = event.data;

  switch (message.type) {
    case 'loadDraft':
      if (message.data) {
        form.value.to = message.data.to || '';
        form.value.cc = message.data.cc || '';
        form.value.bcc = message.data.bcc || '';
        form.value.subject = message.data.subject || '';
        form.value.markdown = message.data.markdown || '';
        attachments.value = message.data.attachments || [];
      }
      break;
    case 'configLoaded':
      // 加载默认收件人和抄送人
      if (message.data) {
        const defaultTo: Array<{ name?: string; email: string }> = message.data.defaultTo || [];
        const defaultCc: Array<{ name?: string; email: string }> = message.data.defaultCc || [];
        
        // 只有在表单为空时才填充默认值
        if (!form.value.to && defaultTo.length > 0) {
          form.value.to = defaultTo.map(c => c.email).join(';');
        }
        if (!form.value.cc && defaultCc.length > 0) {
          form.value.cc = defaultCc.map(c => c.email).join(';');
        }
      }
      break;
    case 'attachmentsUpdated':
      attachments.value = message.data?.attachments || [];
      break;
    case 'draftSaved':
      // 草稿保存成功提示
      break;
  }
});

onMounted(() => {
  // 页面加载完成后请求检查草稿
  vscode.postMessage({ type: 'editorReady' });
});
</script>

<style scoped>
/* 基础容器 */
.email-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  overflow: hidden;
}

/* 全屏模式 */
.email-editor.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background-color: var(--vscode-editor-background);
}

/* 标题栏 */
.editor-titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--vscode-titleBar-activeBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
  flex-shrink: 0;
}

.editor-titlebar h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--vscode-titleBar-activeForeground);
}

.titlebar-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background-color: transparent;
  color: var(--vscode-titleBar-activeForeground);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.btn-icon:hover {
  background-color: var(--vscode-toolbar-hoverBackground);
}

/* 头部信息区 */
.header-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
  background-color: var(--vscode-sideBar-background);
  flex-shrink: 0;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-row label {
  width: 60px;
  font-size: 13px;
  color: var(--vscode-foreground);
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--vscode-input-border);
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

/* 内容编辑区 - 左右分屏 */
.content-section {
  display: flex;
  flex: 1;
  min-height: 0;
  border-bottom: 1px solid var(--vscode-panel-border);
}

/* 编辑器全屏模式 */
.content-section.editor-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background-color: var(--vscode-editor-background);
}

.content-section.editor-fullscreen .editor-pane {
  flex: 1;
  border-right: none;
}

.content-section.editor-fullscreen .preview-pane {
  display: none;
}

.editor-pane,
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.editor-pane {
  border-right: 1px solid var(--vscode-panel-border);
}

.pane-header {
  padding: 8px 12px;
  background-color: var(--vscode-tab-inactiveBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-tab-inactiveForeground);
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-fullscreen {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 3px;
  background-color: transparent;
  color: var(--vscode-tab-inactiveForeground);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}

.btn-fullscreen:hover {
  background-color: var(--vscode-toolbar-hoverBackground);
}

/* 富文本工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background-color: var(--vscode-editor-inactiveSelectionBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background-color: var(--vscode-panel-border);
  margin: 0 4px;
}

.toolbar-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  background-color: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  min-width: 28px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-btn:hover {
  background-color: var(--vscode-toolbar-hoverBackground);
}

.toolbar-btn:active {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.markdown-textarea {
  flex: 1;
  padding: 12px;
  border: none;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-size: 14px;
  font-family: var(--vscode-editor-font-family);
  line-height: 1.6;
  resize: none;
  outline: none;
}

.preview-content {
  flex: 1;
  padding: 12px;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-size: 14px;
  line-height: 1.6;
  overflow-y: auto;
}

.preview-content :deep(h1) {
  font-size: 20px;
  margin: 16px 0 8px;
  color: var(--vscode-editor-foreground);
  border-bottom: 1px solid var(--vscode-panel-border);
  padding-bottom: 8px;
}

.preview-content :deep(h2) {
  font-size: 18px;
  margin: 14px 0 7px;
  color: var(--vscode-editor-foreground);
}

.preview-content :deep(h3) {
  font-size: 16px;
  margin: 12px 0 6px;
  color: var(--vscode-editor-foreground);
}

.preview-content :deep(code) {
  background-color: var(--vscode-textCodeBlock-background);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: var(--vscode-editor-font-family);
}

.preview-content :deep(pre) {
  background-color: var(--vscode-textCodeBlock-background);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

.preview-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.preview-content :deep(a) {
  color: var(--vscode-textLink-foreground);
}

.preview-content :deep(strong) {
  font-weight: 600;
}

.preview-content :deep(em) {
  font-style: italic;
}

.preview-content :deep(s) {
  text-decoration: line-through;
}

.preview-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.preview-content :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 4px solid var(--vscode-panel-border);
  background-color: var(--vscode-editor-inactiveSelectionBackground);
  color: var(--vscode-descriptionForeground);
}

.preview-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--vscode-panel-border);
  margin: 16px 0;
}

.preview-content :deep(li) {
  margin: 4px 0;
}

.preview-content :deep(li input[type="checkbox"]) {
  margin-right: 8px;
}

/* 附件区 */
.attachment-section {
  padding: 12px 16px;
  background-color: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  flex-shrink: 0;
}

.attachment-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.attachment-label {
  font-size: 13px;
  color: var(--vscode-foreground);
}

.btn-attachment {
  padding: 4px 10px;
  border: 1px solid var(--vscode-button-secondaryBackground);
  border-radius: 4px;
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  cursor: pointer;
  font-size: 12px;
}

.btn-attachment:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: var(--vscode-list-hoverBackground);
  border-radius: 4px;
  font-size: 12px;
}

.attachment-icon {
  font-size: 12px;
}

.attachment-name {
  color: var(--vscode-foreground);
}

.attachment-size {
  color: var(--vscode-descriptionForeground);
}

.btn-remove {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 3px;
  background-color: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}

.btn-remove:hover {
  background-color: var(--vscode-errorForeground);
  color: white;
}

/* 底部操作栏 */
.footer-actions {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--vscode-sideBar-background);
  flex-shrink: 0;
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--vscode-button-hoverBackground);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  cursor: pointer;
  font-size: 13px;
}

.btn-secondary:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}
</style>
