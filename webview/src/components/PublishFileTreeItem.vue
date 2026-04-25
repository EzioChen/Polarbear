<template>
  <div
    class="file-tree-item"
    :class="{
      'is-folder': item.type === 'folder',
      'is-expanded': isExpanded,
      'is-drop-target': isDropTarget && canDropHere,
      'is-dragging': isDragging,
      'is-selected': isSelected,
      'is-batch-selected': isBatchSelected
    }"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- 项目内容 -->
    <div
      class="item-content"
      :draggable="true"
      @click="handleClick"
      @dblclick="handleDoubleClick"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <!-- 多选框 -->
      <input
        v-if="showCheckbox"
        type="checkbox"
        class="item-checkbox"
        :checked="isSelected || isBatchSelected"
        @click.stop="handleCheckboxClick"
      />

      <!-- 展开/折叠图标 -->
      <span
        v-if="item.type === 'folder'"
        class="codicon toggle-icon"
        :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
        @click.stop="toggleExpand"
      ></span>
      <span v-else class="toggle-icon-placeholder"></span>

      <!-- 文件/文件夹图标 -->
      <span
        class="codicon file-icon"
        :class="getFileIcon(item)"
        :style="getIconStyle(item)"
      ></span>

      <!-- 项目名称 -->
      <span class="item-name" :title="item.name">{{ item.name }}</span>

      <!-- 文件大小 -->
      <span v-if="item.type === 'file' && item.size" class="file-size">
        {{ formatFileSize(item.size) }}
      </span>

      <!-- 删除按钮 -->
      <button
        class="delete-btn"
        @click.stop="handleDelete"
        title="删除"
      >
        <span class="codicon codicon-close"></span>
      </button>
    </div>

    <!-- 拖拽目标路径提示 -->
    <Transition name="fade">
      <div v-if="isDropTarget && canDropHere && dropTargetPath" class="drop-target-hint">
        <span class="codicon codicon-arrow-right"></span>
        <span>移动到: {{ dropTargetPath }}</span>
      </div>
    </Transition>

    <!-- 子项列表 -->
    <Transition name="expand">
      <div
        v-if="item.type === 'folder' && isExpanded && item.children && item.children.length > 0"
        class="children-container"
        :class="{ 'is-drop-target': isDropTarget && canDropHere }"
      >
        <PublishFileTreeItem
          v-for="child in item.children"
          :key="child.id"
          :item="child"
          :parent-path="item.path"
          :selected-items="selectedItems"
          :show-checkbox="showCheckbox"
          @drag-start="(childItem, source) => $emit('dragStart', childItem, source)"
          @drag-end="$emit('dragEnd')"
          @drop-on-item="(data) => $emit('dropOnItem', data)"
          @delete="(id) => $emit('delete', id)"
          @select="(id, isSelected) => $emit('select', id, isSelected)"
          @batch-select="(ids) => $emit('batchSelect', ids)"
        />
      </div>
    </Transition>

    <!-- 空文件夹提示 -->
    <Transition name="expand">
      <div
        v-if="item.type === 'folder' && isExpanded && (!item.children || item.children.length === 0)"
        class="empty-folder"
        :class="{ 'is-drop-target': isDropTarget && canDropHere }"
      >
        <span class="codicon codicon-folder-opened"></span>
        <span>空文件夹</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FileNode, DragSource } from '../types';

const props = defineProps<{
  item: FileNode;
  parentPath?: string;
  selectedItems?: string[];
  showCheckbox?: boolean;
}>();

const emit = defineEmits<{
  dragStart: [item: FileNode, source: DragSource];
  dragEnd: [];
  dropOnItem: [data: { itemId: string; sourcePath?: string; targetPath: string; nodeData?: any; isBatch?: boolean; itemIds?: string[] }];
  delete: [itemId: string];
  select: [itemId: string, isSelected: boolean];
  batchSelect: [itemIds: string[]];
}>();

const isExpanded = ref(true);
const isDropTarget = ref(false);
const isDragging = ref(false);
const dragCounter = ref(0);
const dropTargetPath = ref('');

// 是否被选中（单选）
const isSelected = computed(() => {
  return props.selectedItems?.includes(props.item.id) ?? false;
});

