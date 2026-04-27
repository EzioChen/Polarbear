# 第二步：Markdown编辑器组件

## 目标
实现支持 Markdown 语法的编辑器组件，包含分栏编辑/预览、工具栏、语法高亮等功能。

## 预计时间
3-4 小时

## 负责人
前端开发工程师

---

## 1. 安装依赖

### 1.1 安装 Markdown 解析和编辑器依赖

```bash
cd /Volumes/O/AGit/Extension/polarbear/webview
npm install marked highlight.js
npm install -D @types/marked
```

### 验证步骤 1.1
```bash
npm list marked highlight.js
```

**预期输出**:
```
├── marked@x.x.x
└── highlight.js@x.x.x
```

---

## 2. 创建 Markdown 编辑器组件

### 2.1 创建文件 `webview/src/components/releaseNotes/MarkdownEditor.vue`

```vue
<template>
  <div class="markdown-editor" :class="{ 'fullscreen': isFullscreen }">
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
      <!-- 左侧编辑区 -->
      <div class="editor-pane" :style="{ width: showPreview ? '50%' : '100%' }">
        <textarea
          ref="textareaRef"
          v-model="localValue"
          class="editor-textarea"
          placeholder="请输入 Markdown 格式的发布说明..."
          @keydown="handleKeydown"
        />
      </div>

      <!-- 右侧预览区 -->
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
import hljs from 'highlight.js';

const props = defineProps<{
  modelValue: string;
  preview?: boolean;
  toolbar?: boolean;
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
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

// 渲染 HTML
const renderedHtml = computed(() => {
  return marked(localValue.value || '');
});

// 行数统计
const lineCount = computed(() => {
  return localValue.value.split('\n').length;
});

// 字符统计
const charCount = computed(() => {
  return localValue.value.length;
});

// 监听外部值变化
watch(() => props.modelValue, (newVal) => {
  if (newVal !== localValue.value) {
    localValue.value = newVal;
  }
});

// 监听本地值变化，触发更新
watch(localValue, (newVal) => {
  emit('update:modelValue', newVal);
});

// 插入文本
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

  // 恢复光标位置
  nextTick(() => {
    const newCursorPos = start + before.length + selectedText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
  });
};

// 处理键盘事件
const handleKeydown = (e: KeyboardEvent) => {
  // Tab 键插入空格
  if (e.key === 'Tab') {
    e.preventDefault();
    insertText('  ', '');
  }
};

// 切换全屏
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

// 切换预览
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
```

### 验证步骤 2.1
```bash
# 检查 TypeScript 编译
cd webview && npx vue-tsc --noEmit src/components/releaseNotes/MarkdownEditor.vue
```

**预期结果**: 无错误输出

---

## 3. 创建版本等级选择器组件

### 3.1 创建文件 `webview/src/components/releaseNotes/VersionLevelSelector.vue`

```vue
<template>
  <div class="version-level-selector">
    <div
      v-for="option in options"
      :key="option.level"
      class="level-card"
      :class="{ active: modelValue === option.level }"
      @click="selectLevel(option.level)"
    >
      <div class="level-badge" :class="`level-${option.level.toLowerCase()}`">
        {{ option.level }}
      </div>
      <div class="level-name">{{ option.name }}</div>
      <div class="level-desc">{{ option.description }}</div>
      <div class="level-tag" :class="{ required: option.required }">
        {{ option.required ? '必须修复' : '可选修复' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VersionLevel, VersionLevelInfo } from '../../types/releaseNotes';

const props = defineProps<{
  modelValue: VersionLevel;
  options: VersionLevelInfo[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: VersionLevel];
}>();

const selectLevel = (level: VersionLevel) => {
  emit('update:modelValue', level);
};
</script>

<style scoped>
.version-level-selector {
  display: flex;
  gap: 12px;
}

.level-card {
  flex: 1;
  padding: 16px;
  border: 2px solid var(--vscode-panel-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.level-card:hover {
  border-color: var(--vscode-focusBorder);
}

.level-card.active {
  border-color: var(--vscode-button-background);
  background: var(--vscode-button-hoverBackground);
}

.level-badge {
  width: 40px;
  height: 40px;
  line-height: 40px;
  border-radius: 50%;
  margin: 0 auto 8px;
  font-size: 18px;
  font-weight: bold;
  color: white;
}

.level-a { background: #e74c3c; }
.level-b { background: #f39c12; }
.level-c { background: #27ae60; }

.level-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.level-desc {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 8px;
}

.level-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
}

.level-tag.required {
  background: #e74c3c;
  color: white;
}
</style>
```

