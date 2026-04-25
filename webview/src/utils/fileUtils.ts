import { FILE_ICON_MAP } from '../constants';
import type { FileNode } from '../types';

export function getFileIconClass(item: FileNode): string {
  if (item.type === 'folder') {
    return 'codicon-folder';
  }
  const ext = item.name.split('.').pop()?.toLowerCase();
  return FILE_ICON_MAP[ext || ''] || FILE_ICON_MAP.default;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function countFiles(nodes: FileNode[]): {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
} {
  let totalFiles = 0;
  let totalFolders = 0;
  let totalSize = 0;

  const traverse = (items: FileNode[]) => {
    for (const item of items) {
      if (item.type === 'file') {
        totalFiles++;
        totalSize += item.size || 0;
      } else {
        totalFolders++;
        if (item.children) {
          traverse(item.children);
        }
      }
    }
  };

  traverse(nodes);
  return { totalFiles, totalFolders, totalSize };
}
