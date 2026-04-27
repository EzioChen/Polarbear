import type { SMTPConfig, ValidationResult } from './types';
import {
  EMAIL_REGEX,
  HOSTNAME_REGEX,
  PORT_MIN,
  PORT_MAX,
  SUPPORTED_AUTH_TYPES,
  SUPPORTED_TLS_VERSIONS,
  SMTP_DEFAULT_PORTS,
} from './constants';

// ============ 邮箱验证 ============

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 验证单个邮箱地址
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: '邮箱地址不能为空' };
  }

  const trimmed = email.trim();

  if (trimmed.length > 254) {
    return { valid: false, error: '邮箱地址总长度不能超过 254 个字符' };
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { valid: false, error: '邮箱地址格式无效，缺少 @ 符号' };
  }

  const [local, domain] = parts;

  if (local.length > 64) {
    return { valid: false, error: '邮箱本地部分长度不能超过 64 个字符' };
  }

  if (domain.length > 255) {
    return { valid: false, error: '邮箱域名部分长度不能超过 255 个字符' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: '邮箱地址格式无效' };
  }

  return { valid: true };
}

/**
 * 批量验证邮箱地址数组
 */
export function validateEmails(emails: string[]): EmailValidationResult {
  for (const email of emails) {
    const result = validateEmail(email);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/**
 * 解析并验证收件人字符串（支持分号或逗号分隔）
 */
export function parseAndValidateRecipients(input: string): { emails: string[]; result: EmailValidationResult } {
  const emails = input
    .split(/[;,]/)
    .map(e => e.trim())
    .filter(e => e.length > 0);

  if (emails.length === 0) {
    return { emails, result: { valid: false, error: '至少需要一个收件人地址' } };
  }

  const validation = validateEmails(emails);
  return { emails, result: validation };
}

// ============ 主机名验证 ============

/**
 * 验证 SMTP 主机名
 */
export function validateHostname(hostname: string): EmailValidationResult {
  if (!hostname || hostname.trim().length === 0) {
    return { valid: false, error: '主机名不能为空' };
  }

  const trimmed = hostname.trim();

  if (trimmed.length > 253) {
    return { valid: false, error: '主机名长度不能超过 253 个字符' };
  }

  if (!HOSTNAME_REGEX.test(trimmed)) {
    return { valid: false, error: '主机名格式无效' };
  }

  // 验证 IP 地址段范围
  const ipv4Match = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    for (let i = 1; i <= 4; i++) {
      const octet = parseInt(ipv4Match[i], 10);
      if (octet < 0 || octet > 255) {
        return { valid: false, error: `IP 地址第 ${i} 段超出范围 (0-255)` };
      }
    }
  }

  return { valid: true };
}

// ============ 端口验证 ============

/**
 * 验证端口号
 */
export function validatePort(port: number): EmailValidationResult {
  if (typeof port !== 'number' || !Number.isInteger(port)) {
    return { valid: false, error: '端口号必须为整数' };
  }

  if (port < PORT_MIN || port > PORT_MAX) {
    return { valid: false, error: `端口号必须在 ${PORT_MIN}-${PORT_MAX} 范围内` };
  }

  return { valid: true };
}

/**
 * 检查端口是否为常用 SMTP 端口
 */
export function isCommonSmtpPort(port: number): boolean {
  return (SMTP_DEFAULT_PORTS as readonly number[]).includes(port);
}

// ============ 配置验证 ============

/**
 * 验证 SMTP 配置的完整性
 */
export function validateSMTPConfig(config: Partial<SMTPConfig>): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];

  // 必填字段验证
  if (!config.version || typeof config.version !== 'string') {
    errors.push({ field: 'version', message: '配置版本号不能为空', code: 'MISSING_FIELD' });
  }

  // smtp 部分
  if (!config.smtp) {
    errors.push({ field: 'smtp', message: 'SMTP 配置不能为空', code: 'MISSING_FIELD' });
  } else {
    // host
    if (!config.smtp.host) {
      errors.push({ field: 'smtp.host', message: 'SMTP 服务器地址不能为空', code: 'MISSING_FIELD' });
    } else {
      const hostValidation = validateHostname(config.smtp.host);
      if (!hostValidation.valid) {
        errors.push({ field: 'smtp.host', message: hostValidation.error!, code: 'INVALID_FORMAT' });
      }
    }

    // port
    if (config.smtp.port === undefined || config.smtp.port === null) {
      errors.push({ field: 'smtp.port', message: '端口号不能为空', code: 'MISSING_FIELD' });
    } else {
      const portValidation = validatePort(config.smtp.port);
      if (!portValidation.valid) {
        errors.push({ field: 'smtp.port', message: portValidation.error!, code: 'INVALID_VALUE' });
      } else if (!isCommonSmtpPort(config.smtp.port)) {
        warnings.push({
          field: 'smtp.port',
          message: `端口 ${config.smtp.port} 不是常用 SMTP 端口`,
          suggestion: '常用端口: 25, 465, 587, 2525',
        });
      }
    }

    // secure 与端口匹配检查
    if (config.smtp.secure && config.smtp.port !== 465) {
      warnings.push({
        field: 'smtp.secure',
        message: '启用 TLS 时通常使用端口 465',
        suggestion: '建议将端口设置为 465',
      });
    }

    // tls 验证
    if (config.smtp.tls) {
      if (config.smtp.tls.rejectUnauthorized === false) {
        warnings.push({
          field: 'smtp.tls.rejectUnauthorized',
          message: '已关闭服务器证书验证',
          suggestion: '在生产环境中建议启用证书验证',
        });
      }

      if (config.smtp.tls.minVersion && !(SUPPORTED_TLS_VERSIONS as readonly string[]).includes(config.smtp.tls.minVersion)) {
        warnings.push({
          field: 'smtp.tls.minVersion',
          message: `不推荐的 TLS 版本: ${config.smtp.tls.minVersion}`,
          suggestion: `建议使用: TLSv1.2 或 TLSv1.3`,
        });
      }
    }
  }

  // auth 部分
  if (!config.auth) {
    errors.push({ field: 'auth', message: '认证配置不能为空', code: 'MISSING_FIELD' });
  } else {
    if (!config.auth.user) {
      errors.push({ field: 'auth.user', message: '邮箱账号不能为空', code: 'MISSING_FIELD' });
    } else {
      const emailValidation = validateEmail(config.auth.user);
      if (!emailValidation.valid) {
        errors.push({ field: 'auth.user', message: emailValidation.error!, code: 'INVALID_FORMAT' });
      }
    }

    if (config.auth.type && !(SUPPORTED_AUTH_TYPES as readonly string[]).includes(config.auth.type)) {
      errors.push({
        field: 'auth.type',
        message: `不支持的认证方式: ${config.auth.type}`,
        code: 'INVALID_VALUE',
      });
    }

    // 条件必填验证
    if (!config.auth.type || config.auth.type === 'login' || config.auth.type === 'plain') {
      if (!config.auth.pass) {
        errors.push({
          field: 'auth.pass',
          message: '密码不能为空（当前认证方式需要密码）',
          code: 'MISSING_FIELD',
        });
      }
    }

    if (config.auth.type === 'oauth2' && !config.auth.accessToken) {
      errors.push({
        field: 'auth.accessToken',
        message: 'OAuth2 认证需要 accessToken',
        code: 'MISSING_FIELD',
      });
    }
  }

  // sender 部分
  if (!config.sender) {
    errors.push({ field: 'sender', message: '发件人配置不能为空', code: 'MISSING_FIELD' });
  } else {
    if (!config.sender.address) {
      errors.push({ field: 'sender.address', message: '发件人地址不能为空', code: 'MISSING_FIELD' });
    } else {
      const senderEmailValidation = validateEmail(config.sender.address);
      if (!senderEmailValidation.valid) {
        errors.push({ field: 'sender.address', message: senderEmailValidation.error!, code: 'INVALID_FORMAT' });
      }
    }

    if (config.sender.name && config.sender.name.length > 100) {
      errors.push({
        field: 'sender.name',
        message: '发件人名称不能超过 100 个字符',
        code: 'INVALID_VALUE',
      });
    }
  }

  // connection 验证
  if (config.connection) {
    if (config.connection.timeout !== undefined && config.connection.timeout <= 0) {
      errors.push({ field: 'connection.timeout', message: '连接超时必须大于 0', code: 'INVALID_VALUE' });
    } else if (config.connection.timeout !== undefined && config.connection.timeout < 5000) {
      warnings.push({
        field: 'connection.timeout',
        message: `连接超时时间过短 (${config.connection.timeout}ms)`,
        suggestion: '建议至少设置为 5000ms',
      });
    }

    if (config.connection.greetingTimeout !== undefined && config.connection.greetingTimeout <= 0) {
      errors.push({ field: 'connection.greetingTimeout', message: '问候超时必须大于 0', code: 'INVALID_VALUE' });
    }

    if (config.connection.socketTimeout !== undefined && config.connection.socketTimeout <= 0) {
      errors.push({ field: 'connection.socketTimeout', message: 'Socket 超时必须大于 0', code: 'INVALID_VALUE' });
    }
  }

  // retry 验证
  if (config.retry) {
    if (config.retry.maxRetries !== undefined && config.retry.maxRetries < 0) {
      errors.push({ field: 'retry.maxRetries', message: '最大重试次数不能为负数', code: 'INVALID_VALUE' });
    } else if (config.retry.maxRetries !== undefined && config.retry.maxRetries > 5) {
      warnings.push({
        field: 'retry.maxRetries',
        message: `重试次数过多 (${config.retry.maxRetries} 次)`,
        suggestion: '建议最大重试次数不超过 5 次',
      });
    }

    if (config.retry.retryDelay !== undefined && config.retry.retryDelay < 0) {
      errors.push({ field: 'retry.retryDelay', message: '重试延迟不能为负数', code: 'INVALID_VALUE' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
