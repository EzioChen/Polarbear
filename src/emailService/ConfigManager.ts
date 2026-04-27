import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { SMTPConfig, ValidationResult, EmailError } from './types';
import { EmailErrorCode } from './types';
import { DEFAULT_SMTP_CONFIG, DEFAULT_CONFIG_PATH, SECRET_STORAGE_KEY, ERROR_MESSAGES, formatErrorMessage } from './constants';
import { validateSMTPConfig } from './validators';

export class ConfigManager {
  private config: SMTPConfig | null = null;
  private configPath: string = '';
  private isLoaded: boolean = false;
  private secretStorage: vscode.SecretStorage | null = null;
  private workspacePath: string;

  constructor(workspacePath: string, secretStorage?: vscode.SecretStorage) {
    this.workspacePath = workspacePath;
    this.configPath = path.join(workspacePath, DEFAULT_CONFIG_PATH);
    if (secretStorage) {
      this.secretStorage = secretStorage;
    }
  }

  /**
   * 设置 SecretStorage 实例
   */
  setSecretStorage(secretStorage: vscode.SecretStorage): void {
    this.secretStorage = secretStorage;
  }

  /**
   * 解析配置文件路径
   */
  resolveConfigPath(configPath?: string): string {
    if (configPath) {
      if (path.isAbsolute(configPath)) {
        return configPath;
      }
      return path.join(this.workspacePath, configPath);
    }
    return this.configPath;
  }

  /**
   * 从文件加载配置
   */
  async loadConfig(configPath?: string): Promise<SMTPConfig> {
    const resolvedPath = this.resolveConfigPath(configPath);

    // 检查文件是否存在
    if (!fs.existsSync(resolvedPath)) {
      throw this.createError(
        EmailErrorCode.CONFIG_NOT_FOUND,
        formatErrorMessage(ERROR_MESSAGES.CONFIG_NOT_FOUND, { path: resolvedPath }),
        { details: { path: resolvedPath } }
      );
    }

    // 读取文件
    let content: string;
    try {
      content = fs.readFileSync(resolvedPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw this.createError(
          EmailErrorCode.CONFIG_INVALID,
          formatErrorMessage(ERROR_MESSAGES.CONFIG_INVALID, { reason: '权限不足' }),
          { originalError: error as Error }
        );
      }
      throw this.createError(
        EmailErrorCode.UNKNOWN_ERROR,
        formatErrorMessage(ERROR_MESSAGES.UNKNOWN_ERROR, { message: (error as Error).message }),
        { originalError: error as Error }
      );
    }

    // 解析 JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      const syntaxError = error as SyntaxError;
      const reason = `JSON 解析错误: ${syntaxError.message}`;
      throw this.createError(
        EmailErrorCode.CONFIG_INVALID,
        formatErrorMessage(ERROR_MESSAGES.CONFIG_INVALID, { reason }),
        { originalError: syntaxError }
      );
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw this.createError(
        EmailErrorCode.CONFIG_INVALID,
        formatErrorMessage(ERROR_MESSAGES.CONFIG_INVALID, { reason: '配置内容不是有效的 JSON 对象' })
      );
    }

    // 合并默认值
    const mergedConfig = this.mergeWithDefaults(parsed as Partial<SMTPConfig>);

    // 从 SecretStorage 读取密码
    if (this.secretStorage) {
      try {
        const storedPass = await this.secretStorage.get(SECRET_STORAGE_KEY);
        if (storedPass) {
          mergedConfig.auth.pass = storedPass;
        }
      } catch {
        // SecretStorage 读取失败时忽略，使用配置文件中的密码
      }
    }

    this.config = mergedConfig;
    this.configPath = resolvedPath;
    this.isLoaded = true;

