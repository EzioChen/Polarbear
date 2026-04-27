/**
 * 版本等级
 */
export type VersionLevel = 'A' | 'B' | 'C';

/**
 * 版本等级描述
 */
export interface VersionLevelInfo {
  level: VersionLevel;
  name: string;
  description: string;
  required: boolean;
}

/**
 * SDK版本信息
 */
export interface SdkVersionInfo {
  id: string;
  chip: string;
  version: string;
  remark: string;
}

/**
 * 发布说明配置
 */
export interface ReleaseNotesConfig {
  /** 配置版本 */
  version: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 版本等级 */
  versionLevel: VersionLevel;
  /** 发布说明内容（Markdown格式） */
  releaseNotes: string;
  /** 使用芯片范围 */
  chipRange: string[];
  /** SDK版本列表 */
  sdkVersions: SdkVersionInfo[];
  /** SDK版本 */
  sdkVersion: string;
  /** APP版本 */
  appVersion: string;
  /** 注意事项 */
  remarks?: string;
  /** 元数据 */
  metadata: {
    author?: string;
    createdBy: string;
  };
}

/**
 * Webview 消息类型（Webview -> Extension）
 */
export type ReleaseNotesMessageType =
  | 'getReleaseNotesConfig'
  | 'saveReleaseNotes'
  | 'autoSaveReleaseNotes'
  | 'importReleaseNotes';

export interface ReleaseNotesMessage {
  type: ReleaseNotesMessageType;
  payload?: any;
}

/**
 * Extension 消息类型（Extension -> Webview）
 */
export type ReleaseNotesExtensionMessageType =
  | 'releaseNotesConfigUpdated'
  | 'releaseNotesSaved'
  | 'releaseNotesError'
  | 'releaseNotesSaveError';

export interface ReleaseNotesExtensionMessage {
  type: ReleaseNotesExtensionMessageType;
  payload: any;
}

/**
 * 保存状态
 */
export type SaveStatus = 'unsaved' | 'saving' | 'saved';
