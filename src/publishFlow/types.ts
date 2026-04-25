/**
 * 文件节点类型
 */
export interface FileNode {
  /** 唯一标识符 */
  id: string;
  /** 节点类型 */
  type: 'file' | 'folder';
  /** 显示名称 */
  name: string;
  /** 相对路径 */
  path: string;
  /** 绝对路径（文件） */
  sourcePath?: string;
  /** 文件大小 */
  size?: number;
  /** 最后修改时间 */
  lastModified?: string;
  /** 子节点（文件夹） */
  children?: FileNode[];
}

/**
 * 发布配置
 */
export interface PublishConfig {
  /** 配置版本 */
  version: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 配置名称 */
  name: string;
  /** 配置描述 */
  description: string;
  /** 文件列表 */
  files: FileNode[];
  /** 元数据 */
  metadata: {
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
  };
}

/**
 * Webview 消息类型（Webview -> Extension）
 */
export type WebviewMessageType =
  | 'getWorkspaceFiles'
  | 'getPublishConfig'
  | 'selectFiles'
  | 'addFolder'
  | 'saveConfig'
  | 'addFromProject'
  | 'moveInPublishList'
  | 'deleteItem'
  | 'confirmClear';

export interface WebviewMessage {
  type: WebviewMessageType;
  payload?: any;
}

/**
 * Extension 消息类型（Extension -> Webview）
 */
export type ExtensionMessageType =
  | 'workspaceFiles'
  | 'configUpdated'
  | 'error';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload: any;
}
