import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { FileNode } from './types';
import { PublishFlowManager } from './PublishFlowManager';

const uuidv4 = () => crypto.randomUUID();

/**
 * 扫描工作区文件树
 */
export async function scanWorkspace(workspacePath: string): Promise<FileNode[]> {
  const root: FileNode[] = [];

  async function scanDir(dirPath: string, relativePath: string): Promise<FileNode[]> {
    const nodes: FileNode[] = [];

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // 忽略隐藏文件和 node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const nodeRelativePath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          const children = await scanDir(fullPath, nodeRelativePath);
          nodes.push({
            id: uuidv4(),
            type: 'folder',
            name: entry.name,
            path: nodeRelativePath,
            sourcePath: fullPath,
            children
          });
        } else {
          const stats = await fs.promises.stat(fullPath);
          nodes.push({
            id: uuidv4(),
            type: 'file',
            name: entry.name,
            path: nodeRelativePath,
            sourcePath: fullPath,
            size: stats.size,
            lastModified: stats.mtime.toISOString()
          });
        }
      }
    } catch (error) {
      console.error(`扫描目录失败: ${dirPath}`, error);
    }

    return nodes;
  }

  return scanDir(workspacePath, '');
}

/**
 * 递归添加文件夹到目标
 */
export async function addFolderRecursiveToTarget(
  folderPath: string,
  manager: PublishFlowManager,
  targetParentPath?: string
): Promise<void> {
  const folderName = path.basename(folderPath);
  const targetPath = targetParentPath
    ? path.join(targetParentPath, folderName)
    : folderName;

  manager.addFolder(folderName, targetParentPath);

  const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      await addFolderRecursiveToTarget(fullPath, manager, targetPath);
    } else {
      manager.addFile(fullPath, path.join(targetPath, entry.name));
    }
  }
}

/**
 * 在工作区中查找文件
 */
export function findFileInWorkspace(
  itemId: string,
  sourcePath: string
): FileNode | undefined {
  try {
    const stats = fs.statSync(sourcePath);

    return {
      id: itemId,
      type: stats.isDirectory() ? 'folder' : 'file',
      name: path.basename(sourcePath),
      path: sourcePath,
      sourcePath: sourcePath,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  } catch (error) {
    console.error('查找文件失败:', error);
    return undefined;
  }
}
