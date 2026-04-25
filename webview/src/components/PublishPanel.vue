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
      <VueDraggable
        v-if="files.length > 0"
        v-model="localFiles"
        :group="{ name: 'publish-files', pull: true, put: true }"
        :sort="true"
        :animation="200"
        ghost-class="ghost"
        drag-class="dragging"
        @start="onDragStart"
        @end="onDragEnd"
        @add="onAdd"
        @update="onUpdate"
        class="draggable-container"
      >
        <template #item="{ element }">
          <div class="draggable-item">
            <FileTreeItem
              :item="element"
              :draggable="true"
              :parent-path="''"
              :show-delete="true"
              @drag-start="handleItemDragStart"
              @drag-end="handleItemDragEnd"
              @drop-on-item="handleDropOnItem"
              @delete="handleDelete"
            />
          </div>
        </template>
      </VueDraggable>

      <div v-else class="empty-state">
        <span class="codicon codicon-inbox"></span>
        <p>拖拽文件到此处</p>
        <p class="hint">从左侧项目文件拖拽文件或文件夹</p>
      </div>

      <div
        v-if="files.length > 0"
        class="drop-zone"
        :class="{ 'active': isRootDropTarget }"
        @dragenter.prevent="handleRootDragEnter"
        @dragover.prevent="handleRootDragOver"
        @dragleave="handleRootDragLeave"
        @drop.prevent="handleRootDrop"
      >
        <span class="codicon codicon-add"></span>
        拖拽到此处添加到根目录
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import FileTreeItem from './FileTreeItem.vue';
import type { FileNode, DragSource } from '../types';

const props = defineProps<{
  files: FileNode[];
}>();

const emit = defineEmits<{
  dragStart: [item: FileNode, source: DragSource];
  dragEnd: [];
  drop: [data: { itemId: string; sourcePath?: string; targetPath: string | null }];
  clearAll: [];
  reorder: [files: FileNode[]];
  deleteItem: [itemId: string];
}>();

const localFiles = computed({
  get: () => props.files,
  set: (val) => {
    emit('reorder', val);
  }
});

const isRootDropTarget = ref(false);
const rootDragCounter = ref(0);

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

const onDragStart = () => {
  console.log('Draggable start');
};

const onDragEnd = () => {
  console.log('Draggable end');
};

const onAdd = (_e: any) => {
  console.log('Item added');
};

const onUpdate = (_e: any) => {
  console.log('List updated');
};

const handleItemDragStart = (item: FileNode) => {
  emit('dragStart', item, 'right');
};

const handleItemDragEnd = () => {
  emit('dragEnd');
};

const handleDropOnItem = (data: { itemId: string; sourcePath?: string; targetPath: string }) => {
  emit('drop', data);
};

const handleRootDragEnter = () => {
  rootDragCounter.value++;
  isRootDropTarget.value = true;
};

const handleRootDragOver = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
};

const handleRootDragLeave = () => {
  rootDragCounter.value--;
  if (rootDragCounter.value === 0) {
    isRootDropTarget.value = false;
  }
};

const handleRootDrop = (event: DragEvent) => {
  isRootDropTarget.value = false;
  rootDragCounter.value = 0;

  try {
    const data = event.dataTransfer?.getData('application/json');
    if (!data) return;

    const dragData = JSON.parse(data);

    emit('drop', {
      itemId: dragData.itemId,
      sourcePath: dragData.sourcePath,
      targetPath: null
    });
  } catch (error) {
    console.error('Root drop error:', error);
  }
};

const handleDelete = (itemId: string) => {
  emit('deleteItem', itemId);
};
</script>

<style scoped>
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
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
  padding: 4px;
}

.draggable-container {
  min-height: 100px;
}

.draggable-item {
  margin-bottom: 2px;
}

.ghost {
  opacity: 0.5;
  background: var(--vscode-list-hoverBackground);
  border: 2px dashed var(--vscode-focusBorder);
}

.dragging {
  opacity: 0.8;
  background: var(--vscode-list-activeSelectionBackground);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--vscode-descriptionForeground);
  text-align: center;
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

.drop-zone {
  margin-top: 16px;
  padding: 12px;
  border: 2px dashed var(--vscode-panel-border);
  border-radius: 4px;
  text-align: center;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  transition: all 0.2s;
}

.drop-zone.active {
  background: rgba(0, 127, 212, 0.1);
  border-color: var(--vscode-focusBorder);
  color: var(--vscode-foreground);
}

.drop-zone .codicon {
  margin-right: 4px;
}
</style>
