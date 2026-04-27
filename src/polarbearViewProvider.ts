import * as vscode from 'vscode';

export class PolarBearItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly iconName?: string
    ) {
        super(label, collapsibleState);
        if (command) {
            this.command = command;
        }
        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName);
        }
        this.tooltip = label;
    }
}

export class PolarBearViewProvider implements vscode.TreeDataProvider<PolarBearItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PolarBearItem | undefined | null | void> = new vscode.EventEmitter<PolarBearItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<PolarBearItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PolarBearItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: PolarBearItem): Thenable<PolarBearItem[]> {
        if (!element) {
            return Promise.resolve([
                new PolarBearItem(
                    '开始发布',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.startPolar',
                        title: 'Start Polar',
                        arguments: []
                    },
                    'play'
                ),
                new PolarBearItem(
                    '增加发布流程',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.openPublishFlow',
                        title: 'Open Publish Flow',
                        arguments: []
                    },
                    'add'
                ),
                new PolarBearItem(
                    '发布说明',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.openReleaseNotes',
                        title: 'Open Release Notes',
                        arguments: []
                    },
                    'book'
                ),
                new PolarBearItem(
                    '测试登录',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.testLogin',
                        title: 'Test Login',
                        arguments: []
                    },
                    'account'
                ),
                new PolarBearItem(
                    '发布说明',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.openReleaseNotes',
                        title: 'Open Release Notes',
                        arguments: []
                    },
                    'book'
                ),
                new PolarBearItem(
                    '邮件服务',
                    vscode.TreeItemCollapsibleState.Expanded,
                    undefined,
                    'mail'
                ),
                new PolarBearItem(
                    '设置',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.openSettings',
                        title: 'Open Settings',
                        arguments: []
                    },
                    'gear'
                )
            ]);
        }

        // 邮件服务子菜单
        if (element.label === '邮件服务') {
            return Promise.resolve([
                new PolarBearItem(
                    '写邮件',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.email.openEditor',
                        title: '打开邮件编辑器',
                        arguments: []
                    },
                    'edit'
                ),
                new PolarBearItem(
                    '快速发送',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.email.sendQuick',
                        title: '快速发送邮件',
                        arguments: []
                    },
                    'send'
                ),
                new PolarBearItem(
                    '配置邮件',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.email.configure',
                        title: '配置邮件服务',
                        arguments: []
                    },
                    'gear'
                ),
                new PolarBearItem(
                    '测试连接',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'polarbear.email.testConnection',
                        title: '测试 SMTP 连接',
                        arguments: []
                    },
                    'plug'
                )
            ]);
        }

        return Promise.resolve([]);
    }
}
