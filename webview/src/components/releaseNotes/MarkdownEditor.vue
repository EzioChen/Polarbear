<template>
  <div class="markdown-editor" :class="{ fullscreen: isFullscreen }">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-group">
        <button @click="insertText('**', '**')" title="粗体">
          <span class="icon-bold">B</span>
        </button>
        <button @click="insertText('*', '*')" title="斜体">
          <span class="icon-italic">I</span>
        </button>
      </div>
      <div class="toolbar-group">
        <button @click="insertText('# ', '')" title="标题1">H1</button>
        <button @click="insertText('## ', '')" title="标题2">H2</button>
        <button @click="insertText('### ', '')" title="标题3">H3</button>
      </div>
      <div class="toolbar-group">
        <button @click="insertText('- ', '')" title="无序列表">• 列表</button>
        <button @click="insertText('1. ', '')" title="有序列表">1. 列表</button>
      </div>
      <div class="toolbar-group">
        <button @click="insertText('```\n', '\n```')" title="代码块">代码块</button>
        <button @click="insertText('[', '](url)')" title="链接">链接</button>
      </div>
      <div class="toolbar-group right">
        <button @click="toggleFullscreen" title="全屏">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </button>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="editor-container">
      <div class="editor-pane" :style="{ width: showPreview ? '50%' : '100%' }">
        <textarea
          ref="textareaRef"
          v-model="localValue"
          class="editor-textarea"
          placeholder="请输入 Markdown 格式的发布说明..."
          @keydown="handleKeydown"
        />
      </div>
      <div v-if="showPreview" class="preview-pane">
        <div class="preview-content" v-html="renderedHtml" />
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="editor-statusbar">
      <span>{{ lineCount }} 行</span>
      <span>{{ charCount }} 字符</span>
      <button @click="togglePreview">
        {{ showPreview ? '隐藏预览' : '显示预览' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { marked } from 'marked';

const props = defineProps<{
  modelValue: string;
  preview?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const localValue = ref(props.modelValue);
const textareaRef = ref<HTMLTextAreaElement>();
const isFullscreen = ref(false);
const showPreview = ref(props.preview ?? true);

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
} as any);

// 渲染 HTML
const renderedHtml = computed(() => {
  return marked.parse(localValue.value || '') as string;
});

const lineCount = computed(() => localValue.value.split('\n').length);
const charCount = computed(() => localValue.value.length);

watch(() => props.modelValue, (newVal) => {
  if (newVal !== localValue.value) {
    localValue.value = newVal;
  }
});

watch(localValue, (newVal) => {
  emit('update:modelValue', newVal);
});

const insertText = (before: string, after: string) => {
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = localValue.value.substring(start, end);
  const newText = before + selectedText + after;

  localValue.value =
    localValue.value.substring(0, start) +
    newText +
    localValue.value.substring(end);

  nextTick(() => {
    const newCursorPos = start + before.length + selectedText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
  });
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    insertText('  ', '');
  }
};

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

const togglePreview = () => {
  showPreview.value = !showPreview.value;
};
</script>

<style scoped>
.markdown-editor {
  display: flex;
  flex-direction: column;
  height: 400px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  overflow: hidden;
}

.markdown-editor.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  height: 100vh;
  background: var(--vscode-editor-background);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 8px;
  background: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  gap: 16px;
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.toolbar-group.right {
  margin-left: auto;
}

.editor-toolbar button {
  padding: 4px 8px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.editor-toolbar button:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.editor-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-pane {
  display: flex;
  flex-direction: column;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  padding: 12px;
  border: none;
  outline: none;
  resize: none;
  font-family: var(--vscode-editor-font-family);
  font-size: 14px;
  line-height: 1.6;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
}

.preview-pane {
  flex: 1;
  border-left: 1px solid var(--vscode-panel-border);
  overflow: auto;
}

.preview-content {
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.preview-content :deep(h1),
.preview-content :deep(h2),
.preview-content :deep(h3) {
  margin-top: 16px;
  margin-bottom: 8px;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
  padding-left: 24px;
}

.preview-content :deep(code) {
  background: var(--vscode-textCodeBlock-background);
  padding: 2px 4px;
  border-radius: 3px;
}

.preview-content :deep(pre) {
  background: var(--vscode-textCodeBlock-background);
  padding: 12px;
  border-radius: 4px;
  overflow: auto;
}

.editor-statusbar {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: var(--vscode-statusBar-background);
  color: var(--vscode-statusBar-foreground);
  font-size: 12px;
  gap: 16px;
}

.editor-statusbar button {
  margin-left: auto;
  padding: 2px 8px;
  background: transparent;
  border: 1px solid var(--vscode-button-border);
  color: var(--vscode-button-foreground);
  cursor: pointer;
}
</style>
