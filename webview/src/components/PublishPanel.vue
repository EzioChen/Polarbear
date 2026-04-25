<template>
  <div class="panel">
    <div class="panel-header">
      <span class="codicon codicon-package"></span>
      <span class="panel-title">发布清单</span>
      <span class="panel-count" v-if="fileCount > 0">({{ fileCount }})</span>
      <button
        v-if="files.length > 0"
        class="clear-btn"
        @click="$emit('clearAll')"
        title="清空所有"
      >
        <span class="codicon codicon-trash"></span>
      </button>
    </div>
    <div class="panel-content">
      <!-- 文件树展示区域 -->
      <div
        v-if="files.length > 0"
        class="file-tree-container"
        :class="{ 'is-drop-target': isRootDropTarget }"
        @dragenter.prevent="handleRootDragEnter"
        @dragover.prevent="handleRootDragOver"
        @dragleave="handleRootDragLeave"
        @drop.prevent="handleRootDrop"
      >
        <PublishFileTree
          :files="files"
          @drag-start="handleItemDragStart"
          @drag-end="handleItemDragEnd"
          @drop-on-item="handleDropOnItem"
          @delete="handleDelete"
          @delete-batch="handleDeleteBatch"
        />
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state" :class="{ 'is-drop-target': isRootDropTarget }"
        @dragenter.prevent="handleRootDragEnter"
        @dragover.prevent="handleRootDragOver"
        @dragleave="handleRootDragLeave"
        @drop.prevent="handleRootDrop"
      >
        <span class="codicon codicon-inbox"></span>
        <p>拖拽文件到此处</p>
        <p class="hint">从左侧项目文件拖拽文件或文件夹</p>
      </div>

      <!-- 拖拽成功提示 -->
      <Transition name="fade">
        <div v-if="showSuccessToast" class="success-toast">
          <span class="codicon" :class="successIcon"></span>
          <span>{{ successMessage }}</span>
        </div>
      </Transition>

      <!-- 拖拽目标路径悬浮提示 -->
      <Transition name="fade">
        <div v-if="showDragHint && dragTargetPath" class="drag-hint">
          <span class="codicon codicon-arrow-right"></span>
          <span>移动到: {{ dragTargetPath }}</span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import PublishFileTree from './PublishFileTree.vue';
import type { FileNode, DragSource } from '../types';

const props = defineProps<{
  files: FileNode[];
}>();

const emit = defineEmits<{
  dragStart: [item: FileNode, source: DragSource];
  dragEnd: [];
  drop: [data: { itemId: string; sourcePath?: string; targetPath: string | null; nodeData?: any; isBatch?: boolean; itemIds?: string[] }];
  clearAll: [];
  reorder: [files: FileNode[]];
  deleteItem: [itemId: string];
  deleteBatch: [itemIds: string[]];
}>();

const isRootDropTarget = ref(false);
const rootDragCounter = ref(0);
const showSuccessToast = ref(false);
const successMessage = ref('');
const successIcon = ref('codicon-check');
const showDragHint = ref(false);
const dragTargetPath = ref('');

// 计算文件总数
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

// 显示成功提示
const showSuccess = (message: string, icon: string = 'codicon-check') => {
  successMessage.value = message;
  successIcon.value = icon;
  showSuccessToast.value = true;
  setTimeout(() => {
    showSuccessToast.value = false;
  }, 2000);
};

// 显示错误提示
const showError = (message: string) => {
  successMessage.value = message;
  successIcon.value = 'codicon-error';
  showSuccessToast.value = true;
  setTimeout(() => {
    showSuccessToast.value = false;
  }, 3000);
};

// 显示拖拽目标路径提示
const showDragTargetHint = (path: string) => {
  dragTargetPath.value = path;
  showDragHint.value = true;
};

// 隐藏拖拽目标路径提示
const hideDragTargetHint = () => {
  showDragHint.value = false;
  dragTargetPath.value = '';
};

// 处理项目文件拖拽到根目录
const handleRootDragEnter = () => {
  rootDragCounter.value++;
  isRootDropTarget.value = true;
  showDragTargetHint('根目录');
};

const handleRootDragOver = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
};

const handleRootDragLeave = () => {
  rootDragCounter.value--;
  if (rootDragCounter.value <= 0) {
    isRootDropTarget.value = false;
    rootDragCounter.value = 0;
    hideDragTargetHint();
  }
};

