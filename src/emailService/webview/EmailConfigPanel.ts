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

  private getHtmlContent(): string {
    // 使用主 webview 的 Vue 构建产物
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'main.js')
    );
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'style.css')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; img-src ${this.panel.webview.cspSource} data:; font-src ${this.panel.webview.cspSource};">
      <title>邮件服务配置</title>
      <link rel="stylesheet" href="${styleUri}">
    </head>
    <body>
      <div id="app" data-page="email-config"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
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
