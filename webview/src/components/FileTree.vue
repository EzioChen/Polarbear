<template>
  <div
    class="file-tree"
    :class="{ 'is-drop-target': isDropTarget }"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <FileTreeItem
      v-for="file in files"
      :key="file.id"
      :item="file"
      :draggable="draggable"
      @drag-start="handleDragStart"
      @drag-end="handleDragEnd"
      @drop-on-item="handleDropOnItem"
    />
    <div v-if="files.length === 0" class="empty-state">
      <span class="codicon codicon-inbox"></span>
      <p>暂无文件</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FileTreeItem from './FileTreeItem.vue';
import type { FileNode, DragSource } from '../types';

const props = defineProps<{
  files: FileNode[];
  draggable?: boolean;
  acceptDrop?: boolean;
}>();

const emit = defineEmits<{
  dragStart: [item: FileNode, source: DragSource];
  dragEnd: [];
  drop: [data: { itemId: string; sourcePath?: string; targetPath: string | null }];
}>();

const isDropTarget = ref(false);
const dragCounter = ref(0);

const handleDragStart = (item: FileNode, source: DragSource) => {
  emit('dragStart', item, source);
};

const handleDragEnd = () => {
  emit('dragEnd');
};

const handleDragEnter = () => {
  if (props.acceptDrop) {
    dragCounter.value++;
    isDropTarget.value = true;
  }
};

const handleDragOver = (event: DragEvent) => {
  if (props.acceptDrop) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }
};

const handleDragLeave = () => {
  if (props.acceptDrop) {
    dragCounter.value--;
    if (dragCounter.value === 0) {
      isDropTarget.value = false;
    }
  }
};

const handleDrop = (event: DragEvent) => {
  if (!props.acceptDrop) return;

  isDropTarget.value = false;
  dragCounter.value = 0;

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
    console.error('Drop error:', error);
  }
};

const handleDropOnItem = (data: { itemId: string; sourcePath?: string; targetPath: string }) => {
  emit('drop', data);
};
</script>

<style scoped>
.file-tree {
  padding: 4px 0;
  min-height: 100px;
  transition: all 0.2s;
}

.file-tree.is-drop-target {
  background: rgba(0, 127, 212, 0.1);
  border: 2px dashed var(--vscode-focusBorder);
  border-radius: 4px;
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
