<template>
  <div class="panel">
    <div class="panel-header">
      <span class="codicon codicon-folder"></span>
      <span class="panel-title">项目文件</span>
      <span v-if="isLoading" class="loading">
        <span class="codicon codicon-loading spinning"></span>
        加载中...
      </span>
      <span class="panel-count" v-else-if="fileCount > 0">({{ fileCount }})</span>
    </div>
    <div class="panel-content">
      <div v-if="isLoading" class="loading-state">
        <span class="codicon codicon-loading spinning"></span>
        <p>正在扫描项目文件...</p>
      </div>
      <FileTree
        v-else
        :files="files"
        :draggable="true"
        @drag-start="(item: FileNode, source: DragSource) => $emit('dragStart', item, source)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FileTree from './FileTree.vue';
import type { FileNode, DragSource } from '../types';

const props = defineProps<{
  files: FileNode[];
  isLoading?: boolean;
}>();

defineEmits<{
  dragStart: [item: FileNode, source: DragSource];
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

.loading {
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  align-items: center;
  gap: 4px;
}

.loading .codicon {
  animation: spin 1s linear infinite;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--vscode-descriptionForeground);
}

.loading-state .codicon {
  font-size: 32px;
  margin-bottom: 12px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.panel-content {
  flex: 1;
  overflow: auto;
  padding: 4px;
}
</style>
