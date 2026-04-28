import * as vscode from 'vscode';
import * as path from 'path';
import { EmailService } from '../EmailService';
import { ConfigManager } from '../ConfigManager';
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

  /**
   * 获取或创建 ConfigManager 实例
   */
  private getOrCreateConfigManager(): ConfigManager {
    const emailService = EmailService.getInstance();
    let configManager = emailService.getConfigManager();

    if (!configManager) {
      // EmailService 未初始化，创建独立的 ConfigManager
      const workspacePath = this.getWorkspacePath();
      configManager = new ConfigManager(workspacePath, this.context.secrets);
    }

    return configManager;
  }

  /**
   * 获取工作区路径
   */
  private getWorkspacePath(): string {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    // 如果没有打开的工作区，使用扩展的存储路径
    return this.context.extensionPath;
  }

  private async handleGetConfig(): Promise<void> {
    try {
      const configManager = this.getOrCreateConfigManager();

      // 尝试加载配置，如果失败则返回 null
      let config = configManager.getConfig();
      if (!config) {
        try {
          config = await configManager.loadConfig();
        } catch {
          // 配置文件不存在，返回 null
          config = null;
        }
      }

      this.postMessage('configLoaded', config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取配置失败';
      this.postMessage('configError', { message: errorMessage });
    }
  }

  private async handleSaveConfig(data: Partial<SMTPConfig>): Promise<void> {
    console.log('[EmailConfigPanel] 开始保存配置:', JSON.stringify(data, null, 2));
    try {
      const configManager = this.getOrCreateConfigManager();
      console.log('[EmailConfigPanel] ConfigManager 已获取');

      // 如果配置未加载，先尝试加载
      const currentConfig = configManager.getConfig();
      console.log('[EmailConfigPanel] 当前配置:', currentConfig ? '已加载' : '未加载');
      if (!currentConfig) {
        try {
          await configManager.loadConfig();
          console.log('[EmailConfigPanel] 配置已从文件加载');
        } catch (loadError) {
          console.log('[EmailConfigPanel] 配置文件不存在，将使用默认配置:', loadError);
          // 配置文件不存在，忽略错误，updateConfig 会处理
        }
      }

      console.log('[EmailConfigPanel] 准备更新配置...');
      await configManager.updateConfig(data);
      console.log('[EmailConfigPanel] 配置已更新');

      console.log('[EmailConfigPanel] 准备保存配置...');
      await configManager.saveConfig();
      console.log('[EmailConfigPanel] 配置已保存到文件');

      this.postMessage('configSaved', { success: true });
      vscode.window.showInformationMessage('SMTP 配置已保存');
      console.log('[EmailConfigPanel] 保存成功，已发送消息到前端');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存配置失败';
      console.error('[EmailConfigPanel] 保存失败:', error);
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
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <link rel="stylesheet" href="${styleUri}">
      <title>邮件服务配置</title>
    </head>
    <body>
      <div id="app" data-view="email-config"></div>
      <script nonce="${nonce}">
        window.initialView = 'email-config';
      </script>
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
    this.disposables.forEach(d => d.dispose());
  }
}
