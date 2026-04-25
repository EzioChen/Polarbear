<template>
  <div class="publish-file-tree">
    <!-- 批量操作工具栏 -->
    <div v-if="selectedItems.length > 0" class="batch-toolbar">
      <span class="batch-count">已选择 {{ selectedItems.length }} 项</span>
      <div class="batch-actions">
        <button class="batch-btn" @click="clearSelection" title="取消选择">
          <span class="codicon codicon-close"></span>
        </button>
        <button class="batch-btn" @click="deleteSelected" title="删除选中项">
          <span class="codicon codicon-trash"></span>
        </button>
      </div>
    </div>

    <!-- 文件树 -->
    <div class="file-tree-content">
      <PublishFileTreeItem
        v-for="file in files"
        :key="file.id"
        :item="file"
        :selected-items="selectedItems"
        :show-checkbox="enableBatchSelect"
        @drag-start="handleDragStart"
        @drag-end="handleDragEnd"
        @drop-on-item="handleDropOnItem"
        @delete="handleDelete"
        @select="handleSelect"
        @batch-select="handleBatchSelect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import PublishFileTreeItem from './PublishFileTreeItem.vue';
import type { FileNode, DragSource } from '../types';

defineProps<{
  files: FileNode[];
}>();

const emit = defineEmits<{
  dragStart: [item: FileNode, source: DragSource];
  dragEnd: [];
  dropOnItem: [data: { itemId: string; sourcePath?: string; targetPath: string; nodeData?: any; isBatch?: boolean; itemIds?: string[] }];
  delete: [itemId: string];
  deleteBatch: [itemIds: string[]];
}>();

// 选中的项目
const selectedItems = ref<string[]>([]);

// 是否启用批量选择模式
const enableBatchSelect = computed(() => selectedItems.value.length > 0);

// 处理单选
const handleSelect = (itemId: string, isSelected: boolean) => {
  if (isSelected) {
    // 如果之前没有选中任何项，直接添加
    if (selectedItems.value.length === 0) {
      selectedItems.value = [itemId];
    } else {
      // 如果按住 Ctrl/Cmd，添加到选择列表
      if (!selectedItems.value.includes(itemId)) {
        selectedItems.value = [...selectedItems.value, itemId];
      }
    }
  } else {
    // 取消选择
    selectedItems.value = selectedItems.value.filter(id => id !== itemId);
  }
};

// 处理批量选择
const handleBatchSelect = (itemIds: string[]) => {
  selectedItems.value = itemIds;
};

// 清空选择
const clearSelection = () => {
  selectedItems.value = [];
};

// 删除选中的项目
const deleteSelected = () => {
  if (selectedItems.value.length === 0) return;
  emit('deleteBatch', [...selectedItems.value]);
  selectedItems.value = [];
};

const handleDragStart = (item: FileNode, source: DragSource) => {
  emit('dragStart', item, source);
};

const handleDragEnd = () => {
  emit('dragEnd');
};

const handleDropOnItem = (data: { itemId: string; sourcePath?: string; targetPath: string; nodeData?: any; isBatch?: boolean; itemIds?: string[] }) => {
  // 移动完成后清空选择
  if (data.isBatch) {
    selectedItems.value = [];
  }
  emit('dropOnItem', data);
};

const handleDelete = (itemId: string) => {
  emit('delete', itemId);
};
</script>

<style scoped>
.publish-file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 批量操作工具栏 */
.batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--vscode-list-activeSelectionBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
  flex-shrink: 0;
}

.batch-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--vscode-list-activeSelectionForeground);
}

.batch-actions {
  display: flex;
  gap: 4px;
}

.batch-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--vscode-list-activeSelectionForeground);
  cursor: pointer;
  transition: background 0.15s;
}

.batch-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

/* 文件树内容 */
.file-tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
</style>
