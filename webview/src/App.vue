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
        @drag-end="handleDragEnd"
      />

      <PublishPanel
        :files="publishFiles"
        @drag-start="handleDragStart"
        @drag-end="handleDragEnd"
        @drop="handleDrop"
        @clear-all="handleClearAll"
        @reorder="handleReorder"
        @delete-item="handleDeleteItem"
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
import type { FileNode, PublishStats, DragSource } from './types';
import { useVscodeApi } from './composables/useVscodeApi';

const { postMessage, onMessage } = useVscodeApi();

const projectFiles = ref<FileNode[]>([]);
const publishFiles = ref<FileNode[]>([]);
const draggedItem = ref<FileNode | null>(null);
const draggedSource = ref<DragSource | null>(null);

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
  postMessage({ type: 'getWorkspaceFiles' });
  postMessage({ type: 'getPublishConfig' });

  onMessage((message) => {
    switch (message.type) {
      case 'workspaceFiles':
        projectFiles.value = message.payload;
        break;
      case 'configUpdated':
        publishFiles.value = message.payload.files || [];
        break;
      case 'error':
        console.error('Extension error:', message.payload.message);
        break;
    }
  });
});

const handleDragStart = (item: FileNode, source: DragSource) => {
  draggedItem.value = item;
  draggedSource.value = source;
};

const handleDragEnd = () => {
  draggedItem.value = null;
  draggedSource.value = null;
};

const handleDrop = (data: { itemId: string; sourcePath?: string; targetPath: string | null }) => {
  if (draggedSource.value === 'left') {
    // 从项目文件拖拽到发布清单
    postMessage({
      type: 'addFromProject',
      payload: data
    });
  } else if (draggedSource.value === 'right') {
    // 发布清单内部移动
    postMessage({
      type: 'moveInPublishList',
      payload: data
    });
  }

  draggedItem.value = null;
  draggedSource.value = null;
};

const handleClearAll = () => {
  if (publishFiles.value.length === 0) return;
  postMessage({
    type: 'confirmClear',
    payload: {
      message: `确定要清空发布清单中的所有 ${publishFiles.value.length} 个文件/文件夹吗？`
    }
  });
};

const handleReorder = (files: FileNode[]) => {
  publishFiles.value = files;
  postMessage({ type: 'saveConfig' });
};

const handleDeleteItem = (itemId: string) => {
  postMessage({
    type: 'deleteItem',
    payload: { itemId }
  });
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
