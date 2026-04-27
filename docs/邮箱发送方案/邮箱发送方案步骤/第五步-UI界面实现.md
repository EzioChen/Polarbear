# 第五步：UI界面实现

## 阶段概述

本阶段实现邮件发送功能的用户界面，包括配置界面、状态提示、命令集成和快捷操作，确保用户可以方便地使用邮件发送功能。

---

## 任务一：命令注册与菜单集成

### 任务描述

在 VS Code 中注册邮件发送相关的命令，并将其集成到命令面板和上下文菜单中。

### 任务目标

1. 注册邮件发送相关命令
2. 配置命令面板分类
3. 添加快捷键绑定
4. 集成到上下文菜单

### 前置条件

- 已完成邮件发送核心功能
- 已了解 VS Code 命令 API

### 详细步骤

#### 1.1 命令清单设计

**核心命令：**
| 命令ID | 标题 | 功能 |
|--------|------|------|
| polarbear.email.openEditor | 打开邮件编辑器 | 打开邮件编辑器面板 |
| polarbear.email.sendQuick | 快速发送邮件 | 使用默认模板发送 |
| polarbear.email.configure | 配置邮件服务 | 打开配置文件 |
| polarbear.email.validateConfig | 验证邮件配置 | 验证当前配置 |
| polarbear.email.testConnection | 测试SMTP连接 | 测试服务器连接 |
| polarbear.email.reloadConfig | 重新加载配置 | 重新加载配置文件 |

**发布集成命令：**
| 命令ID | 标题 | 功能 |
|--------|------|------|
| polarbear.email.sendReleaseNotes | 发送发布说明 | 发送当前发布说明 |
| polarbear.email.notifyRelease | 通知发布完成 | 发送发布通知邮件 |

#### 1.2 package.json 配置

**commands 配置：**
```json
{
  "commands": [
    {
      "command": "polarbear.email.openEditor",
      "title": "打开邮件编辑器",
      "category": "PolarBear Email",
      "icon": "$(mail)"
    },
    {
      "command": "polarbear.email.configure",
      "title": "配置邮件服务",
      "category": "PolarBear Email"
    }
  ]
}
```

**menus 配置：**
```json
{
  "menus": {
    "commandPalette": [
      {
        "command": "polarbear.email.openEditor",
        "group": "PolarBear Email"
      }
    ],
    "editor/context": [
      {
        "command": "polarbear.email.sendQuick",
        "when": "editorHasSelection",
        "group": "PolarBear Email@1"
      }
    ]
  }
}
```

#### 1.3 快捷键绑定

**默认快捷键：**
| 命令 | 快捷键 | 说明 |
|------|--------|------|
| polarbear.email.openEditor | Ctrl/Cmd + Shift + M | 打开邮件编辑器 |
| polarbear.email.sendQuick | - | 不绑定，避免冲突 |

**keybindings 配置：**
```json
{
  "keybindings": [
    {
      "command": "polarbear.email.openEditor",
      "key": "ctrl+shift+m",
      "mac": "cmd+shift+m",
      "when": "editorTextFocus"
    }
  ]
}
```

#### 1.4 命令实现

**注册位置：** extension.ts 的 activate 函数

