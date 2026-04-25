import { ref } from 'vue';
import type { FileNode, DragSource, DragState } from '../types';

export function useDragDrop() {
  const dragState = ref<DragState>({
    item: null,
    source: null
  });

  const isDragging = ref(false);
  const dropTarget = ref<string | null>(null);

  /**
   * 开始拖拽
   */
  const startDrag = (item: FileNode, source: DragSource) => {
    dragState.value = { item, source };
    isDragging.value = true;
  };

  /**
   * 结束拖拽
   */
  const endDrag = () => {
    dragState.value = { item: null, source: null };
    isDragging.value = false;
    dropTarget.value = null;
  };

  /**
   * 设置放置目标
   */
  const setDropTarget = (path: string | null) => {
    dropTarget.value = path;
  };

  /**
   * 清除放置目标
   */
  const clearDropTarget = () => {
    dropTarget.value = null;
  };

  /**
   * 检查是否可放置
   */
  const canDrop = (targetItem: FileNode): boolean => {
    const { item, source } = dragState.value;

    if (!item) return false;

    // 从左侧拖拽到右侧：总是允许
    if (source === 'left' && targetItem.type === 'folder') {
      return true;
    }

    // 右侧内部拖拽：不能拖入自己或自己的子项
    if (source === 'right') {
      // 不能拖入自己
      if (item.id === targetItem.id) return false;

      // 不能拖入自己的子项（防止循环）
      if (isDescendant(item, targetItem)) return false;

      // 只能拖入文件夹
      return targetItem.type === 'folder';
    }

    return false;
  };

  /**
   * 检查 target 是否是 item 的后代
   */
  const isDescendant = (parent: FileNode, target: FileNode): boolean => {
    if (!parent.children) return false;

    for (const child of parent.children) {
      if (child.id === target.id) return true;
      if (isDescendant(child, target)) return true;
    }

    return false;
  };

  return {
    dragState,
    isDragging,
    dropTarget,
    startDrag,
    endDrag,
    setDropTarget,
    clearDropTarget,
    canDrop
  };
}
