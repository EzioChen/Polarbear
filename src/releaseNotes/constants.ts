import type { VersionLevelInfo, ReleaseNotesConfig } from './types';

/**
 * 版本等级选项
 */
export const versionLevelOptions: VersionLevelInfo[] = [
  {
    level: 'A',
    name: 'A类',
    description: '问题修复，客户必须修复',
    required: true
  },
  {
    level: 'B',
    name: 'B类',
    description: '性能优化，客户可选择修复',
    required: false
  },
  {
    level: 'C',
    name: 'C类',
    description: '功能增加，客户可选择修复',
    required: false
  }
];

/**
 * 默认发布说明模板（Markdown格式）
 */
export const defaultTemplate = `## 1、新增功能
1.

## 2、问题修复
-

## 3、性能优化
-
`;

/**
 * 默认配置
 */
export const defaultReleaseNotesConfig: ReleaseNotesConfig = {
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  versionLevel: 'C',
  releaseNotes: defaultTemplate,
  chipRange: [],
  sdkVersions: [],
  sdkVersion: '',
  appVersion: '',
  remarks: '',
  metadata: {
    createdBy: 'polarbear-extension'
  }
};
