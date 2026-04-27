import type { SMTPConfig, SendEmailOptions, Attachment, ComposeOptions, MailOptions } from './types';
import { MAX_ATTACHMENT_SIZE, ERROR_MESSAGES, formatErrorMessage } from './constants';
import { validateEmail } from './validators';
import { EmailErrorCode } from './types';
import type { EmailError } from './types';

export class MailComposer {
  private config: SMTPConfig;

  constructor(config: SMTPConfig) {
    this.config = config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: SMTPConfig): void {
    this.config = config;
  }

  /**
   * 组装邮件内容
   */
  compose(options: ComposeOptions): MailOptions {
    // 验证必填字段
    this.validateComposeOptions(options);

    // 处理发件人
    const from = this.formatSender();

    // 处理收件人
    const to = this.normalizeRecipients(options.to);

    // 处理抄送
    const cc = options.cc ? this.normalizeRecipients(options.cc) : undefined;

    // 处理密送
    const bcc = options.bcc ? this.normalizeRecipients(options.bcc) : undefined;

    // 处理附件
    const attachments = options.attachments
      ? this.processAttachments(options.attachments)
      : undefined;

    // 处理优先级
    const priority = options.priority;

    // 处理自定义头
    const headers = this.processHeaders(options.headers);

    return {
      from,
      to,
      cc,
      bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments,
      priority,
      headers,
    };
  }

  /**
   * 验证合成选项
   */
  private validateComposeOptions(options: ComposeOptions): void {
    if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
      throw this.createError(
        EmailErrorCode.RECIPIENT_INVALID,
        '收件人不能为空'
      );
    }

    if (!options.subject || options.subject.trim().length === 0) {
      throw this.createError(
        EmailErrorCode.SEND_FAILED,
        '邮件主题不能为空'
      );
    }

    if (!options.text && !options.html) {
      throw this.createError(
        EmailErrorCode.SEND_FAILED,
        '邮件内容不能为空，请提供 text 或 html'
      );
    }

    // 验证收件人邮箱格式
    const allRecipients = [
      ...(Array.isArray(options.to) ? options.to : [options.to]),
      ...(options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : []),
      ...(options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : []),
    ];

    for (const recipient of allRecipients) {
      const validation = validateEmail(recipient);
      if (!validation.valid) {
        throw this.createError(
          EmailErrorCode.RECIPIENT_INVALID,
          formatErrorMessage(ERROR_MESSAGES.RECIPIENT_INVALID, { email: recipient })
        );
      }
    }
  }

  /**
   * 格式化发件人信息
   */
  private formatSender(): string {
    const { sender } = this.config;
    if (sender.name) {
      return `"${sender.name}" <${sender.address}>`;
    }
    return sender.address;
  }

  /**
   * 规范化收件人（始终返回数组）
   */
  private normalizeRecipients(recipients: string | string[]): string[] {
    if (Array.isArray(recipients)) {
      return recipients;
    }
    return recipients.split(/[;,]/).map(r => r.trim()).filter(r => r.length > 0);
  }

  /**
   * 处理附件
   */
  private processAttachments(attachments: Attachment[]): Attachment[] {
    let totalSize = 0;

    return attachments.map(att => {
      // 验证附件来源
      if (!att.content && !att.path && !att.href) {
        throw this.createError(
          EmailErrorCode.ATTACHMENT_NOT_FOUND,
          formatErrorMessage(ERROR_MESSAGES.ATTACHMENT_NOT_FOUND, { path: att.filename })
        );
      }

      // 验证文件大小
      if (att.content && Buffer.isBuffer(att.content)) {
        const size = att.content.length;
        if (size > MAX_ATTACHMENT_SIZE) {
          throw this.createError(
            EmailErrorCode.MESSAGE_TOO_LARGE,
            `附件 "${att.filename}" 大小超过限制 (${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB)`
          );
        }
        totalSize += size;
      }

      return {
        filename: att.filename,
        content: att.content,
        path: att.path,
        href: att.href,
        contentType: att.contentType,
        encoding: att.encoding,
        contentDisposition: att.contentDisposition ?? 'attachment',
        cid: att.cid,
      };
    });
  }

  /**
   * 处理邮件头（防止注入）
   */
  private processHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers || Object.keys(headers).length === 0) {
      return undefined;
    }

    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      // 过滤换行符防止邮件头注入
      const sanitizedValue = value.replace(/[\r\n]/g, '').trim();
      sanitized[key] = sanitizedValue;
    }

    return sanitized;
  }

  /**
   * 创建错误
   */
  private createError(code: EmailErrorCode, message: string): EmailError {
    return { code, message };
  }
}