const handleRootDrop = (event: DragEvent) => {
  isRootDropTarget.value = false;
  rootDragCounter.value = 0;
  hideDragTargetHint();

  try {
    const data = event.dataTransfer?.getData('application/json');
    if (!data) return;

    const dragData = JSON.parse(data);

    // 检查是否是内部拖拽（从发布清单拖拽到根目录）
    if (dragData.source === 'right') {
      // 内部移动
      const itemName = dragData.name || '项目';
      showSuccess(`已将 "${itemName}" 移动到根目录`);

      emit('drop', {
        itemId: dragData.itemId,
        sourcePath: dragData.sourcePath,
        targetPath: null,
        isBatch: dragData.isBatch,
        itemIds: dragData.itemIds
      });
      return;
    }

    // 从左侧项目文件拖拽
    const itemName = dragData.name || '项目';
    showSuccess(`已添加 "${itemName}" 到发布清单`);

    // 传递完整的节点数据
    emit('drop', {
      itemId: dragData.itemId,
      sourcePath: dragData.sourcePath,
      targetPath: null,
      nodeData: {
        id: dragData.itemId,
        name: dragData.name,
        type: dragData.type,
        sourcePath: dragData.sourcePath,
        size: dragData.size,
        lastModified: dragData.lastModified,
        children: dragData.children
      }
    });
  } catch (error) {
    console.error('Root drop error:', error);
    showError('移动失败，请重试');
  }
};

// 处理内部拖拽
const handleItemDragStart = (item: FileNode) => {
  emit('dragStart', item, 'right');
};

const handleItemDragEnd = () => {
  emit('dragEnd');
};

const handleDropOnItem = (data: { itemId: string; sourcePath?: string; targetPath: string; nodeData?: any; isBatch?: boolean; itemIds?: string[] }) => {
  // 显示成功反馈
  if (data.isBatch && data.itemIds && data.itemIds.length > 1) {
    showSuccess(`已移动 ${data.itemIds.length} 个文件/文件夹到目标位置`);
  } else {
    showSuccess('已移动到目标文件夹');
  }
  emit('drop', data);
};

const handleDelete = (itemId: string) => {
  emit('deleteItem', itemId);
  showSuccess('已删除');
};

const handleDeleteBatch = (itemIds: string[]) => {
  emit('deleteBatch', itemIds);
  showSuccess(`已删除 ${itemIds.length} 个文件/文件夹`);
};
</script>

<style scoped>
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-panel-background);
  flex-shrink: 0;
}

.panel-title {
  flex: 1;
}

.panel-count {
  font-size: 11px;
  opacity: 0.7;
  font-weight: normal;
}

.clear-btn {
  background: none;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.7;
}

.clear-btn:hover {
  background: var(--vscode-list-hoverBackground);
  opacity: 1;
}

.panel-content {
  flex: 1;
  overflow: auto;
  padding: 8px;
  position: relative;
}

.file-tree-container {
  min-height: 100px;
  transition: all 0.2s ease;
  border-radius: 4px;
}

.file-tree-container.is-drop-target {
  background: rgba(0, 127, 212, 0.08);
  box-shadow: inset 0 0 0 2px var(--vscode-focusBorder);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--vscode-descriptionForeground);
  text-align: center;
  border: 2px dashed var(--vscode-panel-border);
  border-radius: 8px;
  margin: 8px;
  transition: all 0.2s ease;
}

.empty-state.is-drop-target {
  background: rgba(0, 127, 212, 0.08);
  border-color: var(--vscode-focusBorder);
  border-style: solid;
}

.empty-state .codicon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.empty-state p {
  font-size: 14px;
  margin-bottom: 8px;
}

.empty-state .hint {
  font-size: 12px;
  opacity: 0.7;
}

/* 成功提示 */
.success-toast {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  padding: 8px 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 100;
}

.success-toast .codicon {
  font-size: 14px;
}

/* 拖拽目标路径提示 */
.drag-hint {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--vscode-editorWidget-background);
  color: var(--vscode-editorWidget-foreground);
  padding: 6px 12px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 100;
  border: 1px solid var(--vscode-editorWidget-border);
}

.drag-hint .codicon {
  font-size: 12px;
  color: var(--vscode-focusBorder);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