### 验证步骤 3.1
```bash
# 检查文件语法
cd webview && npx vue-tsc --noEmit src/components/releaseNotes/VersionLevelSelector.vue
```

**预期结果**: 无错误输出

---

## 4. 创建芯片标签输入组件

### 4.1 创建文件 `webview/src/components/releaseNotes/ChipRangeInput.vue`

```vue
<template>
  <div class="chip-range-input">
    <div class="chip-container">
      <span
        v-for="(chip, index) in modelValue"
        :key="index"
        class="chip-tag"
      >
        {{ chip }}
        <button class="chip-remove" @click="removeChip(index)">×</button>
      </span>
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        class="chip-input"
        placeholder="输入芯片型号，按回车添加"
        @keydown.enter.prevent="addChip"
        @keydown.backspace="handleBackspace"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const inputValue = ref('');
const inputRef = ref<HTMLInputElement>();

const addChip = () => {
  const value = inputValue.value.trim();
  if (!value) return;

  // 支持逗号分隔批量添加
  const chips = value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const newChips = [...props.modelValue];

  chips.forEach(chip => {
    if (!newChips.includes(chip)) {
      newChips.push(chip);
    }
  });

  emit('update:modelValue', newChips);
  inputValue.value = '';
};

const removeChip = (index: number) => {
  const newChips = [...props.modelValue];
  newChips.splice(index, 1);
  emit('update:modelValue', newChips);
};

const handleBackspace = () => {
  if (inputValue.value === '' && props.modelValue.length > 0) {
    removeChip(props.modelValue.length - 1);
  }
};
</script>

<style scoped>
.chip-range-input {
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  padding: 4px;
  background: var(--vscode-input-background);
}

.chip-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.chip-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-radius: 4px;
  font-size: 13px;
}

.chip-remove {
  margin-left: 4px;
  padding: 0;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.chip-remove:hover {
  opacity: 0.8;
}

.chip-input {
  flex: 1;
  min-width: 120px;
  padding: 4px 8px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--vscode-input-foreground);
  font-size: 13px;
}

.chip-input::placeholder {
  color: var(--vscode-input-placeholderForeground);
}
</style>
```

### 验证步骤 4.1
```bash
# 检查文件语法
cd webview && npx vue-tsc --noEmit src/components/releaseNotes/ChipRangeInput.vue
```

**预期结果**: 无错误输出

---

## 5. 创建 SDK 版本表格组件

### 5.1 创建文件 `webview/src/components/releaseNotes/SdkVersionTable.vue`

```vue
<template>
  <div class="sdk-version-table">
    <table>
      <thead>
        <tr>
          <th>芯片</th>
          <th>版本</th>
          <th>备注</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in modelValue" :key="item.id">
          <td>
            <input
              v-model="item.chip"
              type="text"
              placeholder="如：AC707N"
              @input="updateItem(item)"
            />
          </td>
          <td>
            <input
              v-model="item.version"
              type="text"
              placeholder="如：v2.1.0"
              @input="updateItem(item)"
            />
          </td>
          <td>
            <input
              v-model="item.remark"
              type="text"
              placeholder="备注信息"
              @input="updateItem(item)"
            />
          </td>
          <td>
            <button class="btn-delete" @click="removeItem(item.id)">删除</button>
          </td>
        </tr>
        <tr v-if="modelValue.length === 0">
          <td colspan="4" class="empty-state">
            暂无数据，点击下方"添加行"按钮
          </td>
        </tr>
      </tbody>
    </table>
    <button class="btn-add" @click="addItem">+ 添加行</button>
  </div>
</template>

<script setup lang="ts">
import type { SdkVersionInfo } from '../../types/releaseNotes';

const props = defineProps<{
  modelValue: SdkVersionInfo[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: SdkVersionInfo[]];
  add: [];
  remove: [id: string];
}>();

const addItem = () => {
  const newItem: SdkVersionInfo = {
    id: `sdk-${Date.now()}`,
    chip: '',
    version: '',
    remark: ''
  };
  emit('update:modelValue', [...props.modelValue, newItem]);
  emit('add');
};

const removeItem = (id: string) => {
  const newValue = props.modelValue.filter(item => item.id !== id);
  emit('update:modelValue', newValue);
  emit('remove', id);
};

const updateItem = (item: SdkVersionInfo) => {
  const index = props.modelValue.findIndex(i => i.id === item.id);
  if (index !== -1) {
    const newValue = [...props.modelValue];
    newValue[index] = { ...item };
    emit('update:modelValue', newValue);
  }
};
</script>

<style scoped>
.sdk-version-table {
  width: 100%;
}

.sdk-version-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.sdk-version-table th,
.sdk-version-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.sdk-version-table th {
  background: var(--vscode-editor-background);
  font-weight: 600;
}

.sdk-version-table input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 3px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-size: 13px;
}

.sdk-version-table input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.btn-delete {
  padding: 4px 8px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.btn-delete:hover {
  background: #c0392b;
}

.btn-add {
  margin-top: 8px;
  padding: 6px 12px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-add:hover {
  background: var(--vscode-button-hoverBackground);
}

.empty-state {
  text-align: center;
  color: var(--vscode-descriptionForeground);
  padding: 24px;
}
</style>
```

