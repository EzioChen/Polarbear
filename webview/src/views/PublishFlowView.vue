<template>
  <div class="publish-flow-container">
    <Toolbar
      @select-files="handleSelectFiles"
      @add-folder="handleAddFolder"
      @save-config="handleSaveConfig"
    />

    <div class="main-content">
      <ProjectPanel
        :files="filteredProjectFiles"
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
        @delete-batch="handleDeleteBatch"
      />
    </div>

    <StatusBar :stats="publishStats" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Toolbar from '../components/Toolbar.vue';
import ProjectPanel from '../components/ProjectPanel.vue';
import PublishPanel from '../components/PublishPanel.vue';
import StatusBar from '../components/StatusBar.vue';
import type { FileNode, PublishStats, DragSource } from '../types';
import { useVscodeApi } from '../composables/useVscodeApi';

const { postMessage, onMessage } = useVscodeApi();

const projectFiles = ref<FileNode[]>([]);
const publishFiles = ref<FileNode[]>([]);
const draggedItem = ref<FileNode | null>(null);
const draggedSource = ref<DragSource | null>(null);

// 获取所有已发布文件的 sourcePath 集合
const getPublishedPaths = (nodes: FileNode[]): Set<string> => {
  const paths = new Set<string>();
  const traverse = (nodeList: FileNode[]) => {
    for (const node of nodeList) {
      if (node.sourcePath) {
        paths.add(node.sourcePath);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  };
  traverse(nodes);
  return paths;
};

// 过滤项目文件，排除已发布清单中的文件/文件夹
const filterProjectFiles = (nodes: FileNode[], publishedPaths: Set<string>): FileNode[] => {
  const result: FileNode[] = [];

  for (const node of nodes) {
    // 如果当前节点已在发布清单中，完全跳过
    if (node.sourcePath && publishedPaths.has(node.sourcePath)) {
      continue;
    }

    // 如果是文件夹，递归过滤子节点
    if (node.type === 'folder' && node.children) {
      const filteredChildren = filterProjectFiles(node.children, publishedPaths);
      // 如果过滤后还有子节点，或者文件夹本身不在发布清单中，保留该文件夹
      if (filteredChildren.length > 0) {
        result.push({
          ...node,
          children: filteredChildren
        });
      }
    } else {
      // 文件直接添加
      result.push(node);
    }
  }

  return result;
};

// 过滤后的项目文件（排除已发布清单中的文件）
const filteredProjectFiles = computed<FileNode[]>(() => {
  const publishedPaths = getPublishedPaths(publishFiles.value);
  return filterProjectFiles(projectFiles.value, publishedPaths);
});

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

const handleDrop = (data: { itemId: string; sourcePath?: string; targetPath: string | null; nodeData?: any }) => {
  if (draggedSource.value === 'left') {
    postMessage({
      type: 'addFromProject',
      payload: data
    });
  } else if (draggedSource.value === 'right') {
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

const handleDeleteBatch = (itemIds: string[]) => {
  postMessage({
    type: 'deleteBatch',
    payload: { itemIds }
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

<style scoped>
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
