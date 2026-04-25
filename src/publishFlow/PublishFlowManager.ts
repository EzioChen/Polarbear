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
}
