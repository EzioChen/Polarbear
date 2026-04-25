/**
 * 文件节点类型
 */
export interface FileNode {
  id: string;
  type: 'file' | 'folder';
  name: string;
  path: string;
  sourcePath?: string;
  size?: number;
  lastModified?: string;
  children?: FileNode[];
}

/**
 * 发布配置
 */
export interface PublishConfig {
  version: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string;
  files: FileNode[];
  metadata: {
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
  };
}

/**
 * 拖拽源
 */
export type DragSource = 'left' | 'right';

/**
 * 拖拽状态
 */
export interface DragState {
  item: FileNode | null;
  source: DragSource | null;
}

/**
 * 拖拽操作结果
 */
export interface DragDropResult {
  itemId: string;
  sourcePath?: string;
  targetPath: string | null;
}

/**
 * 发布统计
 */
export interface PublishStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
}

/**
 * Webview 消息类型
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
 * Extension 消息类型
 */
export type ExtensionMessageType =
  | 'workspaceFiles'
  | 'configUpdated'
  | 'error';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload: any;
}
