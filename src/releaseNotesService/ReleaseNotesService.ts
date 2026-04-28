import * as fs from 'fs';
import * as path from 'path';

export interface ReleaseNotesData {
  version: string;
  createdAt: string;
  updatedAt: string;
  versionLevel: string;
  releaseNotes: string;
  chipRange: string[];
  sdkVersions: Array<{
    id: string;
    chip: string;
    version: string;
    remark: string;
  }>;
  sdkVersion: string;
  appVersion: string;
  remarks: string;
  metadata: {
    createdBy: string;
    author: string;
  };
}

export interface GenerateResult {
  success: boolean;
  markdown?: string;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export class ReleaseNotesService {
  private workspacePath: string;
  private releaseNotesPath: string;
  private outputDir: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.releaseNotesPath = path.join(workspacePath, '.releasePlan', 'release-notes.json');
    this.outputDir = path.join(workspacePath, '.releasePlan', 'output');
    this.ensureOutputDir();
  }

  /**
   * 确保输出目录存在
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 检查 release-notes.json 文件是否存在
   */
  public checkFile(): { exists: boolean; error?: string } {
    console.log('[ReleaseNotesService] 检查文件:', this.releaseNotesPath);
    
    if (!fs.existsSync(this.releaseNotesPath)) {
      return {
        exists: false,
        error: `发布说明文件不存在: ${this.releaseNotesPath}\n请先创建发布说明文件后再继续。`
      };
    }

    try {
      const content = fs.readFileSync(this.releaseNotesPath, 'utf-8');
      const data: ReleaseNotesData = JSON.parse(content);
      
      if (!data.version || !data.releaseNotes) {
        return {
          exists: false,
          error: '发布说明文件格式不正确，缺少必要的字段（version 或 releaseNotes）'
        };
      }

      return { exists: true };
    } catch (error) {
      return {
        exists: false,
        error: `发布说明文件解析失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 读取发布说明数据
   */
  public loadData(): ReleaseNotesData | null {
    try {
      const content = fs.readFileSync(this.releaseNotesPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[ReleaseNotesService] 读取数据失败:', error);
      return null;
    }
  }

  /**
   * 生成 Markdown 文档
   */
  public generateMarkdown(customContent?: string, releaseSubject?: string): GenerateResult {
    const check = this.checkFile();
    if (!check.exists) {
      return { success: false, error: check.error };
    }

    const data = this.loadData();
    if (!data) {
      return { success: false, error: '无法读取发布说明数据' };
    }

    try {
      const markdown = customContent || this.buildMarkdown(data, releaseSubject);
      return { success: true, markdown };
    } catch (error) {
      return { success: false, error: `生成 Markdown 失败: ${(error as Error).message}` };
    }
  }

  /**
   * 构建 Markdown 内容
   */
  private buildMarkdown(data: ReleaseNotesData, releaseSubject?: string): string {
    const date = new Date().toLocaleDateString('zh-CN');
    
    // 使用发布主题作为标题，如果没有则使用默认格式
    const title = releaseSubject || `发布说明 - ${data.sdkVersion || data.version}`;
    
    let markdown = `# ${title}\n\n`;
    markdown += `> 发布日期: ${date}\n\n`;
    markdown += `> 版本级别: ${this.getVersionLevelText(data.versionLevel)}\n\n`;
    
    // 版本信息
    markdown += `## 📋 版本信息\n\n`;
    markdown += `- **SDK 版本**: ${data.sdkVersion || 'N/A'}\n`;
    markdown += `- **应用版本**: ${data.appVersion || 'N/A'}\n`;
    markdown += `- **版本号**: ${data.version}\n\n`;
    
    // 芯片支持范围
    if (data.chipRange && data.chipRange.length > 0) {
      markdown += `## 🔧 芯片支持范围\n\n`;
      markdown += data.chipRange.map(chip => `- ${chip}`).join('\n');
      markdown += '\n\n';
    }
    
    // SDK 版本详情
    if (data.sdkVersions && data.sdkVersions.length > 0) {
      markdown += `## 📦 SDK 版本详情\n\n`;
      markdown += `| 芯片 | 版本 | 备注 |\n`;
      markdown += `|------|------|------|\n`;
      data.sdkVersions.forEach(sdk => {
        markdown += `| ${sdk.chip} | ${sdk.version} | ${sdk.remark || '-'} |\n`;
      });
      markdown += '\n';
    }
    
    // 发布说明内容
    markdown += `## 📝 发布说明\n\n`;
    markdown += data.releaseNotes || '暂无发布说明内容';
    markdown += '\n\n';
    
    // 备注
    if (data.remarks) {
      markdown += `## 💡 备注\n\n`;
      markdown += data.remarks;
      markdown += '\n\n';
    }
    
    // 去掉底部的元信息（创建者和最后更新）
    
    return markdown;
  }

  /**
   * 获取版本级别文本
   */
  private getVersionLevelText(level: string): string {
    const levelMap: Record<string, string> = {
      'A': 'A类 - 问题修复，客户必须修复',
      'B': 'B类 - 性能优化，客户可选择修复',
      'C': 'C类 - 功能增加，客户可选择修复'
    };
    return levelMap[level] || level;
  }

  /**
   * 导出 Markdown 文件
   */
  public exportMarkdown(customContent?: string, releaseSubject?: string): ExportResult {
    const result = this.generateMarkdown(customContent, releaseSubject);
    if (!result.success || !result.markdown) {
      return { success: false, error: result.error };
    }

    try {
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      // 使用发布主题作为文件名，如果没有则使用默认格式
      const baseName = releaseSubject || 'ReleaseNotes';
      const fileName = `${baseName}_${timestamp}.md`;
      const filePath = path.join(this.outputDir, fileName);

      fs.writeFileSync(filePath, result.markdown, 'utf-8');
      console.log('[ReleaseNotesService] Markdown 导出成功:', filePath);

      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: `导出 Markdown 失败: ${(error as Error).message}` };
    }
  }

  /**
   * 保存编辑后的内容到文件
   */
  public saveEditedContent(content: string): { success: boolean; error?: string } {
    try {
      // 这里可以选择保存到 release-notes.json 或单独的文件
      // 暂时保存到单独的编辑文件
      const editPath = path.join(this.outputDir, 'edited-release-notes.md');
      fs.writeFileSync(editPath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: `保存失败: ${(error as Error).message}` };
    }
  }
}
