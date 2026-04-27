// ============ 邮件服务模块导出 ============

// 类导出
export { EmailService } from './EmailService';
export { ConfigManager } from './ConfigManager';
export { MailComposer } from './MailComposer';
export { MailSender } from './MailSender';
export { EmailEditorPanel } from './webview/EmailEditorPanel';

// 类型导出
export type {
  SMTPConfig,
  SendEmailOptions,
  SendResult,
  EmailError,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ConnectionResult,
  Attachment,
  EmailAttachment,
  ComposeOptions,
  MailOptions,
  LogLevel,
} from './types';
export { EmailErrorCode } from './types';

// 常量导出
export {
  DEFAULT_SMTP_CONFIG,
  ERROR_MESSAGES,
  formatErrorMessage,
  EMAIL_REGEX,
  HOSTNAME_REGEX,
  SMTP_DEFAULT_PORTS,
  MAX_ATTACHMENT_SIZE,
  MAX_TOTAL_ATTACHMENT_SIZE,
  SUPPORTED_AUTH_TYPES,
  SUPPORTED_TLS_VERSIONS,
  DEFAULT_CONFIG_PATH,
  LOG_CHANNEL_NAME,
  SECRET_STORAGE_KEY,
  PRIORITY_MAP,
  EMAIL_EDITOR_VIEW_TYPE,
  EMAIL_EDITOR_TITLE,
} from './constants';

// 验证函数导出
export {
  validateEmail,
  validateEmails,
  parseAndValidateRecipients,
  validateHostname,
  validatePort,
  isCommonSmtpPort,
  validateSMTPConfig,
} from './validators';
export type { EmailValidationResult } from './validators';
