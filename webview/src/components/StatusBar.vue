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
