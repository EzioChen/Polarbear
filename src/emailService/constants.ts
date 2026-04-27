import type { SMTPConfig } from './types';

// ============ 默认配置 ============

export const DEFAULT_SMTP_CONFIG: Partial<SMTPConfig> = {
  version: '1.0.0',
  smtp: {
    host: '',
    port: 587,
    secure: false,
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
  },
  auth: {
    type: 'login',
    user: '',
    pass: '',
    accessToken: undefined,
  },
  sender: {
    name: 'PolarBear 发布系统',
    address: '',
  },
  connection: {
    timeout: 30000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  },
  retry: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 5000,
    exponentialBackoff: true,
  },
  logging: {
    enabled: true,
    level: 'info',
    logToFile: false,
    logFilePath: null,
  },
};

// ============ 默认端口 ============

export const SMTP_DEFAULT_PORTS = [25, 465, 587, 2525] as const;

// ============ 错误消息模板 ============

export const ERROR_MESSAGES: Record<string, string> = {
  // 配置错误
  CONFIG_NOT_FOUND: '配置文件不存在: {path}',
  CONFIG_INVALID: '配置文件格式错误: {reason}',
  CONFIG_MISSING_FIELD: '缺少必填配置项: {field}',

  // 连接错误
  CONNECTION_FAILED: '无法连接到SMTP服务器: {host}:{port}',
  CONNECTION_TIMEOUT: '连接超时，请检查网络或服务器状态',
  TLS_ERROR: 'TLS握手失败: {reason}',
  DNS_ERROR: 'DNS解析失败: {host}',

  // 认证错误
  AUTH_FAILED: '认证失败: {reason}',
  AUTH_INVALID_CREDENTIALS: '用户名或密码错误',
  AUTH_METHOD_NOT_SUPPORTED: '不支持的认证方式: {method}',

  // 发送错误
  SEND_FAILED: '邮件发送失败: {reason}',
  SEND_TIMEOUT: '邮件发送超时',
  RECIPIENT_INVALID: '收件人地址无效: {email}',
  RECIPIENT_REJECTED: '收件人被服务器拒绝: {email}',
  MESSAGE_TOO_LARGE: '邮件大小超过限制',
  ATTACHMENT_NOT_FOUND: '附件文件不存在: {path}',

  // 其他错误
  UNKNOWN_ERROR: '未知错误: {message}',
  RETRY_EXHAUSTED: '重试次数已用尽，发送失败',
  SERVICE_NOT_INITIALIZED: '邮件服务未初始化，请先调用 initialize()',
};

/**
 * 格式化错误消息
 */
export function formatErrorMessage(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

// ============ 验证规则 ============

/** 邮箱正则（RFC 5322 简化版） */
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** 主机名正则 */
export const HOSTNAME_REGEX = /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|(?:\d{1,3}\.){3}\d{1,3})$/;

/** 端口范围 */
export const PORT_MIN = 1;
export const PORT_MAX = 65535;

/** 文件大小限制（字节） */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_TOTAL_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB

/** 支持的认证类型 */
export const SUPPORTED_AUTH_TYPES = ['login', 'plain', 'oauth2'] as const;

/** 支持的 TLS 版本 */
export const SUPPORTED_TLS_VERSIONS = ['TLSv1.0', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'] as const;

// ============ 业务常量 ============

/** 默认配置文件路径（相对于工作区根目录） */
export const DEFAULT_CONFIG_PATH = '.releasePlan/smtp-config.json';

/** 日志通道名称 */
export const LOG_CHANNEL_NAME = 'PolarBear Email';

/** SecretStorage 键名 */
export const SECRET_STORAGE_KEY = 'polarbear.smtp.password';

/** 邮件优先级映射 */
export const PRIORITY_MAP: Record<string, string> = {
  high: '1 (Highest)',
  normal: '3 (Normal)',
  low: '5 (Lowest)',
};

/** 邮件编辑器 Webview 配置 */
export const EMAIL_EDITOR_VIEW_TYPE = 'polarbear.emailEditor';
export const EMAIL_EDITOR_TITLE = '邮件编辑器';
