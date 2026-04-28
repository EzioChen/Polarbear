/**
 * 打包服务类型定义
 */

export interface PackResult {
  success: boolean;
  zipPath?: string;
  error?: string;
  packedFiles: number;
  skippedFiles: string[];
}

export interface PackCache {
  zipPath: string;
  createdAt: string;
  fileCount: number;
  totalSize: number;
}

export interface PackPreview {
  fileCount: number;
  totalSize: number;
  folders: string[];
}

export interface PackCheckResult {
  exists: boolean;
  error?: string;
}

export interface FileCheckResult {
  allExist: boolean;
  missingFiles: string[];
  existingFiles: Array<{
    id: string;
    type: 'file' | 'folder';
    name: string;
    path: string;
    sourcePath?: string;
    size?: number;
    lastModified?: string;
  }>;
}