### 验证步骤 5.1
```bash
# 检查文件语法
cd webview && npx vue-tsc --noEmit src/components/releaseNotes/SdkVersionTable.vue
```

**预期结果**: 无错误输出

---

## 6. 创建版本输入组件

### 6.1 创建文件 `webview/src/components/releaseNotes/VersionInput.vue`

```vue
<template>
  <div class="version-input">
    <label v-if="label" class="input-label">{{ label }}</label>
    <input
      v-model="localValue"
      type="text"
      :placeholder="placeholder"
      :class="{ 'is-invalid': !isValid }"
      @blur="validate"
    />
    <span v-if="!isValid" class="error-msg">版本号格式不正确（如：v1.0.0）</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: string;
  label?: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const localValue = ref(props.modelValue);
const isValid = ref(true);

// 语义化版本号正则
const semverRegex = /^v?(\d+)\.(\d+)\.(\d+)(-[\w.]+)?$/;

watch(() => props.modelValue, (newVal) => {
  localValue.value = newVal;
});

watch(localValue, (newVal) => {
  emit('update:modelValue', newVal);
  if (newVal) {
    isValid.value = semverRegex.test(newVal);
  } else {
    isValid.value = true;
  }
});

const validate = () => {
  if (localValue.value) {
    isValid.value = semverRegex.test(localValue.value);
  }
};
</script>

<style scoped>
.version-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.version-input input {
  padding: 6px 10px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-size: 13px;
}

.version-input input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.version-input input.is-invalid {
  border-color: #e74c3c;
}

.error-msg {
  font-size: 11px;
  color: #e74c3c;
}
</style>
```

### 验证步骤 6.1
```bash
# 检查文件语法
cd webview && npx vue-tsc --noEmit src/components/releaseNotes/VersionInput.vue
```

**预期结果**: 无错误输出

---

## 本阶段验收标准

### 功能验收
- [ ] MarkdownEditor 组件实现完成，支持编辑/预览分栏
- [ ] VersionLevelSelector 组件实现完成，支持A/B/C三级选择
- [ ] ChipRangeInput 组件实现完成，支持标签式输入
- [ ] SdkVersionTable 组件实现完成，支持增删改
- [ ] VersionInput 组件实现完成，支持版本号验证

### 代码质量
- [ ] 所有组件 TypeScript 编译无错误
- [ ] 组件样式使用 VS Code CSS 变量
- [ ] 组件支持 v-model 双向绑定

### 测试验证
- [ ] Markdown 编辑器能正确渲染预览
- [ ] 工具栏按钮能正确插入 Markdown 语法
- [ ] 版本等级选择器能正确切换
- [ ] 芯片输入框能正确添加/删除标签
- [ ] SDK版本表格能正确增删改行
- [ ] 版本输入框能正确验证格式

---

## 常见问题排查

### 问题1: marked 渲染报错
**解决方案**: 检查 marked 配置，确保 highlight 函数正确处理

### 问题2: 组件样式不生效
**解决方案**: 检查是否使用 VS Code CSS 变量，确保在 Webview 环境中正确加载

### 问题3: v-model 双向绑定不生效
**解决方案**: 检查 emit 事件名称是否为 'update:modelValue'

---

## 下一步

完成本步骤后，进入 [第三步：表单组件实现](./第三步-表单组件实现.md)
