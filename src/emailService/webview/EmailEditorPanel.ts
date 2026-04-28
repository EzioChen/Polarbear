import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EmailService } from '../EmailService';
import type { SendEmailOptions } from '../types';
import { EMAIL_EDITOR_VIEW_TYPE, EMAIL_EDITOR_TITLE } from '../constants';

interface DraftData {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  markdown?: string;
  attachments?: Array<{ id: string; filename: string; path: string; size: number; contentType: string }>;
}

export class EmailEditorPanel {
  public static currentPanel: EmailEditorPanel | undefined;
  private static onEmailSentCallback: ((success: boolean) => void) | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];
  private attachments: DraftData['attachments'] = [];

  public static setOnEmailSentCallback(callback: (success: boolean) => void): void {
    EmailEditorPanel.onEmailSentCallback = callback;
  }

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
          case 'sendEmail':
            await this.handleSendEmail(message.data);
            break;
          case 'saveDraft':
            await this.handleSaveDraft(message.data);
            break;
          case 'addAttachment':
            await this.handleAddAttachment();
            break;
          case 'removeAttachment':
            this.handleRemoveAttachment(message.data.id);
            break;
          case 'checkDraft':
            await this.handleCheckDraft();
            break;
          case 'openConfig':
            vscode.commands.executeCommand('polarbear.email.configure');
            break;
          case 'editorReady':
            await this.handleCheckDraft();
            await this.handleLoadConfig();
            break;
        }
      },
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext): EmailEditorPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (EmailEditorPanel.currentPanel) {
      EmailEditorPanel.currentPanel.panel.reveal(column);
      return EmailEditorPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      EMAIL_EDITOR_VIEW_TYPE,
      EMAIL_EDITOR_TITLE,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(context.extensionPath),
        ],
      }
    );

    EmailEditorPanel.currentPanel = new EmailEditorPanel(panel, extensionUri, context);
    return EmailEditorPanel.currentPanel;
  }

  private postMessage(type: string, data?: unknown): void {
    this.panel.webview.postMessage({ type, data });
  }

  private async handleSendEmail(data: {
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    markdown: string;
  }): Promise<void> {
    const emailService = EmailService.getInstance();

    if (!emailService.isInitialized()) {
      vscode.window.showErrorMessage('邮件服务未初始化');
      return;
    }

    if (!data.to.trim()) {
      vscode.window.showWarningMessage('请输入收件人地址');
      return;
    }

    if (!data.subject.trim()) {
      vscode.window.showWarningMessage('请输入邮件主题');
      return;
    }

    if (!data.markdown.trim()) {
      vscode.window.showWarningMessage('请输入邮件内容');
      return;
    }

    const toList = data.to.split(/[;,]/).map(e => e.trim()).filter(e => e.length > 0);
    const ccList = data.cc ? data.cc.split(/[;,]/).map(e => e.trim()).filter(e => e.length > 0) : undefined;
    const bccList = data.bcc ? data.bcc.split(/[;,]/).map(e => e.trim()).filter(e => e.length > 0) : undefined;

    const options: SendEmailOptions = {
      to: toList,
      cc: ccList && ccList.length > 0 ? ccList : undefined,
      bcc: bccList && bccList.length > 0 ? bccList : undefined,
      subject: data.subject,
      text: data.markdown,
      attachments: this.attachments?.map(att => ({
        filename: att.filename,
        path: att.path,
      })),
    };

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '正在发送邮件...',
      cancellable: false,
    }, async () => {
      const result = await emailService.sendEmail(options);

      if (result.success) {
        vscode.window.showInformationMessage(
          `邮件发送成功！消息ID: ${result.messageId}`,
          '查看详情'
        ).then(selection => {
          if (selection === '查看详情') {
            emailService.showLogs();
          }
        });

        // 通知回调
        if (EmailEditorPanel.onEmailSentCallback) {
          EmailEditorPanel.onEmailSentCallback(true);
        }

        await this.context.globalState.update('polarbear.email.draft', undefined);
        this.panel.dispose();
      } else {
        const errorMsg = result.error?.message || '发送失败';
        vscode.window.showErrorMessage(
          `发送失败: ${errorMsg}`,
          '重试',
          '查看详情'
        ).then(selection => {
          if (selection === '重试') {
            this.handleSendEmail(data);
          } else if (selection === '查看详情') {
            emailService.showLogs();
          }
        });
      }

      return result;
    });
  }

  private async handleSaveDraft(data: {
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    markdown: string;
  }): Promise<void> {
    const draft: DraftData = {
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      subject: data.subject,
      markdown: data.markdown,
      attachments: this.attachments,
    };

    try {
      await this.context.globalState.update('polarbear.email.draft', draft);
      vscode.window.showInformationMessage('草稿已保存');
      this.postMessage('draftSaved');
    } catch (error) {
      vscode.window.showErrorMessage(`保存草稿失败: ${(error as Error).message}`);
    }
  }

  private async handleAddAttachment(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      openLabel: '添加附件',
      filters: {
        '所有文件': ['*'],
      },
    });

    if (!uris || uris.length === 0) return;

    for (const uri of uris) {
      const stat = fs.statSync(uri.fsPath);

      if (stat.size > 10 * 1024 * 1024) {
        vscode.window.showWarningMessage(`附件 "${path.basename(uri.fsPath)}" 大小超过 10MB 限制`);
        continue;
      }

      const attachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        filename: path.basename(uri.fsPath),
        path: uri.fsPath,
        size: stat.size,
        contentType: this.getMimeType(uri.fsPath),
      };

      this.attachments = [...(this.attachments || []), attachment];
    }

    const totalSize = (this.attachments || []).reduce((sum, att) => sum + att.size, 0);
    if (totalSize > 25 * 1024 * 1024) {
      vscode.window.showWarningMessage('附件总大小超过 25MB 限制，部分附件可能未添加');
    }

    this.postMessage('attachmentsUpdated', { attachments: this.attachments });
  }

  private handleRemoveAttachment(id: string): void {
    this.attachments = (this.attachments || []).filter(a => a.id !== id);
    this.postMessage('attachmentsUpdated', { attachments: this.attachments });
  }

  private async handleCheckDraft(): Promise<void> {
    try {
      const draft = this.context.globalState.get<DraftData | undefined>('polarbear.email.draft');
      if (draft) {
        this.postMessage('loadDraft', draft);
      }
    } catch {
      // ignore
    }
  }

  private async handleLoadConfig(): Promise<void> {
    try {
      const emailService = EmailService.getInstance();
      const configManager = emailService.getConfigManager();
      
      if (configManager) {
        const config = configManager.getConfig();
        if (config) {
          // 提取默认收件人和抄送人
          const defaultRecipients = {
            defaultTo: config.defaultTo || [],
            defaultCc: config.defaultCc || [],
          };
          this.postMessage('configLoaded', defaultRecipients);
        }
      }
    } catch (error) {
      console.error('[EmailEditorPanel] 加载配置失败:', error);
      // 忽略错误，不影响编辑器使用
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
    };
    return mimeTypes[ext] || 'application/octet-stream';
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
      <title>邮件编辑器</title>
      <link rel="stylesheet" href="${styleUri}">
    </head>
    <body>
      <div id="app" data-page="email-editor"></div>
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
    EmailEditorPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }
}