// 是否批量选中
const isBatchSelected = computed(() => {
  return props.selectedItems && props.selectedItems.length > 1 && props.selectedItems.includes(props.item.id);
});

const canDropHere = computed(() => {
  return props.item.type === 'folder';
});

const handleClick = (event: MouseEvent) => {
  // Ctrl/Cmd + 点击 = 多选
  if (event.ctrlKey || event.metaKey) {
    emit('select', props.item.id, !isSelected.value);
    return;
  }

  // Shift + 点击 = 范围选择（简化实现）
  if (event.shiftKey) {
    // 这里可以实现范围选择逻辑
    return;
  }

  // 普通点击 = 单选或展开/折叠
  if (props.item.type === 'folder') {
    isExpanded.value = !isExpanded.value;
  }

  // 单选当前项
  emit('select', props.item.id, true);
};

const handleDoubleClick = () => {
  if (props.item.type === 'folder') {
    isExpanded.value = !isExpanded.value;
  }
};

const handleCheckboxClick = () => {
  emit('select', props.item.id, !isSelected.value);
};

const handleDelete = () => {
  emit('delete', props.item.id);
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const handleDragStart = (event: DragEvent) => {
  isDragging.value = true;
  emit('dragStart', props.item, 'right');

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';

    // 如果有批量选中的项，一起拖拽
    const hasMultipleSelection = props.selectedItems && props.selectedItems.length > 1;
    const isCurrentItemSelected = props.selectedItems?.includes(props.item.id) ?? false;
    const selectedIds = hasMultipleSelection && isCurrentItemSelected
      ? props.selectedItems!
      : [props.item.id];

    event.dataTransfer.setData('application/json', JSON.stringify({
      itemId: props.item.id,
      sourcePath: props.item.sourcePath,
      name: props.item.name,
      type: props.item.type,
      source: 'right',
      isBatch: selectedIds.length > 1,
      itemIds: selectedIds
    }));

    // 设置拖拽时的提示文本
    const dragText = selectedIds.length > 1
      ? `${selectedIds.length} 个文件/文件夹`
      : props.item.name;
    event.dataTransfer.setData('text/plain', dragText);
  }
};

const handleDragEnd = () => {
  isDragging.value = false;
  emit('dragEnd');
};

const handleDragEnter = (_event: DragEvent) => {
  if (!canDropHere.value) return;

  dragCounter.value++;
  if (dragCounter.value === 1) {
    isDropTarget.value = true;
    dropTargetPath.value = props.item.path;

    // 自动展开文件夹
    if (props.item.type === 'folder') {
      isExpanded.value = true;
    }
  }
};

const handleDragOver = (event: DragEvent) => {
  if (!canDropHere.value) return;

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
};

const handleDragLeave = (_event: DragEvent) => {
  if (!canDropHere.value) return;

  dragCounter.value--;
  if (dragCounter.value <= 0) {
    isDropTarget.value = false;
    dragCounter.value = 0;
    dropTargetPath.value = '';
  }
};

const handleDrop = (event: DragEvent) => {
  if (!canDropHere.value) return;

  isDropTarget.value = false;
  dragCounter.value = 0;
  dropTargetPath.value = '';

  try {
    const data = event.dataTransfer?.getData('application/json');
    if (!data) return;

    const dragData = JSON.parse(data);

    // 防止拖放到自己
    if (dragData.itemId === props.item.id) return;

    // 防止拖放到自己的子项
    if (isDescendant(props.item, dragData.itemId)) return;

    // 构建 nodeData（如果从左侧拖拽）
    const nodeData = dragData.source === 'left' ? {
      id: dragData.itemId,
      name: dragData.name,
      type: dragData.type,
      sourcePath: dragData.sourcePath,
      size: dragData.size,
      lastModified: dragData.lastModified,
      children: dragData.children
    } : undefined;

    emit('dropOnItem', {
      itemId: dragData.itemId,
      sourcePath: dragData.sourcePath,
      targetPath: props.item.path,
      nodeData,
      isBatch: dragData.isBatch,
      itemIds: dragData.itemIds
    });
  } catch (error) {
    console.error('Drop error:', error);
  }
};

