import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { FileNode, PublishConfig } from './types';

const uuidv4 = () => crypto.randomUUID();

export class PublishFlowManager {
  private config: PublishConfig;
  private configPath: string;
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.configPath = path.join(workspacePath, '.releasePlan', 'publish-config.json');
    this.config = this.loadConfig();
  }

  /**
   * 加载配置
   */
  private loadConfig(): PublishConfig {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    }
    return this.createDefaultConfig();
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): PublishConfig {
    return {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: '默认发布配置',
      description: '',
      files: [],
      metadata: {
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0
      }
    };
  }

  /**
   * 添加文件
   */
  addFile(sourcePath: string, targetPath: string): void {
    const fileName = path.basename(sourcePath);
    const stats = fs.statSync(sourcePath);

    const fileNode: FileNode = {
      id: uuidv4(),
      type: 'file',
      name: fileName,
      path: targetPath,
      sourcePath: sourcePath,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };

    this.config.files.push(fileNode);
    this.updateMetadata();
  }

  /**
   * 添加文件夹
   */
  addFolder(name: string, parentPath?: string): FileNode {
    const folderNode: FileNode = {
      id: uuidv4(),
      type: 'folder',
      name: name,
      path: parentPath ? path.join(parentPath, name) : name,
      children: []
    };

    if (parentPath) {
      const parent = this.findNodeByPath(parentPath);
      if (parent && parent.children) {
        parent.children.push(folderNode);
      }
    } else {
      this.config.files.push(folderNode);
    }

    this.updateMetadata();
    return folderNode;
  }

  /**
   * 从文件节点树添加文件夹（保持层级结构）
   */
  addFolderFromNode(node: FileNode, parentPath?: string): void {
    // 重新生成 ID，更新路径
    const newPath = parentPath ? path.join(parentPath, node.name) : node.name;

    const newNode: FileNode = {
      id: uuidv4(),
      type: 'folder',
      name: node.name,
      path: newPath,
      sourcePath: node.sourcePath,
      children: []
    };

    // 递归复制子节点
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        if (child.type === 'folder') {
          this.copyNodeRecursive(child, newNode);
        } else {
          // 文件节点
          const newChild: FileNode = {
            id: uuidv4(),
            type: 'file',
            name: child.name,
            path: path.join(newPath, child.name),
            sourcePath: child.sourcePath,
            size: child.size,
            lastModified: child.lastModified
          };
          newNode.children!.push(newChild);
        }
      }
    }

    // 添加到目标位置
    if (parentPath) {
      const parent = this.findNodeByPath(parentPath);
      if (parent && parent.children) {
        parent.children.push(newNode);
      }
    } else {
      this.config.files.push(newNode);
    }

    this.updateMetadata();
  }

  /**
   * 递归复制节点树
   */
  private copyNodeRecursive(node: FileNode, parent: FileNode): void {
    const newPath = path.join(parent.path, node.name);

    const newNode: FileNode = {
      id: uuidv4(),
      type: 'folder',
      name: node.name,
      path: newPath,
      sourcePath: node.sourcePath,
      children: []
    };

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        if (child.type === 'folder') {
          this.copyNodeRecursive(child, newNode);
        } else {
          const newChild: FileNode = {
            id: uuidv4(),
            type: 'file',
            name: child.name,
            path: path.join(newPath, child.name),
            sourcePath: child.sourcePath,
            size: child.size,
            lastModified: child.lastModified
          };
          newNode.children!.push(newChild);
        }
      }
    }

    parent.children!.push(newNode);
  }

  /**
   * 根据路径查找节点
   */
  findNodeByPath(targetPath: string, nodes?: FileNode[]): FileNode | undefined {
    const searchNodes = nodes || this.config.files;

    for (const node of searchNodes) {
      if (node.path === targetPath) {
        return node;
      }
      if (node.children) {
        const found = this.findNodeByPath(targetPath, node.children);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * 根据 ID 查找节点
   */
  findNodeById(nodeId: string, nodes?: FileNode[]): FileNode | undefined {
    const searchNodes = nodes || this.config.files;

    for (const node of searchNodes) {
      if (node.id === nodeId) {
        return node;
      }
      if (node.children) {
        const found = this.findNodeById(nodeId, node.children);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * 根据 ID 移除节点
   */
  removeNode(nodeId: string, nodes?: FileNode[]): boolean {
    const searchNodes = nodes || this.config.files;

    for (let i = 0; i < searchNodes.length; i++) {
      if (searchNodes[i].id === nodeId) {
        searchNodes.splice(i, 1);
        this.updateMetadata();
        return true;
      }
      if (searchNodes[i].children) {
        if (this.removeNode(nodeId, searchNodes[i].children)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 更新元数据
   */
  private updateMetadata(): void {
    let totalFiles = 0;
    let totalFolders = 0;
    let totalSize = 0;

    const traverse = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          totalFiles++;
          totalSize += node.size || 0;
        } else {
          totalFolders++;
          if (node.children) {
            traverse(node.children);
          }
        }
      }
    };

    traverse(this.config.files);

    this.config.metadata = {
      totalFiles,
      totalFolders,
      totalSize
    };
  }

  /**
   * 保存配置
   */
  async save(): Promise<void> {
    this.config.updatedAt = new Date().toISOString();

    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );
  }

  /**
   * 获取配置
   */
  getConfig(): PublishConfig {
    return this.config;
  }

  /**
   * 获取工作区路径
   */
  getWorkspacePath(): string {
    return this.workspacePath;
  }

  /**
   * 刷新文件夹内容 - 扫描目录下新增的文件和子文件夹
   * 根据记录的 sourcePath 重新扫描实际文件系统，更新到配置中
   */
  async refreshFolders(): Promise<{ added: number; removed: number }> {
    let addedCount = 0;
    let removedCount = 0;

    const refreshNodeRecursive = async (node: FileNode): Promise<boolean> => {
      // 如果是文件，检查是否存在
      if (node.type === 'file') {
        if (node.sourcePath && !fs.existsSync(node.sourcePath)) {
          return false; // 文件不存在，标记为需要移除
        }
        return true; // 文件存在，保留
      }

      // 如果是文件夹且有 sourcePath，重新扫描
      if (node.type === 'folder' && node.sourcePath && fs.existsSync(node.sourcePath)) {
        const existingChildren = node.children || [];
        const newChildren: FileNode[] = [];

        // 读取实际目录内容
        try {
          const entries = await fs.promises.readdir(node.sourcePath, { withFileTypes: true });

          // 创建现有子节点的映射（按名称）
          const existingMap = new Map<string, FileNode>();
          for (const child of existingChildren) {
            existingMap.set(child.name, child);
          }

          for (const entry of entries) {
            // 忽略隐藏文件
            if (entry.name.startsWith('.')) {
              continue;
            }

            const fullPath = path.join(node.sourcePath!, entry.name);
            const childPath = path.join(node.path, entry.name);

            if (entry.isDirectory()) {
              const existingFolder = existingMap.get(entry.name);
              if (existingFolder && existingFolder.type === 'folder') {
                // 文件夹已存在，递归刷新
                const keepFolder = await refreshNodeRecursive(existingFolder);
                if (keepFolder) {
                  newChildren.push(existingFolder);
                } else {
                  removedCount++;
                }
              } else {
                // 新增文件夹
                const newFolder: FileNode = {
                  id: uuidv4(),
                  type: 'folder',
                  name: entry.name,
                  path: childPath,
                  sourcePath: fullPath,
                  children: []
                };
                // 递归扫描新文件夹的内容
                await scanNewFolderRecursive(newFolder);
                newChildren.push(newFolder);
                addedCount++;
              }
            } else {
              const existingFile = existingMap.get(entry.name);
              if (existingFile && existingFile.type === 'file') {
                // 文件已存在，保留
                newChildren.push(existingFile);
              } else {
                // 新增文件
                const stats = await fs.promises.stat(fullPath);
                const newFile: FileNode = {
                  id: uuidv4(),
                  type: 'file',
                  name: entry.name,
                  path: childPath,
                  sourcePath: fullPath,
                  size: stats.size,
                  lastModified: stats.mtime.toISOString()
                };
                newChildren.push(newFile);
                addedCount++;
              }
            }
          }

          // 检查被删除的文件/文件夹
          const newNames = new Set(newChildren.map(c => c.name));
          for (const existingChild of existingChildren) {
            if (!newNames.has(existingChild.name)) {
              removedCount++;
            }
          }

          node.children = newChildren;
          return true;
        } catch (error) {
          console.error(`刷新文件夹失败: ${node.sourcePath}`, error);
          return true; // 保留原有内容
        }
      } else if (node.type === 'folder' && node.children) {
        // 没有 sourcePath 的文件夹（手动创建的），递归刷新子节点
        const refreshedChildren: FileNode[] = [];
        for (const child of node.children) {
          const keepChild = await refreshNodeRecursive(child);
          if (keepChild) {
            refreshedChildren.push(child);
          } else {
            removedCount++;
          }
        }
        node.children = refreshedChildren;
        return true;
      }

      return true;
    };

    // 扫描新文件夹的递归函数
    const scanNewFolderRecursive = async (folderNode: FileNode): Promise<void> => {
      if (!folderNode.sourcePath || !fs.existsSync(folderNode.sourcePath)) {
        return;
      }

      try {
        const entries = await fs.promises.readdir(folderNode.sourcePath, { withFileTypes: true });
        folderNode.children = [];

        for (const entry of entries) {
          if (entry.name.startsWith('.')) {
            continue;
          }

          const fullPath = path.join(folderNode.sourcePath!, entry.name);
          const childPath = path.join(folderNode.path, entry.name);

          if (entry.isDirectory()) {
            const newFolder: FileNode = {
              id: uuidv4(),
              type: 'folder',
              name: entry.name,
              path: childPath,
              sourcePath: fullPath,
              children: []
            };
            await scanNewFolderRecursive(newFolder);
            folderNode.children.push(newFolder);
            addedCount++;
          } else {
            const stats = await fs.promises.stat(fullPath);
            const newFile: FileNode = {
              id: uuidv4(),
              type: 'file',
              name: entry.name,
              path: childPath,
              sourcePath: fullPath,
              size: stats.size,
              lastModified: stats.mtime.toISOString()
            };
            folderNode.children.push(newFile);
            addedCount++;
          }
        }
      } catch (error) {
        console.error(`扫描新文件夹失败: ${folderNode.sourcePath}`, error);
      }
    };

    // 刷新根级别的文件和文件夹
    const refreshedFiles: FileNode[] = [];
    for (const node of this.config.files) {
      const keepNode = await refreshNodeRecursive(node);
      if (keepNode) {
        refreshedFiles.push(node);
      } else {
        removedCount++;
      }
    }
    this.config.files = refreshedFiles;

    // 更新元数据
    this.updateMetadata();

    return { added: addedCount, removed: removedCount };
  }
}
