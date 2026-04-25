// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PolarBearViewProvider } from './polarbearViewProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "polarbear" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('polarbear.startPolar', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
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

	// 注册侧边栏 TreeView
	const polarBearViewProvider = new PolarBearViewProvider();
	vscode.window.registerTreeDataProvider('polarbearView', polarBearViewProvider);

	context.subscriptions.push(disposable);
	context.subscriptions.push(testLoginDisposable);
	context.subscriptions.push(openSettingsDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
