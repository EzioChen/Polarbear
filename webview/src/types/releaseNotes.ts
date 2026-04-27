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
  version: string;
  createdAt: string;
  updatedAt: string;
  versionLevel: VersionLevel;
  releaseNotes: string;
  chipRange: string[];
  sdkVersions: SdkVersionInfo[];
  sdkVersion: string;
  appVersion: string;
  remarks?: string;
  metadata: {
    author?: string;
    createdBy: string;
  };
}

/**
 * Webview 消息类型（Webview -> Extension）
 */
export type WebviewMessageType =
  | 'getReleaseNotesConfig'
  | 'saveReleaseNotes'
  | 'autoSaveReleaseNotes'
  | 'exportReleaseNotes';

export interface WebviewMessage {
  type: WebviewMessageType;
  payload?: any;
}

/**
 * Extension 消息类型（Extension -> Webview）
 */
export type ExtensionMessageType =
  | 'releaseNotesConfigUpdated'
  | 'releaseNotesSaved'
  | 'releaseNotesError'
  | 'releaseNotesSaveError';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload: any;
}
