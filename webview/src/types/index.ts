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
  // 发布流程相关
  | 'getWorkspaceFiles'
  | 'getPublishConfig'
  | 'selectFiles'
  | 'addFolder'
  | 'saveConfig'
  | 'addFromProject'
  | 'moveInPublishList'
  | 'deleteItem'
  | 'deleteBatch'
  | 'confirmClear'
  // 发布时间轴相关
  | 'getPublishTimelineStatus'
  | 'checkPackPrerequisites'
  | 'startPack'
  | 'getPackPreview'
  | 'getCachedZipPath'
  | 'clearPackCache'
  | 'getReleaseSubject'
  | 'saveReleaseSubject'
  // 发布说明相关
  | 'checkReleaseNotesFile'
  | 'generateReleaseNotes'
  | 'exportReleaseNotesMarkdown'
  | 'saveEditedReleaseNotes'
  // 邮件编辑器相关
  | 'sendEmail'
  | 'saveDraft'
  | 'addAttachment'
  | 'removeAttachment'
  | 'openConfig'
  | 'editorReady'
  | 'closeEditor'
  // 邮件配置相关
  | 'getConfig'
  | 'testConnection'
  // 邮件预编辑相关
  | 'checkEmailConfig'
  | 'prepareEmailData'
  | 'openEmailEditor'
  | 'saveEmailDraft'
  | 'testEmailConnection';

export interface WebviewMessage {
  type: WebviewMessageType;
  payload?: any;
  data?: any;
}

/**
 * Extension 消息类型
 */
export type ExtensionMessageType =
  // 发布流程相关
  | 'workspaceFiles'
  | 'configUpdated'
  | 'error'
  // 发布时间轴相关
  | 'publishTimelineStatus'
  | 'packPrerequisitesResult'
  | 'packProgress'
  | 'packPreviewResult'
  | 'cachedZipPathResult'
  | 'packCacheCleared'
  | 'releaseSubjectResult'
  | 'releaseSubjectSaved'
  // 发布说明相关
  | 'releaseNotesFileCheckResult'
  | 'releaseNotesGenerated'
  | 'releaseNotesExported'
  | 'releaseNotesSaved'
  // 邮件编辑器相关
  | 'loadDraft'
  | 'attachmentsUpdated'
  | 'draftSaved'
  // 邮件配置相关
  | 'configLoaded'
  | 'configSaved'
  | 'saveError'
  | 'testSuccess'
  | 'testError'
  | 'configError'
  // 邮件预编辑相关
  | 'emailConfigCheckResult'
  | 'emailDataPrepared'
  | 'emailConnectionTestResult'
  | 'emailSent';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: any;
  data?: any;
}
