import type { Readable } from 'stream';

// ============ 联系人类型 ============

export interface Contact {
  id: string;
  name: string;
  email: string;
}

// ============ SMTP 配置类型 ============

export interface SMTPConfig {
  version: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    tls?: {
      rejectUnauthorized?: boolean;
      minVersion?: string;
    };
  };
  auth: {
    type: 'login' | 'plain' | 'oauth2';
    user: string;
    pass?: string;
    accessToken?: string;
  };
  sender: {
    name?: string;
    address: string;
  };
  connection?: {
    timeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
  };
  retry?: {
    enabled?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    exponentialBackoff?: boolean;
  };
  logging?: {
    enabled?: boolean;
    level?: string;
    logToFile?: boolean;
    logFilePath?: string | null;
  };
  defaultTo?: Contact[];
  defaultCc?: Contact[];
}

// ============ 邮件发送选项 ============

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
}

// ============ 附件类型 ============

export interface Attachment {
  filename: string;
  content?: Buffer | string | Readable;
  path?: string;
  href?: string;
  contentType?: string;
  encoding?: string;
  contentDisposition?: 'attachment' | 'inline';
  cid?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  path: string;
  size: number;
  contentType: string;
  ready: boolean;
}

// ============ 发送结果 ============

export interface SendResult {
  success: boolean;
  messageId?: string;
  timestamp: string;
  response?: string;
  error?: EmailError;
  accepted: string[];
  rejected: string[];
  duration: number;
}

// ============ 错误类型 ============

export interface EmailError {
  code: EmailErrorCode;
  message: string;
  originalError?: Error;
  details?: Record<string, unknown>;
}

export enum EmailErrorCode {
  // 配置错误
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING_FIELD = 'CONFIG_MISSING_FIELD',

  // 连接错误
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  TLS_ERROR = 'TLS_ERROR',
  DNS_ERROR = 'DNS_ERROR',

  // 认证错误
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_METHOD_NOT_SUPPORTED = 'AUTH_METHOD_NOT_SUPPORTED',

  // 发送错误
  SEND_FAILED = 'SEND_FAILED',
  SEND_TIMEOUT = 'SEND_TIMEOUT',
  RECIPIENT_INVALID = 'RECIPIENT_INVALID',
  RECIPIENT_REJECTED = 'RECIPIENT_REJECTED',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',
  ATTACHMENT_NOT_FOUND = 'ATTACHMENT_NOT_FOUND',

  // 其他错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  SERVICE_NOT_INITIALIZED = 'SERVICE_NOT_INITIALIZED',
}

// ============ 验证结果 ============

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// ============ 连接测试结果 ============

export interface ConnectionResult {
  success: boolean;
  responseTime?: number;
  response?: string;
  error?: EmailError;
}

// ============ 邮件构建配置（内部使用） ============

export interface ComposeOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
}

export interface MailOptions {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
}

// ============ 日志级别 ============

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
