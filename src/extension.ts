import * as vscode from 'vscode';
import { PolarBearViewProvider } from './polarbearViewProvider';
import { PublishFlowManager } from './publishFlow/PublishFlowManager';
import type { WebviewMessage } from './publishFlow/types';
import { scanWorkspace, addFolderRecursiveToTarget } from './publishFlow/fileUtils';
import * as path from 'path';
import * as fs from 'fs';
import { ReleaseNotesManager } from './releaseNotes/ReleaseNotesManager';
import type { ReleaseNotesMessage } from './releaseNotes/types';
import { EmailService } from './emailService/EmailService';
import { EmailEditorPanel } from './emailService/webview/EmailEditorPanel';
import { EmailConfigPanel } from './emailService/webview/EmailConfigPanel';
import { ConfigManager } from './emailService/ConfigManager';
import type { SendEmailOptions } from './emailService/types';
import { parseAndValidateRecipients, validateSMTPConfig } from './emailService/validators';
import { PackService } from './packService';
import { ReleaseNotesService } from './releaseNotesService';

// 全局管理器实例
let publishFlowManager: PublishFlowManager | undefined;
let packService: PackService | undefined;
let releaseNotesService: ReleaseNotesService | undefined;
let publishTimelinePanel: vscode.WebviewPanel | undefined;

// 发布主题存储文件路径
function getReleaseSubjectFilePath(workspacePath: string): string {
  return path.join(workspacePath, '.releasePlan', 'release-subject.json');
}

// 读取发布主题
function loadReleaseSubject(workspacePath: string): string {
  try {
    const filePath = getReleaseSubjectFilePath(workspacePath);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.subject || '';
    }
  } catch (error) {
    console.error('[Extension] 读取发布主题失败:', error);
  }
  return '';
}

// 保存发布主题
function saveReleaseSubject(workspacePath: string, subject: string): void {
  try {
    const filePath = getReleaseSubjectFilePath(workspacePath);
    const data = { subject, updatedAt: new Date().toISOString() };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('[Extension] 发布主题已保存:', subject);
  } catch (error) {
    console.error('[Extension] 保存发布主题失败:', error);
  }
}

