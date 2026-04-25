/**
 * 文件图标映射
 */
export const FILE_ICON_MAP: Record<string, string> = {
  'js': 'codicon-file-code',
  'ts': 'codicon-file-code',
  'jsx': 'codicon-file-code',
  'tsx': 'codicon-file-code',
  'vue': 'codicon-file-code',
  'json': 'codicon-file-code',
  'md': 'codicon-file-text',
  'txt': 'codicon-file-text',
  'doc': 'codicon-file-text',
  'docx': 'codicon-file-text',
  'pdf': 'codicon-file-text',
  'png': 'codicon-file-media',
  'jpg': 'codicon-file-media',
  'jpeg': 'codicon-file-media',
  'gif': 'codicon-file-media',
  'svg': 'codicon-file-media',
  'mp4': 'codicon-file-media',
  'mp3': 'codicon-file-media',
  'css': 'codicon-file-code',
  'scss': 'codicon-file-code',
  'less': 'codicon-file-code',
  'default': 'codicon-file'
};

/**
 * 消息类型
 */
export const MESSAGE_TYPES = {
  GET_WORKSPACE_FILES: 'getWorkspaceFiles',
  GET_PUBLISH_CONFIG: 'getPublishConfig',
  SELECT_FILES: 'selectFiles',
  ADD_FOLDER: 'addFolder',
  SAVE_CONFIG: 'saveConfig',
  ADD_FROM_PROJECT: 'addFromProject',
  MOVE_IN_PUBLISH_LIST: 'moveInPublishList',
  DELETE_ITEM: 'deleteItem',
  WORKSPACE_FILES: 'workspaceFiles',
  CONFIG_UPDATED: 'configUpdated',
  ERROR: 'error'
} as const;

export const CONFIG_VERSION = '1.0.0';
export const DEFAULT_CONFIG_NAME = '默认发布配置';