    return mergedConfig;
  }

  /**
   * 验证配置
   */
  validateConfig(config?: SMTPConfig): ValidationResult {
    return validateSMTPConfig(config ?? this.config ?? {});
  }

  /**
   * 获取当前配置
   */
  getConfig(): SMTPConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * 获取配置路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 配置是否已加载
   */
  getIsLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * 更新配置（部分更新）
   */
  async updateConfig(partial: Partial<SMTPConfig>): Promise<void> {
    if (!this.config) {
      throw this.createError(
        EmailErrorCode.SERVICE_NOT_INITIALIZED,
        ERROR_MESSAGES.SERVICE_NOT_INITIALIZED
      );
    }

    // 深度合并
    const merged = this.deepMerge(
      { ...this.config } as Record<string, unknown>,
      partial as Record<string, unknown>
    ) as unknown as SMTPConfig;

    // 验证合并后的配置
    const validation = validateSMTPConfig(merged);
    if (!validation.valid) {
      const missingField = validation.errors[0];
      throw this.createError(
        EmailErrorCode.CONFIG_MISSING_FIELD,
        formatErrorMessage(ERROR_MESSAGES.CONFIG_MISSING_FIELD, { field: missingField.field }),
        { details: { errors: validation.errors } }
      );
    }

    // 更新缓存
    this.config = merged;

    // 如果密码变更，更新 SecretStorage
    if (partial.auth?.pass && this.secretStorage) {
      try {
        await this.secretStorage.store(SECRET_STORAGE_KEY, partial.auth.pass);
      } catch {
        // SecretStorage 存储失败时忽略
      }
    }
  }

  /**
   * 保存配置到文件
   */
  async saveConfig(): Promise<void> {
    if (!this.config) {
      throw this.createError(
        EmailErrorCode.SERVICE_NOT_INITIALIZED,
        ERROR_MESSAGES.SERVICE_NOT_INITIALIZED
      );
    }

    // 保存前移除密码字段
    const configToSave = { ...this.config };
    if (configToSave.auth) {
      // 将密码存入 SecretStorage
      if (configToSave.auth.pass && this.secretStorage) {
        try {
          await this.secretStorage.store(SECRET_STORAGE_KEY, configToSave.auth.pass);
        } catch {
          // SecretStorage 存储失败
        }
      }
      // 从 JSON 中移除密码
      configToSave.auth = { ...configToSave.auth, pass: undefined };
    }

    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
    } catch (error) {
      throw this.createError(
        EmailErrorCode.UNKNOWN_ERROR,
        formatErrorMessage(ERROR_MESSAGES.UNKNOWN_ERROR, { message: `保存配置失败: ${(error as Error).message}` }),
        { originalError: error as Error }
      );
    }
  }

  /**
   * 重新加载配置
   */
  async reload(): Promise<SMTPConfig> {
    this.isLoaded = false;
    this.config = null;
    return this.loadConfig();
  }

  /**
   * 配置是否就绪
   */
  isReady(): boolean {
    if (!this.isLoaded || !this.config) {
      return false;
    }
    const validation = validateSMTPConfig(this.config);
    return validation.valid;
  }

  /**
   * 获取配置状态
   */
  getStatus(): { loaded: boolean; valid: boolean; path: string } {
    const validation = this.config ? validateSMTPConfig(this.config) : { valid: false };
    return {
      loaded: this.isLoaded,
      valid: validation.valid,
      path: this.configPath,
    };
  }

  /**
   * 脱敏配置中的敏感信息（用于日志）
   */
  maskSensitiveData(config: SMTPConfig): Partial<SMTPConfig> {
    const masked = { ...config };
    if (masked.auth) {
      masked.auth = {
        ...masked.auth,
        pass: masked.auth.pass ? '***' : undefined,
        accessToken: masked.auth.accessToken ? '***' : undefined,
      };
    }
    return masked;
  }

  /**
   * 与默认值合并
   */
  private mergeWithDefaults(partial: Partial<SMTPConfig>): SMTPConfig {
    const defaults = DEFAULT_SMTP_CONFIG as SMTPConfig;
    return {
      ...defaults,
      ...partial,
      smtp: {
        ...defaults.smtp,
        ...(partial.smtp || {}),
        tls: {
          ...defaults.smtp.tls,
          ...(partial.smtp?.tls || {}),
        },
      },
      auth: {
        ...defaults.auth,
        ...(partial.auth || {}),
      },
      sender: {
        ...defaults.sender,
        ...(partial.sender || {}),
      },
      connection: {
        ...defaults.connection,
        ...(partial.connection || {}),
      },
      retry: {
        ...defaults.retry,
        ...(partial.retry || {}),
      },
    } as SMTPConfig;
  }

  /**
   * 深度合并两个对象
   */
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = target[key];
      if (
        sourceVal !== null &&
        targetVal !== null &&
        typeof sourceVal === 'object' &&
        typeof targetVal === 'object' &&
        !Array.isArray(sourceVal) &&
        !Array.isArray(targetVal)
      ) {
        result[key] = this.deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>
        );
      } else if (sourceVal !== undefined) {
        result[key] = sourceVal;
      }
    }
    return result;
  }

  /**
   * 创建 EmailError
   */
  private createError(code: EmailErrorCode, message: string, extra?: { originalError?: Error; details?: Record<string, unknown> }): EmailError {
    return {
      code,
      message,
      originalError: extra?.originalError,
      details: extra?.details,
    };
  }
}
