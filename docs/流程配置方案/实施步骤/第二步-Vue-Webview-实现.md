# 第二步：Vue Webview 实现

## 目标
创建 Vue 3 + Vite 的 Webview 项目，实现双面板布局、文件树展示、工具栏和状态栏。

## 预计时间
3-4 小时

---

## 1. 创建 Vue 项目结构

### 1.1 创建目录结构

```bash
cd /Volumes/O/AGit/Extension/polarbear
mkdir -p webview/src/{components,composables,types,styles}
touch webview/src/main.ts
touch webview/src/App.vue
touch webview/src/types/index.ts
touch webview/src/styles/vscode-theme.css
touch webview/index.html
touch webview/vite.config.ts
touch webview/tsconfig.json
touch webview/package.json
```

### 验证步骤 1.1
```bash
ls -la webview/src/
# 预期输出: components  composables  types  styles
```

---

## 2. 配置 Vue 项目

### 2.1 创建 `webview/package.json`

```json
{
  "name": "polarbear-webview",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@types/vscode-webview": "^1.57.5",
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vue-tsc": "^1.8.0"
  }
}
```

### 2.2 创建 `webview/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 2.3 创建 `webview/tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

### 2.4 创建 `webview/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
```

### 2.5 创建 `webview/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>配置发布流程</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### 验证步骤 2
```bash
cd webview
npm install
npm run build
```

**预期结果**:
```
dist/webview/
├── assets/
│   ├── main.js
│   └── main.css
└── index.html
```

---

## 3. 实现类型定义

### 3.1 创建 `webview/src/types/index.ts`

```typescript
/**
 * 文件节点类型
 */
export interface FileNode {
  id: string;
  type: 'file' | 'folder';
  name: string;
  path: string;
  sourcePath?: string;
  size?: number;
  lastModified?: string;
  children?: FileNode[];
}

/**
 * 发布配置
 */
export interface PublishConfig {
  version: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string;
  files: FileNode[];
  metadata: {
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
  };
}

/**
 * 发布统计
 */
export interface PublishStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
}

/**
 * Webview 消息类型
 */
export type WebviewMessageType = 
  | 'getWorkspaceFiles'
  | 'getPublishConfig'
  | 'selectFiles'
  | 'addFolder'
  | 'saveConfig'
  | 'addFromProject'
  | 'moveInPublishList'
  | 'deleteItem';

export interface WebviewMessage {
  type: WebviewMessageType;
  payload?: any;
}

/**
 * Extension 消息类型
 */
export type ExtensionMessageType = 
  | 'workspaceFiles'
  | 'configUpdated'
  | 'error';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload: any;
}
```

---

## 4. 实现 VS Code API 封装

### 4.1 创建 `webview/src/composables/useVscodeApi.ts`

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import type { ExtensionMessage, WebviewMessage } from '../types';

declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewMessage) => void;
  getState: () => any;
  setState: (state: any) => void;
};

