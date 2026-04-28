# PolarBear

一个专为 SDK/组件发布设计的 VS Code 插件，提供从文件选择、打包、生成发布说明到邮件通知的完整发布流程管理工具。

## 功能特性

### 📦 发布流程管理
- **可视化文件选择**: 通过树形界面选择需要发布的文件和文件夹
- **智能打包**: 自动将选中的文件打包成 ZIP 格式，支持增量打包和缓存机制
- **发布清单**: 保存发布配置，支持多次复用和版本管理

### 📝 发布说明生成
- **模板化发布说明**: 根据版本号、更新内容自动生成标准化的发布说明文档
- **版本管理**: 支持版本号自动递增（Patch/Minor/Major）
- **多 SDK 支持**: 可同时管理多个 SDK 版本的发布说明
- **Markdown 导出**: 生成格式化的 Markdown 发布说明

### 📧 邮件服务
- **SMTP 配置**: 支持配置多个 SMTP 服务器，密码安全存储在 VS Code Secret Storage 中
- **可视化邮件编辑器**: 内置富文本邮件编辑器，支持 HTML 格式
- **附件支持**: 可直接将打包好的 SDK 文件作为邮件附件发送
- **快速发送**: 支持快捷键快速发送邮件（Cmd/Ctrl + Shift + Enter）
- **收件人管理**: 支持 To/Cc/Bcc 多种收件人类型，自动验证邮箱格式
- **邮件模板**: 自动生成包含发布摘要的商务邮件格式

### 🎯 发布时间线
- **一站式发布面板**: 整合打包、生成发布说明、发送邮件的完整流程
- **实时状态反馈**: 显示每个步骤的执行状态和进度
- **一键发布**: 简化操作流程，提高发布效率

## 使用方法

### 打开 PolarBear 面板
1. 点击 VS Code 左侧活动栏的 PolarBear 图标
2. 或使用命令面板（Cmd/Ctrl + Shift + P）搜索 "PolarBear"

### 配置发布流程
1. 点击"增加发布流程"打开文件选择界面
2. 拖拽或选择需要发布的文件/文件夹
3. 配置目标路径和文件结构
4. 保存发布清单

### 编写发布说明
1. 点击"发布说明"打开编辑器
2. 填写版本号、更新内容、兼容性说明等信息
3. 支持实时预览和自动保存

### 配置邮件服务
1. 点击"邮件服务" -> "配置邮件"
2. 填写 SMTP 服务器信息、发件人邮箱和密码
3. 点击"测试连接"验证配置是否正确

### 发送发布邮件
1. 点击"写邮件"打开邮件编辑器
2. 填写收件人、邮件主题
3. 选择要发送的 SDK 附件
4. 点击发送或使用快捷键 Cmd/Ctrl + Shift + Enter

### 一键发布
1. 点击"开始发布"打开发布时间线
2. 按顺序执行：打包 -> 生成发布说明 -> 发送邮件
3. 全程可视化操作，实时查看进度

## 命令列表

| 命令 | 快捷键 | 说明 |
|------|--------|------|
| PolarBear: 增加发布流程 | - | 打开发布流程配置界面 |
| PolarBear: 发布说明 | - | 打开发布说明编辑器 |
| PolarBear: 开始发布 | - | 打开发布时间线面板 |
| PolarBear Email: 打开邮件编辑器 | Cmd/Ctrl+Shift+M | 打开邮件编辑界面 |
| PolarBear Email: 快速发送邮件 | Cmd/Ctrl+Shift+Enter | 快速发送邮件 |
| PolarBear Email: 配置邮件服务 | - | 配置 SMTP 服务器 |
| PolarBear Email: 测试 SMTP 连接 | - | 测试邮件服务器连接 |

## 配置说明

### 邮件配置文件
邮件配置存储在工作区 `.releasePlan/email-config.json` 文件中：

```json
{
  "smtp": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false,
    "user": "your-email@example.com"
  },
  "from": "your-email@example.com",
  "fromName": "Your Name",
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "retryDelay": 5000
  }
}
```

**注意**: SMTP 密码安全存储在 VS Code 的 Secret Storage 中，不会保存在配置文件中。

### 发布清单配置
发布清单存储在工作区 `.releasePlan/publish-config.json` 文件中，包含：
- 要发布的文件和文件夹列表
- 目标路径结构
- 文件元数据（大小、修改时间等）

### 发布说明配置
发布说明配置存储在工作区 `.releasePlan/release-notes.json` 文件中，包含：
- 版本号信息
- 更新内容
- 兼容性说明
- 已知问题

## 文件结构

```
.releasePlan/
├── publish-config.json      # 发布清单配置
├── release-notes.json       # 发布说明配置
├── release-subject.json     # 发布主题
├── email-config.json        # 邮件服务配置（不含密码）
└── cache/                   # 打包缓存目录
    └── *.zip               # 生成的 SDK 包
```

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite
- **后端**: VS Code Extension API + Node.js
- **构建**: Webpack + TypeScript
- **邮件**: Nodemailer
- **打包**: JSZip

## 开发

```bash
# 安装依赖
npm install

# 编译 Webview
npm run build:webview

# 开发模式
npm run watch

# 打包发布
npm run package

# 运行测试
npm run test
```

## 要求

- VS Code 版本 >= 1.74.0
- Node.js 版本 >= 18.x

## 已知问题

暂无已知问题。如有问题请在 GitHub Issues 中反馈。

## 更新日志

### 0.0.1

- 初始版本发布
- 实现发布流程管理功能
- 实现发布说明生成功能
- 实现邮件服务功能
- 实现发布时间线面板

## 许可证

MIT
