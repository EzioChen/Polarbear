import nodemailer from 'nodemailer';
import type { Transporter, TransportOptions } from 'nodemailer';
import type { SMTPConfig, SendResult, MailOptions, EmailError } from './types';
import { EmailErrorCode } from './types';
import { ERROR_MESSAGES, formatErrorMessage } from './constants';

export class MailSender {
  private transporter: Transporter | null = null;
  private retryConfig: { enabled: boolean; maxRetries: number; retryDelay: number; exponentialBackoff: boolean };
  private logger: ((level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string) => void) | null = null;

  constructor(retryConfig?: { enabled: boolean; maxRetries: number; retryDelay: number; exponentialBackoff: boolean }) {
    this.retryConfig = retryConfig ?? {
      enabled: true,
      maxRetries: 3,
      retryDelay: 5000,
      exponentialBackoff: true,
    };
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
   * 更新重试配置
   */
  updateRetryConfig(retryConfig: typeof this.retryConfig): void {
    this.retryConfig = retryConfig;
  }

  /**
   * 创建 SMTP 传输器
   */
  async createTransporter(config: SMTPConfig): Promise<Transporter> {
    this.log('DEBUG', `创建 SMTP 传输器: ${config.smtp.host}:${config.smtp.port}`);
    this.log('DEBUG', `SMTP 配置: secure=${config.smtp.secure}, tls.rejectUnauthorized=${config.smtp.tls?.rejectUnauthorized}`);
    this.log('DEBUG', `认证配置: user=${config.auth.user}, type=${config.auth.type}`);

    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        tls: config.smtp.tls ? {
          rejectUnauthorized: config.smtp.tls.rejectUnauthorized,
          minVersion: config.smtp.tls.minVersion,
        } : undefined,
        auth: {
          user: config.auth.user,
          ...(config.auth.pass ? { pass: config.auth.pass } : {}),
          ...(config.auth.type ? { type: config.auth.type as 'login' | 'plain' | 'oauth2' } : {}),
          ...(config.auth.accessToken ? { accessToken: config.auth.accessToken } : {}),
        },
        connectionTimeout: config.connection?.timeout,
        greetingTimeout: config.connection?.greetingTimeout,
        socketTimeout: config.connection?.socketTimeout,
      } as TransportOptions);

      this.log('DEBUG', 'SMTP 传输器已创建，开始验证连接...');

