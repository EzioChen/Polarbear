import * as fs from 'fs';
import * as path from 'path';
import type { ReleaseNotesConfig, SdkVersionInfo } from './types';
import { defaultReleaseNotesConfig, versionLevelOptions } from './constants';

export class ReleaseNotesManager {
  private config: ReleaseNotesConfig;
  private configPath: string;
  private workspacePath: string;
  private debouncedSave: (() => void) | null = null;
  private saveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  private lastError: string | null = null;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.configPath = path.join(workspacePath, '.releasePlan', 'release-notes.json');
    this.config = this.loadConfig();
  }

  /**
   * 获取当前配置
   */
  getConfig(): ReleaseNotesConfig {
    return { ...this.config };
  }

  /**
   * 获取保存状态
   */
  getSaveStatus(): { status: string; error: string | null } {
    return {
      status: this.saveStatus,
      error: this.lastError
    };
  }

  /**
   * 加载配置
   */
  private loadConfig(): ReleaseNotesConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(content);
        return {
          ...defaultReleaseNotesConfig,
          ...loaded,
          metadata: {
            ...defaultReleaseNotesConfig.metadata,
            ...loaded.metadata
          }
        };
      }
    } catch (error) {
      console.error('加载发布说明配置失败:', error);
    }
    return this.createDefaultConfig();
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): ReleaseNotesConfig {
    const now = new Date().toISOString();
    return {
      ...defaultReleaseNotesConfig,
      createdAt: now,
      updatedAt: now,
      metadata: {
        createdBy: process.env.USER || 'unknown',
        author: ''
      }
    };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<ReleaseNotesConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveStatus = 'idle';
  }

  /**
   * 防抖函数
   */
  private debounce(fn: () => void, delay: number): () => void {
    let timer: NodeJS.Timeout | null = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fn();
      }, delay);
    };
  }

  /**
   * 初始化防抖保存
   */
  initAutoSave(callback?: () => void): void {
    if (!this.debouncedSave) {
      this.debouncedSave = this.debounce(() => {
        this.save();
        callback?.();
      }, 500);
    }
  }

  /**
   * 触发自动保存
   */
  autoSave(callback?: () => void): void {
    this.initAutoSave(callback);
    this.debouncedSave?.();
  }

  /**
   * 保存配置到文件
   */
  async save(): Promise<boolean> {
    try {
      this.saveStatus = 'saving';
      this.lastError = null;

      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );

      this.saveStatus = 'saved';
      return true;
    } catch (error) {
      this.saveStatus = 'error';
      this.lastError = error instanceof Error ? error.message : '未知错误';
      console.error('保存发布说明配置失败:', error);
      return false;
    }
  }

  /**
   * 防抖保存（基于Promise）
   */
  debouncedSaveFn(delay: number = 500): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.autoSaveCallback) {
        clearTimeout(this.autoSaveCallback as unknown as number);
      }

      this.autoSaveCallback = () => {
        this.save().then(resolve);
      };

      setTimeout(this.autoSaveCallback, delay);
    });
  }

  private autoSaveCallback: (() => void) | null = null;

  /**
   * 添加SDK版本
   */
  addSdkVersion(info: Omit<SdkVersionInfo, 'id'>): void {
    const newVersion: SdkVersionInfo = {
      ...info,
      id: `sdk-${Date.now()}`
    };
    this.config.sdkVersions.push(newVersion);
    this.config.updatedAt = new Date().toISOString();
  }

  /**
   * 删除SDK版本
   */
  removeSdkVersion(id: string): void {
    this.config.sdkVersions = this.config.sdkVersions.filter(v => v.id !== id);
    this.config.updatedAt = new Date().toISOString();
  }

  /**
   * 更新SDK版本
   */
  updateSdkVersion(id: string, updates: Partial<SdkVersionInfo>): void {
    const index = this.config.sdkVersions.findIndex(v => v.id === id);
    if (index !== -1) {
      this.config.sdkVersions[index] = {
        ...this.config.sdkVersions[index],
        ...updates
      };
      this.config.updatedAt = new Date().toISOString();
    }
  }

  /**
   * 验证配置
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.versionLevel) {
      errors.push('版本等级不能为空');
    }

    if (!this.config.releaseNotes || this.config.releaseNotes.trim().length === 0) {
      errors.push('发布说明不能为空');
    }

    if (!this.config.chipRange || this.config.chipRange.length === 0) {
      errors.push('使用芯片范围不能为空');
    }

    if (!this.config.sdkVersion) {
      errors.push('SDK版本不能为空');
    }

    if (!this.config.appVersion) {
      errors.push('APP版本不能为空');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 导出为 Markdown
   */
  exportToMarkdown(): string {
    const levelInfo = versionLevelOptions.find(
      l => l.level === this.config.versionLevel
    );

    let markdown = `# 发布说明\n\n`;
    markdown += `## 版本等级\n\n`;
    markdown += `- **等级**: ${this.config.versionLevel}\n`;
    markdown += `- **类型**: ${levelInfo?.name || ''}\n`;
    markdown += `- **说明**: ${levelInfo?.description || ''}\n\n`;

    markdown += `## 发布说明\n\n`;
    markdown += this.config.releaseNotes + '\n\n';

    markdown += `## 使用芯片范围\n\n`;
    markdown += this.config.chipRange.map(c => `- ${c}`).join('\n') + '\n\n';

    markdown += `## SDK版本信息\n\n`;
    markdown += '| 芯片 | 版本 | 备注 |\n';
    markdown += '|------|------|------|\n';
    this.config.sdkVersions.forEach(sdk => {
      markdown += `| ${sdk.chip} | ${sdk.version} | ${sdk.remark} |\n`;
    });
    markdown += '\n';

    markdown += `## 版本信息\n\n`;
    markdown += `- **SDK版本**: ${this.config.sdkVersion}\n`;
    markdown += `- **APP版本**: ${this.config.appVersion}\n\n`;

    if (this.config.remarks) {
      markdown += `## 注意事项\n\n`;
      markdown += this.config.remarks + '\n\n';
    }

    markdown += `---\n\n`;
    markdown += `*创建者: ${this.config.metadata.createdBy}*\n`;
    markdown += `*创建时间: ${this.config.createdAt}*\n`;
    markdown += `*更新时间: ${this.config.updatedAt}*\n`;

    return markdown;
  }
}