**实现模式：**
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('polarbear.email.openEditor', async () => {
    // 检查初始化状态
    // 打开邮件编辑器
  })
);
```

### 预期成果

- 所有命令已注册
- 命令面板可访问
- 快捷键可用

### 验收标准

- [ ] 所有命令在 package.json 中定义
- [ ] 命令在命令面板中可见
- [ ] 快捷键绑定正确
- [ ] 命令执行正常

---

## 任务二：配置界面实现

### 任务描述

实现 SMTP 配置的可视化界面，方便用户配置邮件服务参数。

### 任务目标

1. 实现配置输入表单
2. 实现配置验证反馈
3. 实现连接测试功能
4. 实现配置保存

### 前置条件

- 已完成配置管理功能
- 已了解 VS Code 输入框 API

### 详细步骤

#### 2.1 配置向导流程

**向导步骤：**
1. 输入 SMTP 服务器地址
2. 输入端口（提供常用选项）
3. 选择加密方式
4. 输入邮箱账号
5. 输入密码（安全输入）
6. 输入发件人名称
7. 测试连接
8. 保存配置

**实现方式：**
使用多步输入框引导用户配置：
```typescript
const host = await vscode.window.showInputBox({
  prompt: 'SMTP服务器地址',
  placeHolder: '192.168.8.208',
  validateInput: (value) => {
    if (!value) return '服务器地址不能为空';
    return null;
  }
});
```

#### 2.2 快速配置命令

**配置选项：**
- 使用配置向导（逐步输入）
- 直接编辑配置文件（打开 JSON）
- 导入配置（从文件导入）

**配置模板：**
提供常用邮件服务商模板：
- Gmail
- Outlook/Office365
- QQ邮箱
- 163邮箱
- 自定义

#### 2.3 配置验证界面

**验证结果展示：**
- 使用树视图展示验证结果
- 错误项显示红色图标
- 警告项显示黄色图标
- 通过项显示绿色图标

**快速修复：**
- 提供快速修复建议
- 一键应用修复

### 预期成果

- 配置向导可用
- 配置验证可视化
- 常用模板可用

### 验收标准

- [ ] 配置向导流程完整
- [ ] 配置验证结果可视化
- [ ] 常用服务商模板可用
- [ ] 配置保存正常

---

## 任务三：状态栏集成

### 任务描述

在 VS Code 状态栏显示邮件服务状态，提供快速操作入口。

### 任务目标

1. 实现状态栏项
2. 显示连接状态
3. 提供快捷菜单
4. 实现状态更新

### 前置条件

- 已完成邮件发送核心功能
- 已了解 VS Code 状态栏 API

### 详细步骤

#### 3.1 状态栏项设计

**显示内容：**
- 图标：$(mail) 或 $(mail-read)
- 文字：邮件状态（可选）
- 颜色：根据状态变化

**状态定义：**
| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| 未配置 | $(mail) | 灰色 | 配置不存在 |
| 已配置 | $(mail) | 白色 | 配置有效但未测试 |
| 连接正常 | $(mail-read) | 绿色 | 连接测试通过 |
| 连接失败 | $(warning) | 红色 | 连接测试失败 |

#### 3.2 状态栏实现

**创建状态栏项：**
```typescript
const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  100
);
statusBarItem.command = 'polarbear.email.showMenu';
statusBarItem.show();
```

**状态更新：**
```typescript
function updateStatusBar(status: 'unconfigured' | 'configured' | 'connected' | 'error') {
  const config = {
    unconfigured: { icon: '$(mail)', color: undefined },
    configured: { icon: '$(mail)', color: undefined },
    connected: { icon: '$(mail-read)', color: '#89d185' },
    error: { icon: '$(warning)', color: '#f48771' }
  };
  
  statusBarItem.text = config[status].icon;
  statusBarItem.color = config[status].color;
}
```

#### 3.3 快捷菜单

**点击菜单：**
- 打开邮件编辑器
- 快速发送邮件
- 配置邮件服务
- 测试连接
- 查看发送历史（预留）

**实现方式：**
使用 QuickPick 实现二级菜单

### 预期成果

- 状态栏项显示正常
- 状态随连接变化
- 快捷菜单可用

### 验收标准

- [ ] 状态栏项正确显示
- [ ] 状态颜色正确变化
- [ ] 点击显示快捷菜单
- [ ] 菜单项功能正常

---

## 任务四：通知与反馈

### 任务描述

实现邮件发送过程中的用户通知和反馈机制。

### 任务目标

1. 实现发送进度提示
2. 实现结果通知
3. 实现错误提示
4. 实现操作按钮

### 前置条件

- 已完成邮件发送功能
- 已了解 VS Code 通知 API

### 详细步骤

#### 4.1 发送进度提示

**进度通知：**
```typescript
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: '正在发送邮件...',
  cancellable: false
}, async (progress) => {
  progress.report({ increment: 0 });
  
  const result = await emailService.sendEmail(options);
  
  progress.report({ increment: 100 });
  return result;
});
```

**状态文本：**
- 正在连接服务器...
- 正在认证...
- 正在发送...
- 发送完成

#### 4.2 结果通知

**成功通知：**
```typescript
vscode.window.showInformationMessage(
  `邮件发送成功！消息ID: ${result.messageId}`,
  '查看详情'
).then(selection => {
  if (selection === '查看详情') {
    // 显示详细信息
  }
});
```

**失败通知：**
```typescript
vscode.window.showErrorMessage(
  `发送失败: ${result.error?.message}`,
  '重试',
  '查看配置'
).then(selection => {
  if (selection === '重试') {
    // 重新发送
  } else if (selection === '查看配置') {
    // 打开配置
  }
});
```

#### 4.3 警告通知

**警告场景：**
- 配置不完整
- 连接超时但已重试成功
- 附件大小接近限制

**实现方式：**
使用 showWarningMessage 显示警告

### 预期成果

- 进度提示正常显示
- 结果通知及时
- 错误提示友好

### 验收标准

- [ ] 发送进度提示显示
- [ ] 成功/失败通知正确
- [ ] 操作按钮可用
- [ ] 警告提示适当

---

## 任务五：OutputChannel 日志

### 任务描述

实现邮件服务的日志输出功能，便于调试和问题排查。

### 任务目标

1. 创建专用 OutputChannel
2. 实现日志分级
3. 实现敏感信息过滤
4. 提供日志查看命令

### 前置条件

- 已完成邮件发送核心功能
- 已了解 VS Code OutputChannel API

### 详细步骤

#### 5.1 OutputChannel 创建

**创建通道：**
```typescript
const outputChannel = vscode.window.createOutputChannel('PolarBear Email');
```

**日志格式：**
```
[2024-01-15 10:30:45] [INFO] 邮件服务初始化成功
[2024-01-15 10:31:02] [DEBUG] 加载配置文件: /path/to/config.json
[2024-01-15 10:31:15] [INFO] 开始发送邮件
[2024-01-15 10:31:18] [INFO] 邮件发送成功, 消息ID: <abc123@example.com>
```

#### 5.2 日志分级

**日志级别：**
- DEBUG: 调试信息（开发时使用）
- INFO: 一般信息
- WARN: 警告信息
- ERROR: 错误信息

**级别控制：**
- 通过配置控制日志级别
- 生产环境默认 INFO
- 开发环境可开启 DEBUG

#### 5.3 敏感信息过滤

**过滤规则：**
- 密码字段替换为 `***`
- 邮箱地址部分脱敏（`u***@example.com`）
- Token 字段替换为 `[REDACTED]`

**实现方式：**
```typescript
function sanitizeLog(obj: any): any {
  const sensitiveKeys = ['pass', 'password', 'token', 'secret'];
  // 递归替换敏感字段
}
```

#### 5.4 日志命令

**查看日志命令：**
- polarbear.email.showLogs: 显示日志面板
- polarbear.email.clearLogs: 清空日志
- polarbear.email.exportLogs: 导出日志（预留）

### 预期成果

- OutputChannel 创建成功
- 日志分级实现
- 敏感信息已过滤

### 验收标准

- [ ] OutputChannel 正确创建
- [ ] 日志按级别输出
- [ ] 敏感信息已过滤
- [ ] 查看日志命令可用

---

## 阶段验收清单

### 整体验收标准

- [ ] 命令注册完成
- [ ] 配置界面实现
- [ ] 状态栏集成完成
- [ ] 通知与反馈机制完善
- [ ] OutputChannel 日志实现

### 进入下一阶段条件

完成本阶段所有任务并通过验收后，可进入**第六步：集成测试**的实施。
