import * as vscode from 'vscode';
import type { SMTPConfig, SendEmailOptions, SendResult, ValidationResult, ConnectionResult, EmailError } from './types';
import { EmailErrorCode } from './types';
import { ConfigManager } from './ConfigManager';
import { MailComposer } from './MailComposer';
import { MailSender } from './MailSender';
import { LOG_CHANNEL_NAME, ERROR_MESSAGES, formatErrorMessage } from './constants';

export class EmailService {
  private static instance: EmailService;

  private configManager: ConfigManager | null = null;
  private mailComposer: MailComposer | null = null;
  private mailSender: MailSender | null = null;
  private logger: vscode.OutputChannel | null = null;
  private initialized: boolean = false;

  private constructor() {
    // 私有构造函数（单例模式）
  }

  /**
   * 获取单例实例
   */
  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * 初始化服务
   */
  async initialize(workspacePath: string, context?: vscode.ExtensionContext): Promise<void> {
    this.ensureLogger();

    this.log('INFO', '正在初始化邮件服务...');

    try {
      // 创建 ConfigManager
      const secretStorage = context?.secrets;
      this.configManager = new ConfigManager(workspacePath, secretStorage);

      // 加载配置
      const config = await this.configManager.loadConfig();
      this.log('INFO', `配置已加载: ${this.configManager.getConfigPath()}`);

      // 验证配置
      const validation = this.configManager.validateConfig(config);
      if (!validation.valid) {
        const errors = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
        this.log('WARN', `配置验证存在警告/错误: ${errors}`);
      }

      // 创建 MailComposer
      this.mailComposer = new MailComposer(config);

      // 创建 MailSender
      this.mailSender = new MailSender({
        enabled: config.retry?.enabled ?? true,
        maxRetries: config.retry?.maxRetries ?? 3,
        retryDelay: config.retry?.retryDelay ?? 5000,
        exponentialBackoff: config.retry?.exponentialBackoff ?? true,
      });

      this.initialized = true;
      this.log('INFO', '邮件服务初始化完成');
    } catch (error) {
      const emailErr = error as EmailError;
      this.log('ERROR', `初始化失败: ${emailErr.message || error}`);
      throw error;
    }
  }

  /**
   * 发送邮件
   */
  async sendEmail(options: SendEmailOptions): Promise<SendResult> {
    this.checkInitialized();

    const config = this.configManager!.getConfig()!;
    this.log('INFO', `开始发送邮件: 主题="${options.subject}", 收件人=${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);

    try {
      // 使用 MailComposer 构建邮件
      const mailOptions = this.mailComposer!.compose({
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        priority: options.priority,
        headers: options.headers,
      });

      // 使用 MailSender 发送
      this.log('INFO', `正在连接 SMTP 服务器: ${config.smtp.host}:${config.smtp.port}`);
      const result = await this.mailSender!.send(mailOptions, config);

      if (result.success) {
        this.log('INFO', `邮件发送成功, 耗时: ${result.duration}ms, 消息ID: ${result.messageId}`);
      } else {
        this.log('ERROR', `邮件发送失败: ${result.error?.message}, 耗时: ${result.duration}ms`);
      }

      return result;
    } catch (error) {
      const emailErr = error as EmailError;
      this.log('ERROR', `发送邮件异常: ${emailErr.message || error}`);

      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: {
          code: EmailErrorCode.UNKNOWN_ERROR,
          message: formatErrorMessage(ERROR_MESSAGES.UNKNOWN_ERROR, { message: (error as Error).message }),
        },
        accepted: [],
        rejected: [],
        duration: 0,
      };
    }
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<ValidationResult> {
    this.checkInitialized();
    const config = this.configManager!.getConfig();
    if (!config) {
      return {
        valid: false,
        errors: [{ field: 'config', message: ERROR_MESSAGES.CONFIG_NOT_FOUND.replace('{path}', this.configManager!.getConfigPath()), code: 'CONFIG_NOT_FOUND' }],
        warnings: [],
      };
    }
    return this.configManager!.validateConfig(config);
  }

  /**
   * 测试 SMTP 连接
   */
  async testConnection(): Promise<ConnectionResult> {
    this.checkInitialized();

    const config = this.configManager!.getConfig();
    if (!config) {
      return {
        success: false,
        error: {
          code: EmailErrorCode.CONFIG_NOT_FOUND,
          message: '配置未加载',
        },
      };
    }

    this.log('INFO', `正在测试 SMTP 连接: ${config.smtp.host}:${config.smtp.port}`);
    const result = await this.mailSender!.testConnection(config);

    if (result.success) {
      this.log('INFO', `SMTP 连接测试成功, 响应时间: ${result.responseTime}ms`);
    } else {
      this.log('ERROR', `SMTP 连接测试失败: ${result.error?.message}`);
    }

    return result;
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<void> {
    this.checkInitialized();

    this.log('INFO', '正在重新加载配置...');
    try {
      const config = await this.configManager!.reload();
      this.mailComposer!.updateConfig(config);
      this.mailSender!.updateRetryConfig({
        enabled: config.retry?.enabled ?? true,
        maxRetries: config.retry?.maxRetries ?? 3,
        retryDelay: config.retry?.retryDelay ?? 5000,
        exponentialBackoff: config.retry?.exponentialBackoff ?? true,
      });
      this.log('INFO', '配置已重新加载');
    } catch (error) {
      this.log('ERROR', `重新加载配置失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 获取配置管理器
   */
  getConfigManager(): ConfigManager | null {
    return this.configManager;
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取日志通道
   */
  getLogger(): vscode.OutputChannel | null {
    return this.logger;
  }

  /**
   * 显示日志面板
   */
  showLogs(): void {
    if (this.logger) {
      this.logger.show();
    }
  }

  /**
   * 记录日志
   */
  log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string): void {
    if (!this.logger) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const sanitizedMessage = this.sanitizeLogMessage(message);
    this.logger.appendLine(`[${timestamp}] [${level}] ${sanitizedMessage}`);
  }

  /**
   * 脱敏日志消息
   */
  private sanitizeLogMessage(message: string): string {
    // 替换可能的密码字段
    return message
      .replace(/pass(word)?["']?\s*[:=]\s*["'][^"']+["']/gi, 'pass$1 = "***"')
      .replace(/token["']?\s*[:=]\s*["'][^"']+["']/gi, 'token = "***"')
      .replace(/secret["']?\s*[:=]\s*["'][^"']+["']/gi, 'secret = "***"');
  }

  /**
   * 检查是否已初始化
   */
  private checkInitialized(): void {
    if (!this.initialized || !this.configManager || !this.mailComposer || !this.mailSender) {
      throw {
        code: EmailErrorCode.SERVICE_NOT_INITIALIZED,
        message: ERROR_MESSAGES.SERVICE_NOT_INITIALIZED,
      } as EmailError;
    }
  }

  /**
   * 确保日志通道存在
   */
  private ensureLogger(): void {
    if (!this.logger) {
      this.logger = vscode.window.createOutputChannel(LOG_CHANNEL_NAME);
    }
  }
}