// 检查 targetId 是否是 item 的后代
const isDescendant = (item: FileNode, targetId: string): boolean => {
  if (!item.children) return false;

  for (const child of item.children) {
    if (child.id === targetId) return true;
    if (isDescendant(child, targetId)) return true;
  }

  return false;
};

const getFileIcon = (item: FileNode): string => {
  if (item.type === 'folder') {
    return isExpanded.value ? 'codicon-folder-opened' : 'codicon-folder';
  }

  const ext = item.name.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    'js': 'codicon-file-code',
    'ts': 'codicon-file-code',
    'jsx': 'codicon-file-code',
    'tsx': 'codicon-file-code',
    'vue': 'codicon-file-code',
    'json': 'codicon-json',
    'md': 'codicon-file-text',
    'txt': 'codicon-file-text',
    'png': 'codicon-file-media',
    'jpg': 'codicon-file-media',
    'jpeg': 'codicon-file-media',
    'gif': 'codicon-file-media',
    'svg': 'codicon-file-media',
    'pdf': 'codicon-file-pdf',
    'zip': 'codicon-file-zip',
    'css': 'codicon-file-code',
    'scss': 'codicon-file-code',
    'less': 'codicon-file-code',
    'html': 'codicon-file-code',
    'xml': 'codicon-file-code'
  };
  return iconMap[ext || ''] || 'codicon-file';
};

const getIconStyle = (item: FileNode) => {
  if (item.type === 'folder') {
    return { color: 'var(--vscode-symbolIcon-folderForeground, #dcb67a)' };
  }
  return {};
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
  transition: all 0.15s ease;
  position: relative;
}

.item-content:hover {
  background: var(--vscode-list-hoverBackground);
}

.item-content:hover .delete-btn {
  opacity: 1;
}

/* 选中状态 */
.file-tree-item.is-selected > .item-content {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

/* 批量选中状态 */
.file-tree-item.is-batch-selected > .item-content {
  background: var(--vscode-list-inactiveSelectionBackground);
}

/* 拖拽状态 */
.file-tree-item.is-dragging > .item-content {
  opacity: 0.5;
}

/* 放置目标状态 */
.file-tree-item.is-drop-target > .item-content {
  background: rgba(0, 127, 212, 0.15);
  box-shadow: inset 0 0 0 2px var(--vscode-focusBorder);
}

.children-container.is-drop-target {
  background: rgba(0, 127, 212, 0.08);
  box-shadow: inset 0 0 0 1px var(--vscode-focusBorder);
  border-radius: 4px;
}

/* 多选框 */
.item-checkbox {
  width: 14px;
  height: 14px;
  margin-right: 4px;
  cursor: pointer;
}

/* 展开/折叠图标 */
.toggle-icon {
  width: 16px;
  height: 16px;
  font-size: 10px;
  opacity: 0.7;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
}

.toggle-icon:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.toggle-icon-placeholder {
  width: 16px;
  height: 16px;
}

/* 文件图标 */
.file-icon {
  opacity: 0.9;
  font-size: 14px;
}

/* 项目名称 */
.item-name {
  margin-left: 2px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

/* 文件大小 */
.file-size {
  font-size: 11px;
  opacity: 0.6;
  margin-right: 4px;
}

/* 删除按钮 */
.delete-btn {
  background: none;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  color: var(--vscode-errorForeground);
}

/* 拖拽目标路径提示 */
.drop-target-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 4px 28px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  opacity: 0.8;
}

.drop-target-hint .codicon {
  font-size: 10px;
}

/* 子项容器 */
.children-container {
  margin-left: 20px;
  padding: 2px 0;
  transition: all 0.2s ease;
}

/* 空文件夹提示 */
.empty-folder {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-left: 20px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  opacity: 0.7;
  font-style: italic;
  transition: all 0.2s ease;
  border-radius: 4px;
}

.empty-folder.is-drop-target {
  background: rgba(0, 127, 212, 0.08);
  box-shadow: inset 0 0 0 1px var(--vscode-focusBorder);
  opacity: 1;
}

.empty-folder .codicon {
  font-size: 14px;
}

/* 展开/折叠动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