export function useVscodeApi() {
  const vscode = acquireVsCodeApi();
  const messageHandlers = ref<((message: ExtensionMessage) => void)[]>([]);

  const postMessage = (message: WebviewMessage) => {
    vscode.postMessage(message);
  };

  const onMessage = (handler: (message: ExtensionMessage) => void) => {
    messageHandlers.value.push(handler);
  };

  const handleMessage = (event: MessageEvent) => {
    const message = event.data as ExtensionMessage;
    messageHandlers.value.forEach(handler => handler(message));
  };

  onMounted(() => {
    window.addEventListener('message', handleMessage);
  });

  onUnmounted(() => {
    window.removeEventListener('message', handleMessage);
  });

  return {
    postMessage,
    onMessage,
    vscode
  };
}
```

---

## 5. 实现样式文件

### 5.1 创建 `webview/src/styles/vscode-theme.css`

```css
/* VS Code 主题变量 */
:root {
  --vscode-font-family: var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  --vscode-font-size: var(--vscode-editor-font-size, 13px);
  --vscode-foreground: var(--vscode-editor-foreground, #cccccc);
  --vscode-background: var(--vscode-editor-background, #1e1e1e);
  --vscode-panel-background: var(--vscode-panel-background, #1e1e1e);
  --vscode-panel-border: var(--vscode-panel-border, #3c3c3c);
  --vscode-list-hoverBackground: var(--vscode-list-hoverBackground, #2a2d2e);
  --vscode-list-activeSelectionBackground: var(--vscode-list-activeSelectionBackground, #094771);
  --vscode-button-background: var(--vscode-button-background, #0e639c);
  --vscode-button-hoverBackground: var(--vscode-button-hoverBackground, #1177bb);
  --vscode-button-foreground: var(--vscode-button-foreground, #ffffff);
  --vscode-statusBar-background: var(--vscode-statusBar-background, #007acc);
  --vscode-statusBar-foreground: var(--vscode-statusBar-foreground, #ffffff);
  --vscode-focusBorder: var(--vscode-focusBorder, #007fd4);
  --vscode-descriptionForeground: var(--vscode-descriptionForeground, #cccccc);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-background);
  overflow: hidden;
}

/* Codicons */
.codicon {
  font-family: 'codicon';
  font-size: 16px;
  line-height: 1;
  speak: none;
  display: inline-block;
  vertical-align: middle;
}

.codicon-folder::before { content: '📁'; }
.codicon-file::before { content: '📄'; }
.codicon-file-code::before { content: '📝'; }
.codicon-file-text::before { content: '📃'; }
.codicon-file-media::before { content: '🖼️'; }
.codicon-chevron-right::before { content: '▶'; }
.codicon-chevron-down::before { content: '▼'; }
.codicon-add::before { content: '+'; }
.codicon-save::before { content: '💾'; }
.codicon-trash::before { content: '🗑️'; }
.codicon-package::before { content: '📦'; }
.codicon-inbox::before { content: '📥'; }
```

---

## 6. 实现组件

### 6.1 创建 `webview/src/components/Toolbar.vue`

```vue
<template>
  <div class="toolbar">
    <button class="toolbar-btn" @click="$emit('selectFiles')">
      <span class="codicon codicon-folder"></span>
      选择发布文件/文件夹
    </button>
    <button class="toolbar-btn" @click="$emit('addFolder')">
      <span class="codicon codicon-add"></span>
      新增文件夹
    </button>
    <button class="toolbar-btn primary" @click="$emit('saveConfig')">
      <span class="codicon codicon-save"></span>
      保存配置
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  selectFiles: [];
  addFolder: [];
  saveConfig: [];
}>();
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-panel-background);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  background: var(--vscode-background);
  color: var(--vscode-foreground);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: var(--vscode-list-hoverBackground);
}

.toolbar-btn.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-background);
}

.toolbar-btn.primary:hover {
  background: var(--vscode-button-hoverBackground);
}

.codicon {
  font-size: 14px;
}
</style>
```

### 6.2 创建 `webview/src/components/FileTreeItem.vue`

```vue
<template>
  <div
    class="file-tree-item"
    :class="{ 
      'is-folder': item.type === 'folder',
      'is-expanded': isExpanded
    }"
  >
    <div 
      class="item-content"
      :draggable="draggable"
      @click="handleClick"
      @dragstart="handleDragStart"
    >
      <span 
        v-if="item.type === 'folder'" 
        class="codicon toggle-icon"
        :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
      ></span>
      <span 
        class="codicon file-icon"
        :class="getFileIcon(item)"
      ></span>
      <span class="item-name">{{ item.name }}</span>
    </div>
    
    <div v-if="item.type === 'folder' && isExpanded && item.children" class="children">
      <FileTreeItem
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :draggable="draggable"
        @drag-start="$emit('dragStart', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { FileNode } from '../types';

const props = defineProps<{
  item: FileNode;
  draggable?: boolean;
}>();

const emit = defineEmits<{
  dragStart: [item: FileNode];
}>();

const isExpanded = ref(true);

const handleClick = () => {
  if (props.item.type === 'folder') {
    isExpanded.value = !isExpanded.value;
  }
};

const handleDragStart = () => {
  emit('dragStart', props.item);
};

const getFileIcon = (item: FileNode): string => {
  if (item.type === 'folder') {
    return 'codicon-folder';
  }
  
  const ext = item.name.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    'js': 'codicon-file-code',
    'ts': 'codicon-file-code',
    'jsx': 'codicon-file-code',
    'tsx': 'codicon-file-code',
    'json': 'codicon-file-code',
    'md': 'codicon-file-text',
    'txt': 'codicon-file-text',
    'png': 'codicon-file-media',
    'jpg': 'codicon-file-media',
    'jpeg': 'codicon-file-media',
    'gif': 'codicon-file-media',
    'svg': 'codicon-file-media'
  };
  return iconMap[ext || ''] || 'codicon-file';
};
</script>

<style scoped>
.file-tree-item {
  user-select: none;
}

.item-content {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  gap: 4px;
}

.item-content:hover {
  background: var(--vscode-list-hoverBackground);
}

.item-content[draggable="true"] {
  cursor: grab;
}

.item-content[draggable="true"]:active {
  cursor: grabbing;
}

.toggle-icon {
  width: 16px;
  font-size: 10px;
  opacity: 0.7;
}

.file-icon {
  opacity: 0.9;
}

.item-name {
  margin-left: 2px;
}

.children {
  padding-left: 20px;
}
</style>
```

### 6.3 创建 `webview/src/components/FileTree.vue`

```vue
<template>
  <div class="file-tree">
    <FileTreeItem
      v-for="file in files"
      :key="file.id"
      :item="file"
      :draggable="draggable"
      @drag-start="$emit('dragStart', $event)"
    />
    <div v-if="files.length === 0" class="empty-state">
      <span class="codicon codicon-inbox"></span>
      <p>暂无文件</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import FileTreeItem from './FileTreeItem.vue';
import type { FileNode } from '../types';

defineProps<{
  files: FileNode[];
  draggable?: boolean;
}>();

defineEmits<{
  dragStart: [item: FileNode];
}>();
</script>

<style scoped>
.file-tree {
  padding: 4px 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--vscode-descriptionForeground);
  text-align: center;
}

.empty-state .codicon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 13px;
}
</style>
```

### 6.4 创建 `webview/src/components/ProjectPanel.vue`

```vue
<template>
  <div class="panel">
    <div class="panel-header">
      <span class="codicon codicon-folder"></span>
      <span class="panel-title">项目文件</span>
      <span class="panel-count" v-if="fileCount > 0">({{ fileCount }})</span>
    </div>
    <div class="panel-content">
      <FileTree 
        :files="files"
        :draggable="true"
        @drag-start="$emit('dragStart', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FileTree from './FileTree.vue';
import type { FileNode } from '../types';

const props = defineProps<{
  files: FileNode[];
}>();

const emit = defineEmits<{
  dragStart: [item: FileNode];
}>();

const fileCount = computed(() => {
  let count = 0;
  const traverse = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') count++;
      if (node.children) traverse(node.children);
    }
  };
  traverse(props.files);
  return count;
});
</script>

<style scoped>
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--vscode-panel-border);
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-panel-background);
}

