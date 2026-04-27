import * as vscode from 'vscode';
import { EmailService } from '../EmailService';
import type { SMTPConfig } from '../types';

export class EmailConfigPanel {
  public static currentPanel: EmailConfigPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.context = context;

    this.panel.webview.html = this.getHtmlContent();

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'getConfig':
            await this.handleGetConfig();
            break;
          case 'saveConfig':
            await this.handleSaveConfig(message.data);
            break;
          case 'testConnection':
            await this.handleTestConnection();
            break;
          case 'validateConfig':
            await this.handleValidateConfig(message.data);
            break;
        }
      },
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext): EmailConfigPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (EmailConfigPanel.currentPanel) {
      EmailConfigPanel.currentPanel.panel.reveal(column);
      return EmailConfigPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'polarbear.emailConfig',
      '邮件服务配置',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(context.extensionPath),
        ],
      }
    );

    EmailConfigPanel.currentPanel = new EmailConfigPanel(panel, extensionUri, context);
    return EmailConfigPanel.currentPanel;
  }

  private postMessage(type: string, data?: unknown): void {
    this.panel.webview.postMessage({ type, data });
  }

  private async handleGetConfig(): Promise<void> {
    try {
      const emailService = EmailService.getInstance();
      const configManager = emailService.getConfigManager();
      
      if (!configManager) {
        this.postMessage('configError', { message: '配置管理器未初始化' });
        return;
      }

      const config = configManager.getConfig();
      this.postMessage('configLoaded', config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取配置失败';
      this.postMessage('configError', { message: errorMessage });
    }
  }

  private async handleSaveConfig(data: Partial<SMTPConfig>): Promise<void> {
    try {
      const emailService = EmailService.getInstance();
      const configManager = emailService.getConfigManager();
      
      if (!configManager) {
        this.postMessage('saveError', { message: '配置管理器未初始化' });
        return;
      }

      await configManager.updateConfig(data);
      await configManager.saveConfig();
      
      this.postMessage('configSaved', { success: true });
      vscode.window.showInformationMessage('SMTP 配置已保存');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存配置失败';
      this.postMessage('saveError', { message: errorMessage });
    }
  }

  private async handleTestConnection(): Promise<void> {
    try {
      const emailService = EmailService.getInstance();
      const result = await emailService.testConnection();

      if (result.success) {
        const message = `连接成功！响应时间: ${result.responseTime}ms`;
        this.postMessage('testSuccess', { message });
        vscode.window.showInformationMessage(message);
      } else {
        const message = result.error?.message || '连接失败';
        this.postMessage('testError', { message });
        vscode.window.showErrorMessage(message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '连接测试失败';
      this.postMessage('testError', { message: errorMessage });
      vscode.window.showErrorMessage(errorMessage);
    }
  }

  private async handleValidateConfig(data: Partial<SMTPConfig>): Promise<void> {
    const errors: string[] = [];

    if (!data.smtp?.host) {
      errors.push('SMTP 服务器地址不能为空');
    }

    if (!data.smtp?.port || data.smtp.port < 1 || data.smtp.port > 65535) {
      errors.push('端口号必须在 1-65535 范围内');
    }

    if (!data.auth?.user) {
      errors.push('邮箱账号不能为空');
    }

    if (!data.auth?.pass) {
      errors.push('密码不能为空');
    }

    if (!data.sender?.address) {
      errors.push('发件人地址不能为空');
    }

    this.postMessage('validationResult', { valid: errors.length === 0, errors });
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>邮件服务配置</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
    }

    h1 {
      font-size: 20px;
      margin-bottom: 24px;
      color: var(--vscode-foreground);
      font-weight: 600;
    }

    .section {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-size: 13px;
      margin-bottom: 6px;
      color: var(--vscode-foreground);
    }

    label .required {
      color: var(--vscode-errorForeground);
      margin-left: 2px;
    }

    input[type="text"],
    input[type="password"],
    input[type="number"],
    select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--vscode-input-border);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-size: 13px;
      font-family: inherit;
    }

    input:focus,
    select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .input-hint {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    button.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    button.primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    button.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-message {
      color: var(--vscode-errorForeground);
      font-size: 12px;
      margin-top: 4px;
      display: none;
    }

    .error-message.show {
      display: block;
    }

    .success-message {
      color: var(--vscode-testing-iconPassed);
      font-size: 12px;
      margin-top: 4px;
      display: none;
    }

    .success-message.show {
      display: block;
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      margin-top: 8px;
    }

    .status-indicator.success {
      background-color: var(--vscode-testing-iconPassed);
      color: var(--vscode-button-foreground);
    }

    .status-indicator.error {
      background-color: var(--vscode-errorForeground);
      color: var(--vscode-button-foreground);
    }

    .loading {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid var(--vscode-button-foreground);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📧 邮件服务配置</h1>

    <div class="section">
      <div class="section-title">📡 SMTP 服务器设置</div>
      
      <div class="form-group">
        <label>服务器地址 <span class="required">*</span></label>
        <input type="text" id="host" placeholder="例如: 192.168.8.208">
        <div class="input-hint">SMTP 服务器主机名或 IP 地址</div>
        <div class="error-message" id="host-error"></div>
      </div>

      <div class="form-group">
        <label>端口 <span class="required">*</span></label>
        <input type="number" id="port" placeholder="25" min="1" max="65535">
        <div class="input-hint">常用端口: 25(默认), 465(SSL), 587(TLS)</div>
        <div class="error-message" id="port-error"></div>
      </div>

      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="secure">
          <label for="secure" style="margin-bottom: 0;">使用 SSL/TLS 加密连接</label>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🔐 认证信息</div>
      
      <div class="form-group">
        <label>邮箱账号 <span class="required">*</span></label>
        <input type="text" id="user" placeholder="your-email@example.com">
        <div class="error-message" id="user-error"></div>
      </div>

      <div class="form-group">
        <label>密码 <span class="required">*</span></label>
        <input type="password" id="pass" placeholder="输入邮箱密码">
        <div class="input-hint">密码将加密存储在 VS Code SecretStorage 中</div>
        <div class="error-message" id="pass-error"></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">✉️ 发件人设置</div>
      
      <div class="form-group">
        <label>发件人名称</label>
        <input type="text" id="senderName" placeholder="PolarBear 发布系统">
        <div class="input-hint">显示在邮件中的发件人名称</div>
      </div>

      <div class="form-group">
        <label>发件人地址 <span class="required">*</span></label>
        <input type="text" id="senderAddress" placeholder="noreply@example.com">
        <div class="error-message" id="senderAddress-error"></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">⚙️ 高级设置</div>
      
      <div class="form-group">
        <label>连接超时（毫秒）</label>
        <input type="number" id="timeout" placeholder="30000" min="1000" step="1000">
        <div class="input-hint">默认: 30000ms (30秒)</div>
      </div>

      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="rejectUnauthorized">
          <label for="rejectUnauthorized" style="margin-bottom: 0;">验证服务器证书</label>
        </div>
        <div class="input-hint">取消勾选可允许自签名证书（不推荐用于生产环境）</div>
      </div>
    </div>

    <div class="button-group">
      <button class="primary" id="saveBtn" onclick="saveConfig()">💾 保存配置</button>
      <button class="secondary" id="testBtn" onclick="testConnection()">🔌 测试连接</button>
    </div>

    <div id="statusContainer"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // 页面加载时获取配置
    window.addEventListener('DOMContentLoaded', () => {
      vscode.postMessage({ type: 'getConfig' });
    });

    // 监听来自扩展的消息
    window.addEventListener('message', (event) => {
      const message = event.data;
      
      switch (message.type) {
        case 'configLoaded':
          fillForm(message.data);
          break;
        case 'configSaved':
          showStatus('success', '配置已保存');
          setLoading(false);
          break;
        case 'saveError':
          showStatus('error', message.data.message);
          setLoading(false);
          break;
        case 'testSuccess':
          showStatus('success', message.data.message);
          setLoading(false);
          break;
        case 'testError':
          showStatus('error', message.data.message);
          setLoading(false);
          break;
        case 'validationResult':
          handleValidationResult(message.data);
          break;
      }
    });

    function fillForm(config) {
      if (!config) return;
      
      document.getElementById('host').value = config.smtp?.host || '';
      document.getElementById('port').value = config.smtp?.port || '25';
      document.getElementById('secure').checked = config.smtp?.secure === true;
      document.getElementById('user').value = config.auth?.user || '';
      document.getElementById('pass').value = config.auth?.pass || '';
      document.getElementById('senderName').value = config.sender?.name || '';
      document.getElementById('senderAddress').value = config.sender?.address || '';
      document.getElementById('timeout').value = config.connection?.timeout || '30000';
      document.getElementById('rejectUnauthorized').checked = 
        config.smtp?.tls?.rejectUnauthorized === true;
    }

    function getFormData() {
      return {
        smtp: {
          host: document.getElementById('host').value.trim(),
          port: parseInt(document.getElementById('port').value) || 25,
          secure: document.getElementById('secure').checked,
          tls: {
            rejectUnauthorized: document.getElementById('rejectUnauthorized').checked
          }
        },
        auth: {
          user: document.getElementById('user').value.trim(),
          pass: document.getElementById('pass').value,
          type: 'login'
        },
        sender: {
          name: document.getElementById('senderName').value.trim() || 'PolarBear 发布系统',
          address: document.getElementById('senderAddress').value.trim()
        },
        connection: {
          timeout: parseInt(document.getElementById('timeout').value) || 30000
        }
      };
    }

    function validateForm() {
      clearErrors();
      const data = getFormData();
      let isValid = true;

      if (!data.smtp.host) {
        showError('host', '服务器地址不能为空');
        isValid = false;
      }

      if (!data.smtp.port || data.smtp.port < 1 || data.smtp.port > 65535) {
        showError('port', '端口号必须在 1-65535 范围内');
        isValid = false;
      }

      if (!data.auth.user) {
        showError('user', '邮箱账号不能为空');
        isValid = false;
      }

      if (!data.auth.pass) {
        showError('pass', '密码不能为空');
        isValid = false;
      }

      if (!data.sender.address) {
        showError('senderAddress', '发件人地址不能为空');
        isValid = false;
      }

      return isValid ? data : null;
    }

    function showError(fieldId, message) {
      const errorEl = document.getElementById(fieldId + '-error');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
      }
    }

    function clearErrors() {
      document.querySelectorAll('.error-message').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
      });
    }

    function showStatus(type, message) {
      const container = document.getElementById('statusContainer');
      container.innerHTML = \`<div class="status-indicator \${type}">\${message}</div>\`;
      
      setTimeout(() => {
        container.innerHTML = '';
      }, 5000);
    }

    function setLoading(loading) {
      const saveBtn = document.getElementById('saveBtn');
      const testBtn = document.getElementById('testBtn');
      
      saveBtn.disabled = loading;
      testBtn.disabled = loading;
      
      if (loading) {
        saveBtn.innerHTML = '<span class="loading"></span> 保存中...';
      } else {
        saveBtn.innerHTML = '💾 保存配置';
      }
    }

    function saveConfig() {
      const data = validateForm();
      if (!data) return;

      setLoading(true);
      vscode.postMessage({ type: 'saveConfig', data });
    }

    function testConnection() {
      const data = validateForm();
      if (!data) return;

      setLoading(true);
      vscode.postMessage({ type: 'testConnection' });
    }
  </script>
</body>
</html>`;
  }

  dispose(): void {
    EmailConfigPanel.currentPanel = undefined;
    this.panel.dispose();
    
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
