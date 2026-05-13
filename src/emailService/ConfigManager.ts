import * as vscode from 'vscode';
import type { SMTPConfig, ValidationResult, EmailError } from './types';
import { EmailErrorCode } from './types';
import { DEFAULT_SMTP_CONFIG, SECRET_STORAGE_KEY, ERROR_MESSAGES, formatErrorMessage } from './constants';
import { validateSMTPConfig } from './validators';

export class ConfigManager {
  private config: SMTPConfig | null = null;
  private isLoaded: boolean = false;
  private secretStorage: vscode.SecretStorage | null = null;
  private logger: ((level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string) => void) | null = null;

  constructor(secretStorage?: vscode.SecretStorage) {
    if (secretStorage) {
      this.secretStorage = secretStorage;
    }
  }

  /**
   * 设置日志记录器
   */
  setLogger(logger: (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string) => void): void {
    this.logger = logger;
  }

  /**
   * 记录日志
   */
  private log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string): void {
    if (this.logger) {
      this.logger(level, message);
    }
  }

  /**
   * 设置 SecretStorage 实例
   */
  setSecretStorage(secretStorage: vscode.SecretStorage): void {
    this.secretStorage = secretStorage;
  }

  /**
   * 从 VS Code 全局配置加载
   */
  async loadConfig(): Promise<SMTPConfig> {
    this.log('DEBUG', '开始从 VS Code 全局配置加载邮件配置...');

    const vscodeConfig = vscode.workspace.getConfiguration('polarbear.email');

    // 从 VS Code 配置中读取各项设置
    const config: SMTPConfig = {
      version: '1.0.0',
      smtp: {
        host: vscodeConfig.get<string>('smtp.host', ''),
        port: vscodeConfig.get<number>('smtp.port', 25),
        secure: vscodeConfig.get<boolean>('smtp.secure', false),
        tls: {
          rejectUnauthorized: vscodeConfig.get<boolean>('smtp.tls.rejectUnauthorized', false),
          minVersion: vscodeConfig.get<string>('smtp.tls.minVersion', 'TLSv1.2'),
        },
      },
      auth: {
        type: vscodeConfig.get<string>('auth.type', 'login') as 'login' | 'oauth2',
        user: vscodeConfig.get<string>('auth.user', ''),
        pass: '', // 从 SecretStorage 读取
        accessToken: undefined,
      },
      sender: {
        name: vscodeConfig.get<string>('sender.name', ''),
        address: vscodeConfig.get<string>('sender.address', ''),
      },
      connection: {
        timeout: vscodeConfig.get<number>('connection.timeout', 30000),
        greetingTimeout: 15000,
        socketTimeout: 30000,
      },
      retry: {
        enabled: vscodeConfig.get<boolean>('retry.enabled', true),
        maxRetries: vscodeConfig.get<number>('retry.maxRetries', 3),
        retryDelay: 5000,
        exponentialBackoff: true,
      },
      logging: {
        enabled: vscodeConfig.get<boolean>('logging.enabled', true),
        level: vscodeConfig.get<string>('logging.level', 'info') as 'debug' | 'info' | 'warn' | 'error',
        logToFile: false,
        logFilePath: null,
      },
      defaultTo: vscodeConfig.get<Array<{ id: string; name: string; email: string }>>('defaultTo', []),
      defaultCc: vscodeConfig.get<Array<{ id: string; name: string; email: string }>>('defaultCc', []),
    };

    this.log('DEBUG', `VS Code 配置读取完成: host=${config.smtp.host}, port=${config.smtp.port}, user=${config.auth.user}`);

    // 从 SecretStorage 读取密码
    if (this.secretStorage) {
      try {
        this.log('DEBUG', '正在从 SecretStorage 读取密码...');
        const storedPass = await this.secretStorage.get(SECRET_STORAGE_KEY);
        if (storedPass) {
          config.auth.pass = storedPass;
          this.log('DEBUG', '密码已从 SecretStorage 读取');
        } else {
          this.log('WARN', 'SecretStorage 中未找到密码');
        }
      } catch (error) {
        this.log('WARN', `从 SecretStorage 读取密码失败: ${(error as Error).message}`);
      }
    } else {
      this.log('WARN', 'SecretStorage 未设置，无法读取密码');
    }

    this.config = config;
    this.isLoaded = true;

    this.log('INFO', '邮件配置加载完成');
    this.log('DEBUG', `配置详情: sender=${config.sender.address}, defaultTo=${config.defaultTo?.length || 0}人, defaultCc=${config.defaultCc?.length || 0}人`);

    return config;
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
   * 配置是否已加载
   */
  getIsLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * 更新配置（部分更新）
   */
  async updateConfig(partial: Partial<SMTPConfig>): Promise<void> {
    // 如果配置未加载，先加载
    if (!this.config) {
      await this.loadConfig();
    }

    // 深度合并
    const merged = this.deepMerge(
      this.config as unknown as Record<string, unknown>,
      partial as unknown as Record<string, unknown>
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
   * 保存配置到 VS Code 全局配置
   */
  async saveConfig(): Promise<void> {
    if (!this.config) {
      throw this.createError(
        EmailErrorCode.SERVICE_NOT_INITIALIZED,
        ERROR_MESSAGES.SERVICE_NOT_INITIALIZED
      );
    }

    const vscodeConfig = vscode.workspace.getConfiguration('polarbear.email');
    const config = this.config!;

    // 保存到 VS Code 配置
    await vscodeConfig.update('smtp.host', config.smtp.host, true);
    await vscodeConfig.update('smtp.port', config.smtp.port, true);
    await vscodeConfig.update('smtp.secure', config.smtp.secure, true);
    await vscodeConfig.update('smtp.tls.rejectUnauthorized', config.smtp.tls?.rejectUnauthorized ?? false, true);
    await vscodeConfig.update('smtp.tls.minVersion', config.smtp.tls?.minVersion ?? 'TLSv1.2', true);
    await vscodeConfig.update('auth.type', config.auth.type, true);
    await vscodeConfig.update('auth.user', config.auth.user, true);
    await vscodeConfig.update('sender.name', config.sender.name, true);
    await vscodeConfig.update('sender.address', config.sender.address, true);
    await vscodeConfig.update('connection.timeout', config.connection?.timeout ?? 30000, true);
    await vscodeConfig.update('retry.enabled', config.retry?.enabled ?? true, true);
    await vscodeConfig.update('retry.maxRetries', config.retry?.maxRetries ?? 3, true);
    await vscodeConfig.update('logging.enabled', config.logging?.enabled ?? true, true);
    await vscodeConfig.update('logging.level', config.logging?.level ?? 'info', true);
    await vscodeConfig.update('defaultTo', config.defaultTo, true);
    await vscodeConfig.update('defaultCc', config.defaultCc, true);

    // 保存密码到 SecretStorage
    if (this.config.auth.pass && this.secretStorage) {
      try {
        await this.secretStorage.store(SECRET_STORAGE_KEY, this.config.auth.pass);
      } catch {
        // SecretStorage 存储失败
      }
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
  getStatus(): { loaded: boolean; valid: boolean; source: string } {
    const validation = this.config ? validateSMTPConfig(this.config) : { valid: false };
    return {
      loaded: this.isLoaded,
      valid: validation.valid,
      source: 'VS Code 全局配置',
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