.panel-title {
  flex: 1;
}

.panel-count {
  font-size: 11px;
  opacity: 0.7;
  font-weight: normal;
}

.panel-content {
  flex: 1;
  overflow: auto;
  padding: 4px;
}
</style>
```

### 6.5 创建 `webview/src/components/PublishPanel.vue`

```vue
<template>
  <div 
    class="panel"
    :class="{ 'drop-active': isDropActive }"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <div class="panel-header">
      <span class="codicon codicon-package"></span>
      <span class="panel-title">发布清单</span>
      <span class="panel-count" v-if="fileCount > 0">({{ fileCount }})</span>
    </div>
    <div class="panel-content">
      <FileTree 
        :files="files"
        :draggable="true"
        @drag-start="$emit('dragStart', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FileTree from './FileTree.vue';
import type { FileNode } from '../types';

const props = defineProps<{
  files: FileNode[];
}>();

const emit = defineEmits<{
  dragStart: [item: FileNode];
  drop: [targetPath: string | null];
}>();

const isDropActive = ref(false);

const fileCount = computed(() => {
  let count = 0;
  const traverse = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') count++;
      if (node.children) traverse(node.children);
    }
  };
  traverse(props.files);
  return count;
});

const handleDragOver = () => {
  isDropActive.value = true;
};

const handleDragLeave = () => {
  isDropActive.value = false;
};

const handleDrop = () => {
  isDropActive.value = false;
  emit('drop', null);
};
</script>

<style scoped>
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: all 0.2s;
}

.panel.drop-active {
  background: var(--vscode-list-activeSelectionBackground);
  border: 2px dashed var(--vscode-focusBorder);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-panel-background);
}

.panel-title {
  flex: 1;
}

.panel-count {
  font-size: 11px;
  opacity: 0.7;
  font-weight: normal;
}

