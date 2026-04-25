<template>
  <div
    class="file-tree-item"
    :class="{
      'is-folder': item.type === 'folder',
      'is-expanded': isExpanded,
      'is-drop-target': isDropTarget,
      'can-drop': canDropHere
    }"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <div
      class="item-content"
      :draggable="draggable"
      @click="handleClick"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <span
        v-if="item.type === 'folder'"
        class="codicon toggle-icon"
        :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
        @click.stop="toggleExpand"
      ></span>
      <span
        class="codicon file-icon"
        :class="getFileIcon(item)"
      ></span>
      <span class="item-name">{{ item.name }}</span>
      <button
        v-if="showDelete"
        class="delete-btn"
        @click.stop="handleDelete"
        title="删除"
      >
        <span class="codicon codicon-trash"></span>
      </button>
    </div>

    <div
      v-if="item.type === 'folder' && isExpanded && item.children"
      class="children"
      :class="{ 'drag-over': isDropTarget && item.type === 'folder' }"
    >
      <FileTreeItem
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :draggable="draggable"
        :parent-path="item.path"
        :show-delete="showDelete"
        @drag-start="(childItem: FileNode, source: DragSource) => $emit('dragStart', childItem, source)"
        @drag-end="$emit('dragEnd')"
        @drop-on-item="(data: any) => $emit('dropOnItem', data)"
        @delete="$emit('delete', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FileNode, DragSource } from '../types';

const props = defineProps<{
  item: FileNode;
  draggable?: boolean;
  parentPath?: string;
  showDelete?: boolean;
}>();

const emit = defineEmits<{
  dragStart: [item: FileNode, source: DragSource];
  dragEnd: [];
  dropOnItem: [data: { itemId: string; sourcePath?: string; targetPath: string }];
  delete: [itemId: string];
}>();

const isExpanded = ref(true);
const isDropTarget = ref(false);

const canDropHere = computed(() => {
  return props.item.type === 'folder';
});

const handleClick = () => {
  if (props.item.type === 'folder') {
    isExpanded.value = !isExpanded.value;
  }
};

const handleDelete = () => {
  emit('delete', props.item.id);
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const handleDragStart = (event: DragEvent) => {
  const source: DragSource = props.parentPath ? 'right' : 'left';
  emit('dragStart', props.item, source);

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = source === 'left' ? 'copy' : 'move';
    // 传递完整的节点数据，包括 children
    event.dataTransfer.setData('application/json', JSON.stringify({
      itemId: props.item.id,
      sourcePath: props.item.sourcePath,
      name: props.item.name,
      type: props.item.type,
      size: props.item.size,
      lastModified: props.item.lastModified,
      children: props.item.children,
      source
    }));
  }

  const target = event.target as HTMLElement;
  target.style.opacity = '0.5';
};

const handleDragEnd = (event: DragEvent) => {
  const target = event.target as HTMLElement;
  target.style.opacity = '1';
  emit('dragEnd');
};

const handleDragEnter = () => {
  if (props.item.type === 'folder') {
    isDropTarget.value = true;
  }
};

const handleDragOver = (event: DragEvent) => {
  if (props.item.type === 'folder') {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }
};

const handleDragLeave = (event: DragEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = event.clientX;
  const y = event.clientY;

  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isDropTarget.value = false;
  }
};

const handleDrop = (event: DragEvent) => {
  isDropTarget.value = false;

  try {
    const data = event.dataTransfer?.getData('application/json');
    if (!data) return;
    const dragData = JSON.parse(data);
    if (dragData.itemId === props.item.id) return;

    emit('dropOnItem', {
      itemId: dragData.itemId,
      sourcePath: dragData.sourcePath,
      targetPath: props.item.path
    });
  } catch (error) {
    console.error('Drop error:', error);
  }
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
  transition: all 0.2s;
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

.is-drop-target.can-drop > .item-content {
  background: var(--vscode-list-activeSelectionBackground);
  border: 2px dashed var(--vscode-focusBorder);
}

.toggle-icon {
  width: 16px;
  font-size: 10px;
  opacity: 0.7;
  cursor: pointer;
}

.file-icon {
  opacity: 0.9;
}

.item-name {
  margin-left: 2px;
  flex: 1;
}

/* Delete button */
.delete-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.2s;
}

.item-content:hover .delete-btn {
  opacity: 0.6;
}

.delete-btn:hover {
  opacity: 1 !important;
  background: var(--vscode-list-hoverBackground);
}

.children {
  padding-left: 20px;
}

.children.drag-over {
  background: rgba(0, 127, 212, 0.1);
  border-radius: 4px;
}
</style>