// 生成邮件正文
function generateEmailBody(releaseSubject: string, releaseNotesContent: string): string {
  // 提取发布说明中的关键信息
  const lines = releaseNotesContent.split('\n');
  let summary = '';
  let inSummary = false;

  for (const line of lines) {
    // 跳过标题和元数据行
    if (line.startsWith('#') || line.startsWith('>') || line.trim() === '' || line.startsWith('---')) {
      continue;
    }
    // 提取列表项作为摘要
    if (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) {
      summary += line + '\n';
    }
  }

  // 如果没有提取到摘要，使用默认内容
  if (!summary.trim()) {
    summary = '- 本次发布包含重要的功能更新和问题修复\n';
  }

  // 生成商务格式的邮件正文
  const now = new Date();
  const hour = now.getHours();
  let greeting = '上午好';
  if (hour >= 12 && hour < 14) {
    greeting = '中午好';
  } else if (hour >= 14 && hour < 18) {
    greeting = '下午好';
  } else if (hour >= 18) {
    greeting = '晚上好';
  }

  return `各位同事${greeting}！

附件是 **${releaseSubject}** 的开发SDK，请查阅！

## 📋 版本摘要

${summary}

## 📎 附件说明

- SDK 压缩包已包含完整的开发资料
- 详细的发布说明请查看附件中的文档

如有任何问题，请及时反馈。

---
**PolarBear 发布系统**
${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "polarbear" is now active!');

  // 原有命令
  const disposable = vscode.commands.registerCommand('polarbear.startPolar', () => {
    vscode.window.showInformationMessage('Start Polar from polarbear!');
  });

  const testLoginDisposable = vscode.commands.registerCommand('polarbear.testLogin', async () => {
    const username = await vscode.window.showInputBox({
      prompt: '请输入账号',
      placeHolder: 'Username'
    });

    if (!username) {
      vscode.window.showWarningMessage('未输入账号，操作取消');
      return;
    }

    const password = await vscode.window.showInputBox({
      prompt: '请输入密码',
      placeHolder: 'Password',
      password: true
    });

    if (!password) {
      vscode.window.showWarningMessage('未输入密码，操作取消');
      return;
    }

    vscode.window.showInformationMessage(`登录成功！账号: ${username}`);
  });

  const openSettingsDisposable = vscode.commands.registerCommand('polarbear.openSettings', () => {
    vscode.window.showInformationMessage('打开设置页面');
  });

  const addPublishFlowDisposable = vscode.commands.registerCommand('polarbear.addPublishFlow', async () => {
    const flowName = await vscode.window.showInputBox({
      prompt: '请输入发布流程名称',
      placeHolder: '例如: 生产环境发布'
    });

    if (!flowName) {
      vscode.window.showWarningMessage('未输入流程名称，操作取消');
      return;
    }

    vscode.window.showInformationMessage(`已添加发布流程: ${flowName}`);
  });

  // 注册打开发布流程配置命令
  const openPublishFlowDisposable = vscode.commands.registerCommand(
    'polarbear.openPublishFlow',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('请先打开一个工作区');
        return;
      }

      // 初始化管理器
      publishFlowManager = new PublishFlowManager(workspaceFolder.uri.fsPath);

      // 创建 Webview Panel
      const panel = vscode.window.createWebviewPanel(
        'polarbear.publishFlow',
        '配置发布流程',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          enableCommandUris: true,
          enableFindWidget: true,
          localResourceRoots: [
            vscode.Uri.file(context.extensionPath)
          ]
        }
      );

      // 保存 panel 引用
      publishTimelinePanel = panel;

      // 清理引用当 panel 关闭时
      panel.onDidDispose(() => {
        publishTimelinePanel = undefined;
      });

      // 设置 HTML 内容
      panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

      // 处理消息
      panel.webview.onDidReceiveMessage(
        async (message: WebviewMessage) => {
          switch (message.type) {
            case 'getWorkspaceFiles':
              const files = await scanWorkspace(workspaceFolder.uri.fsPath);
              panel.webview.postMessage({
                type: 'workspaceFiles',
                payload: files
              });
              break;

            case 'getPublishConfig':
              panel.webview.postMessage({
                type: 'configUpdated',
                payload: publishFlowManager?.getConfig()
              });
              break;

            case 'saveConfig':
              try {
                await publishFlowManager?.save();
                vscode.window.showInformationMessage('配置已保存');
              } catch (error) {
                vscode.window.showErrorMessage(`保存失败: ${error}`);
              }
              break;

            case 'addFolder':
              const folderName = await vscode.window.showInputBox({
                prompt: '请输入文件夹名称',
                placeHolder: '例如: code, libs, docs',
                validateInput: (value) => {
                  if (!value || value.trim() === '') {
                    return '文件夹名称不能为空';
                  }
                  if (value.includes('/') || value.includes('\\')) {
                    return '文件夹名称不能包含路径分隔符';
                  }
                  return null;
                }
              });

              if (folderName) {
                publishFlowManager?.addFolder(folderName.trim());
                await publishFlowManager?.save();

                panel.webview.postMessage({
                  type: 'configUpdated',
                  payload: publishFlowManager?.getConfig()
                });

                vscode.window.showInformationMessage(`已创建文件夹: ${folderName}`);
              }
              break;

            case 'selectFiles':
              const selectedFiles = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: true,
                canSelectMany: true,
                openLabel: '添加到发布清单',
                defaultUri: workspaceFolder.uri
              });

              if (selectedFiles && selectedFiles.length > 0) {
                for (const file of selectedFiles) {
                  const filePath = file.fsPath;
                  const stats = fs.statSync(filePath);

                  if (stats.isDirectory()) {
                    await addFolderRecursiveToTarget(
                      filePath,
                      publishFlowManager!,
                      undefined
                    );
                  } else {
                    const targetPath = path.basename(filePath);
                    publishFlowManager?.addFile(filePath, targetPath);
                  }
                }

                await publishFlowManager?.save();

                panel.webview.postMessage({
                  type: 'configUpdated',
                  payload: publishFlowManager?.getConfig()
                });

                vscode.window.showInformationMessage(`已添加 ${selectedFiles.length} 个文件/文件夹`);
              }
              break;

            case 'addFromProject':
              if (message.payload?.sourcePath) {
                const itemStats = fs.statSync(message.payload.sourcePath);

                if (itemStats.isDirectory()) {
                  // 如果有完整的节点数据，使用 addFolderFromNode 保持层级结构
                  if (message.payload.nodeData && message.payload.nodeData.children) {
                    publishFlowManager?.addFolderFromNode(
                      message.payload.nodeData,
                      message.payload.targetPath
                    );
                  } else {
                    // 否则使用原来的方式
                    await addFolderRecursiveToTarget(
                      message.payload.sourcePath,
                      publishFlowManager!,
                      message.payload.targetPath
                    );
                  }
                } else {
                  const singleTargetPath = message.payload.targetPath
                    ? path.join(message.payload.targetPath, path.basename(message.payload.sourcePath))
                    : path.basename(message.payload.sourcePath);

                  publishFlowManager?.addFile(message.payload.sourcePath, singleTargetPath);
                }

                await publishFlowManager?.save();
                panel.webview.postMessage({
                  type: 'configUpdated',
                  payload: publishFlowManager?.getConfig()
                });
              }
              break;

            case 'moveInPublishList':
              const { itemId: moveItemId, targetPath: moveTargetPath, isBatch, itemIds } = message.payload;

              if (isBatch && itemIds && itemIds.length > 1) {
                // 批量移动
                const nodesToMove: any[] = [];
                for (const id of itemIds) {
                  const node = publishFlowManager?.findNodeById(id);
                  if (node) {
                    nodesToMove.push(node);
                  }
                }

                // 先移除所有节点
                for (const id of itemIds) {
                  publishFlowManager?.removeNode(id);
                }

                // 添加到目标位置
                if (moveTargetPath) {
                  const targetFolder = publishFlowManager?.findNodeByPath(moveTargetPath);
                  if (targetFolder && targetFolder.children) {
                    targetFolder.children.push(...nodesToMove);
                  }
                } else {
                  publishFlowManager?.getConfig().files.push(...nodesToMove);
                }
              } else {
                // 单个移动
                const nodeToMove = publishFlowManager?.findNodeById(moveItemId);

                if (nodeToMove) {
                  publishFlowManager?.removeNode(moveItemId);

                  if (moveTargetPath) {
                    const targetFolder = publishFlowManager?.findNodeByPath(moveTargetPath);
                    if (targetFolder && targetFolder.children) {
                      targetFolder.children.push(nodeToMove);
                    }
                  } else {
                    publishFlowManager?.getConfig().files.push(nodeToMove);
                  }
                }
              }

              await publishFlowManager?.save();
              panel.webview.postMessage({
                type: 'configUpdated',
                payload: publishFlowManager?.getConfig()
              });
              break;

            case 'deleteItem':
              if (message.payload?.itemId) {
                publishFlowManager?.removeNode(message.payload.itemId);
                await publishFlowManager?.save();
                panel.webview.postMessage({
                  type: 'configUpdated',
                  payload: publishFlowManager?.getConfig()
                });
              }
              break;

            case 'deleteBatch':
              if (message.payload?.itemIds && Array.isArray(message.payload.itemIds)) {
                for (const id of message.payload.itemIds) {
                  publishFlowManager?.removeNode(id);
                }
                await publishFlowManager?.save();
                panel.webview.postMessage({
                  type: 'configUpdated',
                  payload: publishFlowManager?.getConfig()
                });
              }
              break;

            case 'confirmClear':
              const confirmResult = await vscode.window.showWarningMessage(
                message.payload?.message || '确定要清空发布清单吗？',
                { modal: true },
                '清空',
                '取消'
              );

              if (confirmResult === '清空') {
                const config = publishFlowManager?.getConfig();
                if (config) {
                  config.files = [];
                }
                await publishFlowManager?.save();
                panel.webview.postMessage({
                  type: 'configUpdated',
                  payload: publishFlowManager?.getConfig()
                });
              }
              break;
          }
        },
        undefined,
        context.subscriptions
      );
    }
  );

  // 注册发布说明命令
  const openReleaseNotesDisposable = vscode.commands.registerCommand(
    'polarbear.openReleaseNotes',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('请先打开一个工作区');
        return;
      }

      // 初始化发布说明管理器
      const releaseNotesManager = new ReleaseNotesManager(workspaceFolder.uri.fsPath);

      // 创建 Webview Panel
      const panel = vscode.window.createWebviewPanel(
        'polarbear.releaseNotes',
        '发布说明',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          enableCommandUris: true,
          enableFindWidget: true,
          localResourceRoots: [
            vscode.Uri.file(context.extensionPath)
          ]
        }
      );

      // 设置 HTML 内容
      panel.webview.html = getReleaseNotesWebviewContent(panel.webview, context.extensionUri);

      // 处理消息
      panel.webview.onDidReceiveMessage(
        async (message: ReleaseNotesMessage) => {
          switch (message.type) {
            case 'getReleaseNotesConfig':
              panel.webview.postMessage({
                type: 'releaseNotesConfigUpdated',
                payload: releaseNotesManager.getConfig()
              });
              break;

            case 'saveReleaseNotes':
              try {
                // 验证数据
                releaseNotesManager.updateConfig(message.payload);
                const validation = releaseNotesManager.validate();

                if (!validation.valid) {
                  panel.webview.postMessage({
                    type: 'releaseNotesSaveError',
                    payload: {
                      message: '验证失败',
                      errors: validation.errors
                    }
                  });
                  return;
                }

                // 保存配置
                const saveSuccess = await releaseNotesManager.save();

                if (saveSuccess) {
                  panel.webview.postMessage({
                    type: 'releaseNotesSaved',
                    payload: releaseNotesManager.getConfig()
                  });
                  vscode.window.showInformationMessage('发布说明已保存');
                } else {
                  const status = releaseNotesManager.getSaveStatus();
                  panel.webview.postMessage({
                    type: 'releaseNotesSaveError',
                    payload: {
                      message: status.error || '保存失败'
                    }
                  });
                  vscode.window.showErrorMessage(`保存失败: ${status.error}`);
                }
              } catch (error) {
                console.error('保存发布说明失败:', error);
                panel.webview.postMessage({
                  type: 'releaseNotesSaveError',
                  payload: {
                    message: error instanceof Error ? error.message : '未知错误'
                  }
                });
                vscode.window.showErrorMessage('保存发布说明失败');
              }
              break;

            case 'autoSaveReleaseNotes':
              try {
                releaseNotesManager.updateConfig(message.payload);
                const autoSaveSuccess = await releaseNotesManager.save();

                if (autoSaveSuccess) {
                  panel.webview.postMessage({
                    type: 'releaseNotesSaved',
                    payload: releaseNotesManager.getConfig()
                  });
                } else {
                  const status = releaseNotesManager.getSaveStatus();
                  panel.webview.postMessage({
                    type: 'releaseNotesSaveError',
                    payload: {
                      message: status.error || '自动保存失败'
                    }
                  });
                }
              } catch (error) {
                console.error('自动保存失败:', error);
              }
              break;

            case 'importReleaseNotes':
              try {
                const uris = await vscode.window.showOpenDialog({
                  canSelectFiles: true,
                  canSelectFolders: false,
                  canSelectMany: false,
                  filters: {
                    'Markdown': ['md'],
                    'All Files': ['*']
                  },
                  openLabel: '导入'
                });

                if (uris && uris.length > 0) {
                  const markdownContent = fs.readFileSync(uris[0].fsPath, 'utf-8');
                  releaseNotesManager.updateConfig({ releaseNotes: markdownContent });
                  await releaseNotesManager.save();

                  panel.webview.postMessage({
                    type: 'releaseNotesConfigUpdated',
                    payload: releaseNotesManager.getConfig()
                  });
                  vscode.window.showInformationMessage('Markdown 文档已导入');
                }
              } catch (error) {
                console.error('导入失败:', error);
                vscode.window.showErrorMessage('导入失败');
              }
              break;
          }
        },
        undefined,
        context.subscriptions
      );
    }
  );

  // ============ 邮件服务命令注册 ============

  // 初始化邮件服务
  let emailServiceInitialized = false;
  async function ensureEmailService(): Promise<EmailService | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('请先打开一个工作区');
      return null;
    }

    const emailService = EmailService.getInstance();
    if (!emailService.isInitialized()) {
      try {
        await emailService.initialize(workspaceFolder.uri.fsPath, context);
        emailServiceInitialized = true;
      } catch (error) {
        const err = error as { message?: string };
        vscode.window.showErrorMessage(`邮件服务初始化失败: ${err.message || '未知错误'}`);
        return null;
      }
    }
    return emailService;
  }

  // 打开邮件编辑器
  const emailOpenEditorDisposable = vscode.commands.registerCommand(
    'polarbear.email.openEditor',
    async () => {
      const emailService = await ensureEmailService();
      if (!emailService) return;

      // 设置邮件发送回调
      EmailEditorPanel.setOnEmailSentCallback((success) => {
        if (success && publishTimelinePanel) {
          publishTimelinePanel.webview.postMessage({
            type: 'emailSent',
            payload: { success: true }
          });
        }
      });

      EmailEditorPanel.createOrShow(context.extensionUri, context);
    }
  );

  // 配置邮件服务 - 使用独立的 Webview 配置页面
  const emailConfigureDisposable = vscode.commands.registerCommand(
    'polarbear.email.configure',
    async () => {
      const emailService = await ensureEmailService();
      if (!emailService) return;

      // 打开独立的配置面板
      EmailConfigPanel.createOrShow(context.extensionUri, context);
    }
  );

  // 测试 SMTP 连接
  const emailTestConnectionDisposable = vscode.commands.registerCommand(
    'polarbear.email.testConnection',
    async () => {
      const emailService = await ensureEmailService();
      if (!emailService) return;

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在测试 SMTP 连接...',
        cancellable: false,
      }, async () => {
        const result = await emailService.testConnection();

        if (result.success) {
          vscode.window.showInformationMessage(`SMTP 连接成功！响应时间: ${result.responseTime}ms`);
        } else {
          vscode.window.showErrorMessage(
            `连接失败: ${result.error?.message || '未知错误'}`,
            '重试',
            '查看配置'
          ).then(selection => {
            if (selection === '重试') {
              vscode.commands.executeCommand('polarbear.email.testConnection');
            } else if (selection === '查看配置') {
              vscode.commands.executeCommand('polarbear.email.configure');
            }
          });
        }
      });
    }
  );

  // 验证邮件配置
  const emailValidateDisposable = vscode.commands.registerCommand(
    'polarbear.email.validateConfig',
    async () => {
      const emailService = await ensureEmailService();
      if (!emailService) return;

      const result = await emailService.validateConfig();

      if (result.valid) {
        if (result.warnings.length > 0) {
          const warningMessages = result.warnings.map(w => `  ⚠ ${w.field}: ${w.message}`).join('\n');
          vscode.window.showWarningMessage(
            `配置验证通过，但有 ${result.warnings.length} 个警告`,
            '查看详情'
          ).then(() => {
            emailService.showLogs();
            emailService.log('WARN', `配置验证警告:\n${warningMessages}`);
          });
        } else {
          vscode.window.showInformationMessage('配置验证通过！');
        }
      } else {
        const errorMessages = result.errors.map(e => `  ✗ ${e.field}: ${e.message}`).join('\n');
        vscode.window.showErrorMessage(
          `配置验证失败: ${result.errors.length} 个错误`,
          '查看详情',
          '打开配置'
        ).then(selection => {
          if (selection === '查看详情') {
            emailService.showLogs();
            emailService.log('ERROR', `配置验证错误:\n${errorMessages}`);
          } else if (selection === '打开配置') {
            vscode.commands.executeCommand('polarbear.email.configure');
          }
        });
      }
    }
  );

  // 重新加载配置
  const emailReloadDisposable = vscode.commands.registerCommand(
    'polarbear.email.reloadConfig',
    async () => {
      const emailService = await ensureEmailService();
      if (!emailService) return;

      try {
        await emailService.reloadConfig();
        vscode.window.showInformationMessage('配置已重新加载');
      } catch (error) {
        vscode.window.showErrorMessage(`重新加载配置失败: ${(error as Error).message}`);
      }
    }
  );

  // 快速发送邮件
  const emailSendQuickDisposable = vscode.commands.registerCommand(
    'polarbear.email.sendQuick',
    async () => {
      const emailService = await ensureEmailService();
      if (!emailService) return;

      // 获取默认收件人
      let defaultTo = '';
      try {
        const configManager = emailService.getConfigManager();
        if (configManager) {
          const config = configManager.getConfig();
          if (config?.defaultTo && config.defaultTo.length > 0) {
            defaultTo = config.defaultTo.map((c: { email: string }) => c.email).join(';');
          }
        }
      } catch {
        // 忽略配置读取错误
      }

      const to = await vscode.window.showInputBox({
        prompt: '收件人邮箱',
        placeHolder: 'recipient@example.com',
        value: defaultTo,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) return '收件人不能为空';
          const { result } = parseAndValidateRecipients(value);
          if (!result.valid) return result.error;
          return null;
        }
      });
      if (!to) return;

      const subject = await vscode.window.showInputBox({
        prompt: '邮件主题',
        placeHolder: '请输入邮件主题',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) return '主题不能为空';
          return null;
        }
      });
      if (!subject) return;

      const content = await vscode.window.showInputBox({
        prompt: '邮件内容（纯文本）',
        placeHolder: '请输入邮件内容',
        value: 'Hello',
      });
      if (!content) return;

      const options: SendEmailOptions = {
        to: to.split(/[;,]/).map(e => e.trim()).filter(e => e.length > 0),
        subject,
        text: content,
      };

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在发送邮件...',
        cancellable: false,
      }, async () => {
        const result = await emailService.sendEmail(options);
        if (result.success) {
          vscode.window.showInformationMessage(`邮件发送成功！耗时: ${result.duration}ms`);
        } else {
          vscode.window.showErrorMessage(`发送失败: ${result.error?.message || '未知错误'}`);
        }
      });
    }
  );

  // 查看邮件日志
  const emailShowLogsDisposable = vscode.commands.registerCommand(
    'polarbear.email.showLogs',
    async () => {
      const emailService = EmailService.getInstance();
      if (emailService.isInitialized()) {
        emailService.showLogs();
      } else {
        vscode.window.showInformationMessage('邮件服务未初始化，请先配置邮件服务');
      }
    }
  );

  // 打开发布时间轴页面
  const openPublishTimelineDisposable = vscode.commands.registerCommand(
    'polarbear.openPublishTimeline',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('请先打开一个工作区');
        return;
      }

      // 初始化打包服务
      packService = new PackService(workspaceFolder.uri.fsPath);

      // 初始化发布说明服务
      releaseNotesService = new ReleaseNotesService(workspaceFolder.uri.fsPath);

      // 创建 Webview Panel
      const panel = vscode.window.createWebviewPanel(
        'polarbear.publishTimeline',
        '发布流程',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          enableCommandUris: true,
          enableFindWidget: true,
          localResourceRoots: [
            vscode.Uri.file(context.extensionPath)
          ]
        }
      );

      // 设置 HTML 内容
      panel.webview.html = getPublishTimelineWebviewContent(panel.webview, context.extensionUri);

      // 处理消息
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.type) {
            case 'getPublishTimelineStatus':
              // 可以在这里返回发布流程的当前状态
              panel.webview.postMessage({
                type: 'publishTimelineStatus',
                payload: {
                  steps: [
                    { id: 'pack', status: 'pending' },
                    { id: 'release-notes', status: 'pending' },
                    { id: 'email', status: 'pending' }
                  ]
                }
              });
              break;

            case 'checkPackPrerequisites':
              // 检查打包前置条件
              if (!packService) {
                panel.webview.postMessage({
                  type: 'packPrerequisitesResult',
                  payload: { success: false, error: '打包服务未初始化' }
                });
                return;
              }

              const configCheck = packService.checkPublishConfig();
              if (!configCheck.exists) {
                panel.webview.postMessage({
                  type: 'packPrerequisitesResult',
                  payload: { success: false, error: configCheck.error }
                });
                return;
              }

              const fileCheck = packService.checkFilesExist();
              panel.webview.postMessage({
                type: 'packPrerequisitesResult',
                payload: {
                  success: fileCheck.allExist,
                  error: fileCheck.allExist ? undefined : '部分文件不存在',
                  missingFiles: fileCheck.missingFiles,
                  existingFiles: fileCheck.existingFiles
                }
              });
              break;

            case 'startPack':
              // 开始打包
              if (!packService) {
                panel.webview.postMessage({
                  type: 'packProgress',
                  payload: { status: 'error', error: '打包服务未初始化' }
                });
                return;
              }

              try {
                panel.webview.postMessage({
                  type: 'packProgress',
                  payload: { status: 'started', progress: 0 }
                });

                // 获取自定义文件名（从消息 payload 中）
                const customFileName = message.payload?.fileName;
                console.log('[Extension] 开始打包，自定义文件名:', customFileName || '无');

                const result = await packService.pack(customFileName);

                if (result.success) {
                  panel.webview.postMessage({
                    type: 'packProgress',
                    payload: {
                      status: 'completed',
                      progress: 100,
                      zipPath: result.zipPath,
                      packedFiles: result.packedFiles,
                      skippedFiles: result.skippedFiles
                    }
                  });
                } else {
                  panel.webview.postMessage({
                    type: 'packProgress',
                    payload: {
                      status: 'error',
                      error: result.error,
                      skippedFiles: result.skippedFiles
                    }
                  });
                }
              } catch (error) {
                panel.webview.postMessage({
                  type: 'packProgress',
                  payload: {
                    status: 'error',
                    error: (error as Error).message
                  }
                });
              }
              break;

            case 'getPackPreview':
              // 获取打包预览信息
              if (!packService) {
                panel.webview.postMessage({
                  type: 'packPreviewResult',
                  payload: { fileCount: 0, totalSize: 0, folders: [] }
                });
                return;
              }

              const preview = packService.getPackPreview();
              panel.webview.postMessage({
                type: 'packPreviewResult',
                payload: preview
              });
              break;

            case 'getCachedZipPath':
              // 获取缓存的 zip 路径
              if (!packService) {
                panel.webview.postMessage({
                  type: 'cachedZipPathResult',
                  payload: { zipPath: null }
                });
                return;
              }

              const cachedPath = packService.getCachedZipPath();
              panel.webview.postMessage({
                type: 'cachedZipPathResult',
                payload: { zipPath: cachedPath }
              });
              break;

            case 'clearPackCache':
              // 清除打包缓存
              if (packService) {
                packService.clearCache();
              }
              panel.webview.postMessage({
                type: 'packCacheCleared',
                payload: { success: true }
              });
              break;

            case 'getReleaseSubject':
              // 获取发布主题
              {
                const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                const subject = workspacePath ? loadReleaseSubject(workspacePath) : '';
                panel.webview.postMessage({
                  type: 'releaseSubjectResult',
                  payload: { subject }
                });
              }
              break;

            case 'saveReleaseSubject':
              // 保存发布主题
              {
                const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                const subject = message.payload?.subject || '';
                if (workspacePath) {
                  saveReleaseSubject(workspacePath, subject);
                }
                panel.webview.postMessage({
                  type: 'releaseSubjectSaved',
                  payload: { success: true }
                });
              }
              break;

            case 'checkReleaseNotesFile':
              // 检查发布说明文件是否存在
              if (!releaseNotesService) {
                panel.webview.postMessage({
                  type: 'releaseNotesFileCheckResult',
                  payload: { exists: false, error: '发布说明服务未初始化' }
                });
                return;
              }
              const releaseNotesFileCheck = releaseNotesService.checkFile();
              panel.webview.postMessage({
                type: 'releaseNotesFileCheckResult',
                payload: releaseNotesFileCheck
              });
              break;

            case 'generateReleaseNotes':
              // 生成发布说明文档
              if (!releaseNotesService) {
                panel.webview.postMessage({
                  type: 'releaseNotesGenerated',
                  payload: { success: false, error: '发布说明服务未初始化' }
                });
                return;
              }
              try {
                const customContent = message.payload?.content;
                const releaseSubject = message.payload?.releaseSubject;
                const result = releaseNotesService.generateMarkdown(customContent, releaseSubject);
                panel.webview.postMessage({
                  type: 'releaseNotesGenerated',
                  payload: result
                });
              } catch (error) {
                panel.webview.postMessage({
                  type: 'releaseNotesGenerated',
                  payload: { success: false, error: (error as Error).message }
                });
              }
              break;

            case 'exportReleaseNotesMarkdown':
              // 导出 Markdown 文件
              if (!releaseNotesService) {
                panel.webview.postMessage({
                  type: 'releaseNotesExported',
                  payload: { success: false, error: '发布说明服务未初始化', format: 'md' }
                });
                return;
              }
              try {
                const customContent = message.payload?.content;
                const releaseSubject = message.payload?.releaseSubject;
                const result = releaseNotesService.exportMarkdown(customContent, releaseSubject);
                panel.webview.postMessage({
                  type: 'releaseNotesExported',
                  payload: { ...result, format: 'md' }
                });
              } catch (error) {
                panel.webview.postMessage({
                  type: 'releaseNotesExported',
                  payload: { success: false, error: (error as Error).message, format: 'md' }
                });
              }
              break;

            case 'saveEditedReleaseNotes':
              // 保存编辑后的发布说明
              if (!releaseNotesService) {
                panel.webview.postMessage({
                  type: 'releaseNotesSaved',
                  payload: { success: false, error: '发布说明服务未初始化' }
                });
                return;
              }
              try {
                const content = message.payload?.content || '';
                const result = releaseNotesService.saveEditedContent(content);
                panel.webview.postMessage({
                  type: 'releaseNotesSaved',
                  payload: result
                });
              } catch (error) {
                panel.webview.postMessage({
                  type: 'releaseNotesSaved',
                  payload: { success: false, error: (error as Error).message }
                });
              }
              break;

            // ============ 邮件预编辑相关 ============
            case 'checkEmailConfig':
              // 检查邮件配置
              {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                const configPath = workspaceFolder
                  ? path.join(workspaceFolder.uri.fsPath, '.releasePlan', 'smtp-config.json')
                  : '';
                const configured = fs.existsSync(configPath);
                panel.webview.postMessage({
                  type: 'emailConfigCheckResult',
                  payload: { configured }
                });
              }
              break;

            case 'prepareEmailData':
              // 准备邮件数据
              {
                try {
                  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                  if (!workspaceFolder) {
                    panel.webview.postMessage({
                      type: 'emailDataPrepared',
                      payload: { success: false, error: '未找到工作区' }
                    });
                    return;
                  }

                  const releaseSubject = message.payload?.releaseSubject || '';
                  const zipPath = message.payload?.zipPath || '';

                  // 读取 SMTP 配置获取收件人信息
                  const configPath = path.join(workspaceFolder.uri.fsPath, '.releasePlan', 'smtp-config.json');
                  let defaultTo: string[] = [];
                  let defaultCc: string[] = [];

                  if (fs.existsSync(configPath)) {
                    const configContent = fs.readFileSync(configPath, 'utf-8');
                    const config = JSON.parse(configContent);
                    defaultTo = (config.defaultTo || []).map((c: any) => c.email).filter(Boolean);
                    defaultCc = (config.defaultCc || []).map((c: any) => c.email).filter(Boolean);
                  }

                  // 读取发布说明文件内容
                  const releaseNotesPath = path.join(
                    workspaceFolder.uri.fsPath,
                    '.releasePlan',
                    'output',
                    `${releaseSubject}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.md`
                  );

                  let releaseNotesContent = '';
                  if (fs.existsSync(releaseNotesPath)) {
                    releaseNotesContent = fs.readFileSync(releaseNotesPath, 'utf-8');
                  }

                  // 生成邮件正文
                  const emailBody = generateEmailBody(releaseSubject, releaseNotesContent);

                  // 准备附件信息（确保数据可序列化）
                  let attachments: Array<{ id: string; filename: string; path: string; size: number }> = [];
                  if (zipPath && fs.existsSync(zipPath)) {
                    const stat = fs.statSync(zipPath);
                    // 创建纯 JSON 对象，确保没有不可克隆的数据
                    const attachmentObj = JSON.parse(JSON.stringify({
                      id: `att_${Date.now()}`,
                      filename: path.basename(zipPath),
                      path: zipPath,
                      size: stat.size
                    }));
                    attachments = [attachmentObj];
                  }

                  panel.webview.postMessage({
                    type: 'emailDataPrepared',
                    payload: {
                      success: true,
                      data: {
                        to: defaultTo.join('; '),
                        cc: defaultCc.join('; '),
                        subject: releaseSubject,
                        body: emailBody,
                        attachments
                      }
                    }
                  });
                } catch (error) {
                  panel.webview.postMessage({
                    type: 'emailDataPrepared',
                    payload: { success: false, error: (error as Error).message }
                  });
                }
              }
              break;

            case 'testEmailConnection':
              // 测试邮箱连接
              {
                try {
                  const emailService = EmailService.getInstance();
                  if (!emailService.isInitialized()) {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                      await emailService.initialize(workspaceFolder.uri.fsPath, context);
                    }
                  }

                  const result = await emailService.testConnection();
                  // 清理错误对象，移除不可克隆的 originalError
                  const safeError = result.error ? {
                    code: result.error.code,
                    message: result.error.message,
                    details: result.error.details
                  } : undefined;
                  panel.webview.postMessage({
                    type: 'emailConnectionTestResult',
                    payload: {
                      success: result.success,
                      message: result.success
                        ? `✅ 邮箱服务连接成功！响应时间: ${result.responseTime}ms`
                        : `❌ 连接失败: ${safeError?.message || '未知错误'}`,
                      error: safeError
                    }
                  });
                } catch (error) {
                  panel.webview.postMessage({
                    type: 'emailConnectionTestResult',
                    payload: {
                      success: false,
                      message: `❌ 测试失败: ${(error as Error).message}`
                    }
                  });
                }
              }
              break;

            case 'openEmailEditor':
              // 打开邮件编辑器并传递数据
              {
                const emailData = message.payload;
                if (emailData) {
                  // 确保附件数据是纯 JSON 可序列化的
                  const sanitizedAttachments = (emailData.attachments || []).map((att: any) => ({
                    id: String(att.id || ''),
                    filename: String(att.filename || ''),
                    path: String(att.path || ''),
                    size: Number(att.size || 0)
                  }));

                  // 保存草稿数据到 globalState
                  const draftData = {
                    to: String(emailData.to || ''),
                    cc: String(emailData.cc || ''),
                    subject: String(emailData.subject || ''),
                    markdown: String(emailData.body || ''),
                    attachments: sanitizedAttachments
                  };

                  await context.globalState.update('polarbear.email.draft', draftData);

                  // 设置邮件发送回调
                  EmailEditorPanel.setOnEmailSentCallback((success) => {
                    if (success && publishTimelinePanel) {
                      publishTimelinePanel.webview.postMessage({
                        type: 'emailSent',
                        payload: { success: true }
                      });
                    }
                  });

                  // 打开邮件编辑器
                  EmailEditorPanel.createOrShow(context.extensionUri, context);
                }
              }
              break;

            case 'sendEmail':
              // 直接从 PublishTimelineView 发送邮件
              {
                const emailData = message.payload;
                if (emailData) {
                  const emailService = await ensureEmailService();
                  if (!emailService) {
                    panel.webview.postMessage({
                      type: 'emailSent',
                      payload: { success: false, message: '邮件服务未配置' }
                    });
                    break;
                  }

                  // 确保附件数据是纯 JSON 可序列化的
                  const sanitizedAttachments = (emailData.attachments || []).map((att: any) => ({
                    id: String(att.id || ''),
                    filename: String(att.filename || ''),
                    path: String(att.path || ''),
                    size: Number(att.size || 0)
                  }));

                  try {
                    const result = await emailService.sendEmail({
                      to: String(emailData.to || ''),
                      cc: emailData.cc ? String(emailData.cc) : undefined,
                      subject: String(emailData.subject || ''),
                      text: String(emailData.body || ''),
                      attachments: sanitizedAttachments
                    });

                    if (result.success) {
                      vscode.window.showInformationMessage(
                        `邮件发送成功！消息ID: ${result.messageId}`,
                        '查看详情'
                      ).then(selection => {
                        if (selection === '查看详情') {
                          emailService.showLogs();
                        }
                      });

                      panel.webview.postMessage({
                        type: 'emailSent',
                        payload: { success: true }
                      });
                    } else {
                      const errorMsg = result.error?.message || '发送失败';
                      vscode.window.showErrorMessage(
                        `发送失败: ${errorMsg}`,
                        '重试',
                        '查看详情'
                      ).then(selection => {
                        if (selection === '查看详情') {
                          emailService.showLogs();
                        }
                      });

                      panel.webview.postMessage({
                        type: 'emailSent',
                        payload: { success: false, message: errorMsg }
                      });
                    }
                  } catch (error) {
                    const errorMsg = (error as Error).message;
                    vscode.window.showErrorMessage(`发送失败: ${errorMsg}`);
                    panel.webview.postMessage({
                      type: 'emailSent',
                      payload: { success: false, message: errorMsg }
                    });
                  }
                }
              }
              break;
          }
        },
        undefined,
        context.subscriptions
      );
    }
  );

  // ============ 状态栏集成 ============
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(mail)';
  statusBarItem.tooltip = 'PolarBear 邮件服务';
  statusBarItem.command = 'polarbear.email.openEditor';
  statusBarItem.show();

  // 注册侧边栏 TreeView
  const polarBearViewProvider = new PolarBearViewProvider();
  vscode.window.registerTreeDataProvider('polarbearView', polarBearViewProvider);

  context.subscriptions.push(disposable);
  context.subscriptions.push(testLoginDisposable);
  context.subscriptions.push(openSettingsDisposable);
  context.subscriptions.push(addPublishFlowDisposable);
  context.subscriptions.push(openPublishFlowDisposable);
  context.subscriptions.push(openReleaseNotesDisposable);
  context.subscriptions.push(openPublishTimelineDisposable);
  context.subscriptions.push(emailOpenEditorDisposable);
  context.subscriptions.push(emailConfigureDisposable);
  context.subscriptions.push(emailTestConnectionDisposable);
  context.subscriptions.push(emailValidateDisposable);
  context.subscriptions.push(emailReloadDisposable);
  context.subscriptions.push(emailSendQuickDisposable);
  context.subscriptions.push(emailShowLogsDisposable);
  context.subscriptions.push(statusBarItem);

  // 注册配置变更监听（更新状态栏）
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('polarbear.email')) {
        // 配置变更时更新状态栏
      }
    })
  );
}

/**
 * 获取 Webview HTML 内容（加载 Vue 构建产物）
 * 使用 asWebviewUri 方式加载资源
 */
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  // 使用 asWebviewUri 转换资源路径
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'main.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'style.css')
  );

  const nonce = getNonce();

  return `<!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
      <title>配置发布流程</title>
      <link rel="stylesheet" href="${styleUri}">
    </head>
    <body>
      <div id="app" data-page="publish-flow"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

/**
 * 生成随机 nonce
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * 获取发布说明 Webview HTML 内容
 */
function getReleaseNotesWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'main.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'style.css')
  );

  const nonce = getNonce();

  return `<!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
      <title>发布说明</title>
      <link rel="stylesheet" href="${styleUri}">
    </head>
    <body>
      <div id="app" data-page="release-notes"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

/**
 * 获取发布时间轴 Webview HTML 内容
 */
function getPublishTimelineWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'main.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'style.css')
  );

  const nonce = getNonce();

  return `<!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
      <title>发布流程</title>
      <link rel="stylesheet" href="${styleUri}">
    </head>
    <body>
      <div id="app" data-page="publish-timeline"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

export function deactivate() {
  // 清理邮件服务资源
  const emailService = EmailService.getInstance();
  if (emailService.isInitialized()) {
    const logger = emailService.getLogger();
    if (logger) {
      logger.dispose();
    }
  }
}
