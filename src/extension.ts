import * as vscode from 'vscode';
import { PolarBearViewProvider } from './polarbearViewProvider';
import { PublishFlowManager } from './publishFlow/PublishFlowManager';
import type { WebviewMessage } from './publishFlow/types';
import { scanWorkspace, addFolderRecursiveToTarget } from './publishFlow/fileUtils';
import * as path from 'path';
import * as fs from 'fs';

// 全局管理器实例
let publishFlowManager: PublishFlowManager | undefined;

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
          localResourceRoots: [
            vscode.Uri.file(context.extensionPath)
          ]
        }
      );

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
                  await addFolderRecursiveToTarget(
                    message.payload.sourcePath,
                    publishFlowManager!,
                    message.payload.targetPath
                  );
                } else {
                  const singleTargetPath = message.payload.targetPath
                    ? path.join(message.payload.targetPath, path.basename(message.payload.sourcePath))
                    : path.basename(message.payload.sourcePath);

                  publishFlowManager?.addFile(message.payload.sourcePath, singleTargetPath);
                }

                panel.webview.postMessage({
                  type: 'configUpdated',
                  payload: publishFlowManager?.getConfig()
                });
              }
              break;

            case 'moveInPublishList':
              const { itemId, targetPath } = message.payload;
              const nodeToMove = publishFlowManager?.findNodeById(itemId);

              if (nodeToMove) {
                publishFlowManager?.removeNode(itemId);

                if (targetPath) {
                  const targetFolder = publishFlowManager?.findNodeByPath(targetPath);
                  if (targetFolder && targetFolder.children) {
                    targetFolder.children.push(nodeToMove);
                  }
                } else {
                  publishFlowManager?.getConfig().files.push(nodeToMove);
                }

                await publishFlowManager?.save();
                panel.webview.postMessage({
                  type: 'configUpdated',
                  payload: publishFlowManager?.getConfig()
                });
              }
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

  // 注册侧边栏 TreeView
  const polarBearViewProvider = new PolarBearViewProvider();
  vscode.window.registerTreeDataProvider('polarbearView', polarBearViewProvider);

  context.subscriptions.push(disposable);
  context.subscriptions.push(testLoginDisposable);
  context.subscriptions.push(openSettingsDisposable);
  context.subscriptions.push(addPublishFlowDisposable);
  context.subscriptions.push(openPublishFlowDisposable);
}

/**
 * 获取 Webview HTML 内容（加载 Vue 构建产物）
 */
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'main.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'main.css')
  );

  return `<!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
      <title>配置发布流程</title>
      <link rel="stylesheet" href="${styleUri}">
    </head>
    <body>
      <div id="app"></div>
      <script type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
}

export function deactivate() {}