      // 验证连接配置（带超时）
      const verifyTimeout = config.connection?.timeout || 30000;
      this.log('DEBUG', `连接验证超时设置: ${verifyTimeout}ms`);

      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`连接验证超时 (${verifyTimeout}ms)`)), verifyTimeout)
        ),
      ]);

      this.log('DEBUG', 'SMTP 连接验证成功');

      return transporter;
    } catch (error) {
      this.log('ERROR', `创建 SMTP 传输器失败: ${(error as Error).message}`);
      throw this.mapNodemailerError(error, config);
    }
  }

  /**
   * 发送邮件（单次发送模式：创建连接 → 发送 → 关闭连接）
   */
  async send(mailOptions: MailOptions, config: SMTPConfig): Promise<SendResult> {
    const startTime = Date.now();

    this.log('INFO', `准备发送邮件: 主题="${mailOptions.subject}"`);
    this.log('DEBUG', `重试配置: enabled=${this.retryConfig.enabled}, maxRetries=${this.retryConfig.maxRetries}`);

    // 判断是否启用重试
    if (this.retryConfig.enabled && this.retryConfig.maxRetries > 0) {
      this.log('DEBUG', '启用重试机制');
      return this.executeWithRetry(() => this.executeSend(mailOptions, config), config);
    }

    this.log('DEBUG', '禁用重试机制');
    return this.executeSend(mailOptions, config);
  }

  /**
   * 执行单次发送
   */
  private async executeSend(mailOptions: MailOptions, config: SMTPConfig): Promise<SendResult> {
    const startTime = Date.now();

    const toAddresses = Array.isArray(mailOptions.to) ? mailOptions.to.join(', ') : mailOptions.to || '无';
    this.log('DEBUG', `开始执行邮件发送: 收件人=${toAddresses}, 主题="${mailOptions.subject}"`);
    this.log('DEBUG', `发件人: ${mailOptions.from}`);
    this.log('DEBUG', `邮件选项: cc=${mailOptions.cc?.length || 0}人, 附件=${mailOptions.attachments?.length || 0}个`);

    try {
      // 创建传输器（建立连接）
      this.log('DEBUG', '正在创建 SMTP 传输器...');
      this.transporter = await this.createTransporter(config);
      this.log('DEBUG', 'SMTP 传输器创建成功');

      // 发送邮件
      this.log('DEBUG', '正在发送邮件...');
      const info = await this.transporter.sendMail(mailOptions as unknown as Record<string, unknown>);
      this.log('DEBUG', `邮件发送完成: messageId=${info.messageId}, response=${info.response}`);
      this.log('DEBUG', `发送结果: accepted=${JSON.stringify(info.accepted)}, rejected=${JSON.stringify(info.rejected)}`);

      // 关闭连接
      await this.close();

      const duration = Date.now() - startTime;
      this.log('DEBUG', `邮件发送成功，耗时: ${duration}ms`);

      const msgId = info.messageId;
      const resp = info.response;
      return {
        success: true,
        messageId: msgId ? String(msgId) : undefined,
        timestamp: new Date().toISOString(),
        response: resp ? String(resp) : undefined,
        accepted: (info.accepted || []) as string[],
        rejected: (info.rejected || []) as string[],
        duration,
      };
    } catch (error) {
      // 确保连接已关闭
      await this.close();

      const duration = Date.now() - startTime;
      const emailError = this.mapNodemailerError(error, config);

      this.log('ERROR', `邮件发送失败: ${emailError.message}, code=${emailError.code}, 耗时: ${duration}ms`);
      this.log('DEBUG', `错误详情: ${JSON.stringify({
        code: emailError.code,
        message: emailError.message,
        originalError: (error as Error).message,
        stack: (error as Error).stack,
      })}`);

      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: emailError,
        accepted: [],
        rejected: [],
        duration,
      };
    }
  }

  /**
   * 带重试机制的执行
   */
  private async executeWithRetry(
    operation: () => Promise<SendResult>,
    config: SMTPConfig
  ): Promise<SendResult> {
    const maxRetries = this.retryConfig.maxRetries;

    let lastResult: SendResult | null = null;

    this.log('DEBUG', `开始重试机制: maxRetries=${maxRetries}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.log('DEBUG', `第 ${attempt}/${maxRetries} 次尝试发送...`);

      lastResult = await operation();

      if (lastResult.success) {
        this.log('DEBUG', `第 ${attempt} 次尝试成功`);
        return lastResult;
      }

      this.log('WARN', `第 ${attempt} 次尝试失败: ${lastResult.error?.message}, code=${lastResult.error?.code}`);

      // 判断错误是否可重试
      const errorCode = lastResult.error?.code;
      if (!errorCode || !this.shouldRetry(errorCode)) {
        this.log('DEBUG', `错误不可重试: code=${errorCode}`);
        return lastResult;
      }

      // 最后一次尝试后不再等待
      if (attempt < maxRetries) {
        const delay = this.calculateDelay(attempt);
        this.log('DEBUG', `等待 ${delay}ms 后进行下一次重试...`);
        await this.sleep(delay);
      }
    }

    // 重试耗尽
    this.log('ERROR', `重试耗尽，共尝试 ${maxRetries} 次`);
    return lastResult ?? {
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        code: EmailErrorCode.RETRY_EXHAUSTED,
        message: ERROR_MESSAGES.RETRY_EXHAUSTED,
      },
      accepted: [],
      rejected: [],
      duration: 0,
    };
  }

  /**
   * 判断错误是否可重试
   */
  private shouldRetry(errorCode: EmailErrorCode): boolean {
    const retryableCodes: EmailErrorCode[] = [
      EmailErrorCode.CONNECTION_FAILED,
      EmailErrorCode.CONNECTION_TIMEOUT,
      EmailErrorCode.SEND_TIMEOUT,
      EmailErrorCode.TLS_ERROR,
      EmailErrorCode.DNS_ERROR,
      EmailErrorCode.SEND_FAILED,
    ];
    return retryableCodes.includes(errorCode);
  }

  /**
   * 计算重试延迟（指数退避）
   */
  private calculateDelay(attempt: number): number {
    if (this.retryConfig.exponentialBackoff) {
      return this.retryConfig.retryDelay * Math.pow(2, attempt - 1);
    }
    return this.retryConfig.retryDelay;
  }

  /**
   * 关闭传输器
   */
  async close(): Promise<void> {
    if (this.transporter) {
      try {
        this.transporter.close();
      } catch {
        // 关闭时的错误可以忽略
      } finally {
        this.transporter = null;
      }
    }
  }

  /**
   * 测试 SMTP 连接
   */
  async testConnection(config: SMTPConfig): Promise<{ success: boolean; responseTime?: number; response?: string; error?: EmailError }> {
    const startTime = Date.now();

    this.log('INFO', `开始测试 SMTP 连接: ${config.smtp.host}:${config.smtp.port}`);
    this.log('DEBUG', `测试连接配置: user=${config.auth.user}, secure=${config.smtp.secure}`);

    try {
      const transporter = await this.createTransporter(config);
      const responseTime = Date.now() - startTime;

      // 验证连接
      await transporter.verify();
      const totalTime = Date.now() - startTime;

      transporter.close();

      this.log('INFO', `SMTP 连接测试成功, 响应时间: ${totalTime}ms`);

      return {
        success: true,
        responseTime: totalTime,
        response: 'SMTP 服务器连接成功',
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const emailError = this.mapNodemailerError(error, config);

      this.log('ERROR', `SMTP 连接测试失败: ${emailError.message}, code=${emailError.code}, 耗时: ${duration}ms`);

      return {
        success: false,
        responseTime: duration,
        error: emailError,
      };
    }
  }

  /**
   * 将 Nodemailer 错误映射为 EmailError
   */
  private mapNodemailerError(error: unknown, config: SMTPConfig): EmailError {
    const err = error as Error & { code?: string; responseCode?: number };

    // 连接相关错误
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      return {
        code: EmailErrorCode.CONNECTION_FAILED,
        message: formatErrorMessage(ERROR_MESSAGES.CONNECTION_FAILED, {
          host: config.smtp.host,
          port: config.smtp.port,
        }),
        originalError: err,
        details: { host: config.smtp.host, port: config.smtp.port },
      };
    }

    if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
      return {
        code: EmailErrorCode.CONNECTION_TIMEOUT,
        message: ERROR_MESSAGES.CONNECTION_TIMEOUT,
        originalError: err,
      };
    }

    // TLS 错误
    if (err.message?.includes('TLS') || err.message?.includes('tls') || err.message?.includes('certificate')) {
      return {
        code: EmailErrorCode.TLS_ERROR,
        message: formatErrorMessage(ERROR_MESSAGES.TLS_ERROR, { reason: err.message }),
        originalError: err,
      };
    }

    // 认证错误
    if (err.code === 'EAUTH' || err.responseCode === 535 || err.responseCode === 530) {
      return {
        code: EmailErrorCode.AUTH_INVALID_CREDENTIALS,
        message: ERROR_MESSAGES.AUTH_INVALID_CREDENTIALS,
        originalError: err,
      };
    }

    // 收件人错误
    if (err.responseCode === 550 || err.responseCode === 551 || err.responseCode === 552) {
      if (err.message?.includes('size') || err.message?.includes('limit')) {
        return {
          code: EmailErrorCode.MESSAGE_TOO_LARGE,
          message: ERROR_MESSAGES.MESSAGE_TOO_LARGE,
          originalError: err,
        };
      }
      return {
        code: EmailErrorCode.RECIPIENT_REJECTED,
        message: formatErrorMessage(ERROR_MESSAGES.RECIPIENT_REJECTED, { email: 'unknown' }),
        originalError: err,
      };
    }

    // 默认错误
    return {
      code: EmailErrorCode.SEND_FAILED,
      message: formatErrorMessage(ERROR_MESSAGES.SEND_FAILED, { reason: err.message || '未知错误' }),
      originalError: err,
    };
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