.panel-content {
  flex: 1;
  overflow: auto;
  padding: 4px;
}
</style>
```

### 6.6 创建 `webview/src/components/StatusBar.vue`

```vue
<template>
  <div class="status-bar">
    <div class="status-item">
      <span class="codicon codicon-file"></span>
      文件: {{ stats.totalFiles }}
    </div>
    <div class="status-item">
      <span class="codicon codicon-folder"></span>
      文件夹: {{ stats.totalFolders }}
    </div>
    <div class="status-item">
      <span class="codicon codicon-package"></span>
      总大小: {{ formatSize(stats.totalSize) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PublishStats } from '../types';

defineProps<{
  stats: PublishStats;
}>();

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
</script>

<style scoped>
.status-bar {
  display: flex;
  gap: 24px;
  padding: 8px 16px;
  background: var(--vscode-statusBar-background);
  color: var(--vscode-statusBar-foreground);
  font-size: 12px;
  border-top: 1px solid var(--vscode-panel-border);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.codicon {
  font-size: 14px;
}
</style>
```

---

## 7. 实现根组件

### 7.1 创建 `webview/src/App.vue`

```vue
<template>
  <div class="publish-flow-container">
    <Toolbar 
      @select-files="handleSelectFiles"
      @add-folder="handleAddFolder"
      @save-config="handleSaveConfig"
    />
    
    <div class="main-content">
      <ProjectPanel 
        :files="projectFiles"
        @drag-start="handleDragStart"
      />
      
      <PublishPanel 
        :files="publishFiles"
        @drag-start="handleDragStart"
        @drop="handleDrop"
      />
    </div>
    
    <StatusBar :stats="publishStats" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Toolbar from './components/Toolbar.vue';
import ProjectPanel from './components/ProjectPanel.vue';
import PublishPanel from './components/PublishPanel.vue';
import StatusBar from './components/StatusBar.vue';
import type { FileNode, PublishStats } from './types';
import { useVscodeApi } from './composables/useVscodeApi';

const { postMessage, onMessage } = useVscodeApi();

const projectFiles = ref<FileNode[]>([]);
const publishFiles = ref<FileNode[]>([]);
const draggedItem = ref<FileNode | null>(null);
const draggedSource = ref<'left' | 'right' | null>(null);

const publishStats = computed<PublishStats>(() => {
  let totalFiles = 0;
  let totalFolders = 0;
  let totalSize = 0;
  
  const traverse = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') {
        totalFiles++;
        totalSize += node.size || 0;
      } else {
        totalFolders++;
        if (node.children) traverse(node.children);
      }
    }
  };
  
  traverse(publishFiles.value);
  return { totalFiles, totalFolders, totalSize };
});

onMounted(() => {
  // 请求初始数据
  postMessage({ type: 'getWorkspaceFiles' });
  postMessage({ type: 'getPublishConfig' });
  
  // 监听消息
  onMessage((message) => {
    switch (message.type) {
      case 'workspaceFiles':
        projectFiles.value = message.payload;
        break;
      case 'configUpdated':
        publishFiles.value = message.payload.files || [];
        break;
    }
  });
});

const handleDragStart = (item: FileNode) => {
  draggedItem.value = item;
};

const handleDrop = (targetPath: string | null) => {
  if (!draggedItem.value) return;
  
  postMessage({
    type: 'addFromProject',
    payload: {
      itemId: draggedItem.value.id,
      sourcePath: draggedItem.value.sourcePath,
      targetPath
    }
  });
  
  draggedItem.value = null;
};

const handleSelectFiles = () => {
  postMessage({ type: 'selectFiles' });
};

const handleAddFolder = () => {
  postMessage({ type: 'addFolder' });
};

const handleSaveConfig = () => {
  postMessage({ type: 'saveConfig' });
};
</script>

<style>
@import './styles/vscode-theme.css';

.publish-flow-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
```

### 7.2 创建 `webview/src/main.ts`

```typescript
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

---

## 8. 更新 Extension 加载 Vue Webview

### 8.1 修改 `src/extension.ts`

更新 `getWebviewContent` 函数以加载 Vue 构建产物：

```typescript
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  // 获取构建后的文件路径
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'main.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'main.css')
  );

  return `<!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
      <title>配置发布流程</title>
      <link rel="stylesheet" href="${styleUri}">
    </head>
    <body>
      <div id="app"></div>
      <script type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
}
```

### 8.2 添加构建脚本到根 package.json

```json
{
  "scripts": {
    "build:webview": "cd webview && npm run build",
    "compile": "npm run build:webview && webpack"
  }
}
```

---

## 9. 验证步骤

### 9.1 构建验证
```bash
cd /Volumes/O/AGit/Extension/polarbear
npm run build:webview
npm run compile
```

**预期结果**:
```
webview/dist/webview/
├── assets/
│   ├── main.js
│   └── main.css
└── index.html

dist/
├── extension.js
└── webview/
    └── ...
```

### 9.2 功能验证
1. 按 `F5` 启动调试
2. 点击"增加发布流程"
3. **预期结果**:
   - 显示 Vue 界面
   - 顶部有工具栏（3个按钮）
   - 左右双面板布局
   - 左侧面板显示项目文件树
   - 右侧面板显示"暂无文件"
   - 底部状态栏显示统计信息

### 9.3 界面验证
- 工具栏按钮可点击
- 文件树可展开/折叠
- 文件显示正确图标
- 状态栏统计显示 0

---

## 10. 常见问题排查

### 问题 1: Vue 构建失败
**解决方案**:
```bash
cd webview
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 问题 2: Webview 显示空白
**排查步骤**:
1. 检查 `dist/webview/assets/` 是否存在
2. 检查 `localResourceRoots` 是否包含扩展路径
3. 打开开发者工具查看 Console 错误

### 问题 3: CSS 变量不生效
**解决方案**:
确保 `vscode-theme.css` 正确导入，且 VS Code 主题变量可用。

---

## 11. 下一步

完成本步骤后，进入 [第三步：拖拽功能实现](./第三步-拖拽功能实现.md)
