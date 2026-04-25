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
        return Promise.resolve([]);
    }
}
