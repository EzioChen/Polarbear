import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import type { FileNode, PublishConfig } from '../publishFlow/types';

export interface PackResult {
  success: boolean;
  zipPath?: string;
  error?: string;
  packedFiles: number;
  skippedFiles: string[];
}

export interface PackCache {
  zipPath: string;
  createdAt: string;
  fileCount: number;
  totalSize: number;
}

export class PackService {
  private workspacePath: string;
  private configPath: string;
  private cacheDir: string;
  private cache: PackCache | null = null;

  constructor(workspacePath: string) {
    console.log('[PackService] 初始化, workspacePath:', workspacePath);
    this.workspacePath = workspacePath;
    this.configPath = path.join(workspacePath, '.releasePlan', 'publish-config.json');
    this.cacheDir = path.join(workspacePath, '.releasePlan', 'cache');
    console.log('[PackService] configPath:', this.configPath);
    console.log('[PackService] cacheDir:', this.cacheDir);
    this.ensureCacheDir();
  }

  /**
   * 确保缓存目录存在
   */
  private ensureCacheDir(): void {
    console.log('[PackService] 检查缓存目录:', this.cacheDir);
    if (!fs.existsSync(this.cacheDir)) {
      console.log('[PackService] 创建缓存目录');
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } else {
      console.log('[PackService] 缓存目录已存在');
    }
  }

  /**
   * 检查发布清单是否存在
   */
  public checkPublishConfig(): { exists: boolean; error?: string } {
    console.log('[PackService] 检查发布清单:', this.configPath);
    if (!fs.existsSync(this.configPath)) {
      console.log('[PackService] 发布清单文件不存在');
      return { exists: false, error: '发布清单文件不存在: ' + this.configPath };
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      console.log('[PackService] 发布清单文件大小:', content.length, '字节');
      const config: PublishConfig = JSON.parse(content);
      console.log('[PackService] 发布清单解析成功, 文件数量:', config.files?.length || 0);
      
      if (!config.files || config.files.length === 0) {
        console.log('[PackService] 发布清单中没有文件');
        return { exists: false, error: '发布清单中没有文件' };
      }

      return { exists: true };
    } catch (error) {
      console.error('[PackService] 发布清单解析失败:', error);
      return { exists: false, error: '发布清单文件格式错误: ' + (error as Error).message };
    }
  }

  /**
   * 检查文件是否存在
   */
  public checkFilesExist(): { allExist: boolean; missingFiles: string[]; existingFiles: FileNode[] } {
    console.log('[PackService] 开始检查文件存在性');
    const missingFiles: string[] = [];
    const existingFiles: FileNode[] = [];

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config: PublishConfig = JSON.parse(content);

      console.log('[PackService] 遍历文件节点, 根节点数量:', config.files.length);
      this.traverseFiles(config.files, (node) => {
        if (node.type === 'file' && node.sourcePath) {
          console.log('[PackService] 检查文件:', node.sourcePath);
          if (fs.existsSync(node.sourcePath)) {
            console.log('[PackService] 文件存在:', node.sourcePath);
            existingFiles.push(node);
          } else {
            console.log('[PackService] 文件不存在:', node.sourcePath);
            missingFiles.push(node.sourcePath);
          }
        }
      });

      console.log('[PackService] 文件检查完成, 存在:', existingFiles.length, '缺失:', missingFiles.length);
      return {
        allExist: missingFiles.length === 0,
        missingFiles,
        existingFiles
      };
    } catch (error) {
      console.error('[PackService] 检查文件存在性失败:', error);
      return {
        allExist: false,
        missingFiles: [(error as Error).message],
        existingFiles: []
      };
    }
  }

  /**
   * 遍历文件节点
   */
  private traverseFiles(nodes: FileNode[], callback: (node: FileNode) => void): void {
    for (const node of nodes) {
      callback(node);
      if (node.children && node.children.length > 0) {
        this.traverseFiles(node.children, callback);
      }
    }
  }

  /**
   * 打包发布清单内容
   * @param customFileName 自定义文件名（不含扩展名和时间戳）
   */
  public async pack(customFileName?: string): Promise<PackResult> {
    console.log('[PackService] ====== 开始打包 ======');
    console.log('[PackService] 自定义文件名:', customFileName || '无');
    
    // 1. 检查发布清单
    console.log('[PackService] 步骤1: 检查发布清单');
    const configCheck = this.checkPublishConfig();
    if (!configCheck.exists) {
      console.log('[PackService] 发布清单检查失败:', configCheck.error);
      return {
        success: false,
        error: configCheck.error,
        packedFiles: 0,
        skippedFiles: []
      };
    }
    console.log('[PackService] 发布清单检查通过');

    // 2. 检查文件是否存在
    console.log('[PackService] 步骤2: 检查文件存在性');
    const fileCheck = this.checkFilesExist();
    if (!fileCheck.allExist) {
      console.log('[PackService] 文件存在性检查失败, 缺失文件:', fileCheck.missingFiles);
      return {
        success: false,
        error: '以下文件不存在:\n' + fileCheck.missingFiles.join('\n'),
        packedFiles: 0,
        skippedFiles: fileCheck.missingFiles
      };
    }
    console.log('[PackService] 文件存在性检查通过, 文件数量:', fileCheck.existingFiles.length);

    try {
      console.log('[PackService] 步骤3: 读取发布清单内容');
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config: PublishConfig = JSON.parse(content);
      console.log('[PackService] 发布清单版本:', config.version);
      console.log('[PackService] 发布清单文件数:', config.files.length);

      console.log('[PackService] 步骤4: 创建 JSZip 实例');
      const zip = new JSZip();
      const skippedFiles: string[] = [];

      console.log('[PackService] 步骤5: 递归添加文件到 zip');
      const packedFiles = await this.addFilesToZip(zip, config.files, '', skippedFiles);
      console.log('[PackService] 添加到 zip 的文件数:', packedFiles);
      console.log('[PackService] 跳过的文件:', skippedFiles);

      // 4. 生成 zip 文件
      console.log('[PackService] 步骤6: 生成 zip 文件名');
      // 生成 yyyyMMdd 格式的时间戳
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const timestamp = `${year}${month}${day}`;
      // 使用自定义文件名或默认文件名
      const baseFileName = customFileName || `release-${config.version || '1.0.0'}`;
      const zipFileName = `${baseFileName}_${timestamp}.zip`;
      const zipPath = path.join(this.cacheDir, zipFileName);
      console.log('[PackService] zip 文件路径:', zipPath);

      console.log('[PackService] 步骤7: 生成 zip 内容');
      let zipContent: Buffer;
      try {
        zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        console.log('[PackService] zip 内容生成成功, 大小:', zipContent.length, '字节');
      } catch (zipError) {
        console.error('[PackService] zip 内容生成失败:', zipError);
        throw zipError;
      }

      console.log('[PackService] 步骤8: 写入 zip 文件');
      try {
        fs.writeFileSync(zipPath, zipContent);
        console.log('[PackService] zip 文件写入成功');
      } catch (writeError) {
        console.error('[PackService] zip 文件写入失败:', writeError);
        throw writeError;
      }

      // 5. 更新缓存信息
      console.log('[PackService] 步骤9: 更新缓存信息');
      this.cache = {
        zipPath,
        createdAt: new Date().toISOString(),
        fileCount: packedFiles,
        totalSize: zipContent.length
      };
      console.log('[PackService] 缓存信息:', this.cache);

      // 6. 保存缓存信息到文件
      console.log('[PackService] 步骤10: 保存缓存信息到文件');
      this.saveCacheInfo();

      console.log('[PackService] ====== 打包成功 ======');
      return {
        success: true,
        zipPath,
        packedFiles,
        skippedFiles
      };
    } catch (error) {
      console.error('[PackService] ====== 打包失败 ======');
      console.error('[PackService] 错误信息:', error);
      console.error('[PackService] 错误堆栈:', (error as Error).stack);
      return {
        success: false,
        error: '打包失败: ' + (error as Error).message + '\n' + (error as Error).stack,
        packedFiles: 0,
        skippedFiles: []
      };
    }
  }

  /**
   * 递归添加文件到 zip
   */
  private async addFilesToZip(
    zip: JSZip,
    nodes: FileNode[],
    currentPath: string,
    skippedFiles: string[]
  ): Promise<number> {
    console.log('[PackService] addFilesToZip 开始, 节点数:', nodes.length, '当前路径:', currentPath);
    let packedFiles = 0;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
      console.log(`[PackService] 处理节点 ${i + 1}/${nodes.length}: ${node.name} (类型: ${node.type})`);

      if (node.type === 'folder') {
        console.log('[PackService] 创建文件夹:', nodePath);
        try {
          const folder = zip.folder(nodePath);
          if (folder && node.children) {
            console.log('[PackService] 递归处理子文件夹, 子节点数:', node.children.length);
            const count = await this.addFilesToZip(folder, node.children, '', skippedFiles);
            packedFiles += count;
            console.log('[PackService] 子文件夹处理完成, 添加文件数:', count);
          } else {
            console.log('[PackService] 文件夹创建失败或无子节点');
          }
        } catch (folderError) {
          console.error('[PackService] 创建文件夹失败:', nodePath, folderError);
        }
      } else if (node.type === 'file' && node.sourcePath) {
        console.log('[PackService] 添加文件:', nodePath, '源路径:', node.sourcePath);
        if (fs.existsSync(node.sourcePath)) {
          try {
            console.log('[PackService] 读取文件内容:', node.sourcePath);
            const fileContent = fs.readFileSync(node.sourcePath);
            console.log('[PackService] 文件读取成功, 大小:', fileContent.length, '字节');
            
            console.log('[PackService] 添加到 zip:', nodePath);
            zip.file(nodePath, fileContent);
            packedFiles++;
            console.log('[PackService] 文件添加成功, 当前计数:', packedFiles);
          } catch (readError) {
            console.error('[PackService] 读取文件失败:', node.sourcePath, readError);
            skippedFiles.push(node.sourcePath);
          }
        } else {
          console.log('[PackService] 文件不存在, 跳过:', node.sourcePath);
          skippedFiles.push(node.sourcePath);
        }
      } else {
        console.log('[PackService] 未知节点类型或缺少 sourcePath:', node);
      }
    }
    console.log('[PackService] addFilesToZip 完成, 打包文件数:', packedFiles);
    return packedFiles;
  }

  /**
   * 保存缓存信息到文件
   */
  private saveCacheInfo(): void {
    console.log('[PackService] 保存缓存信息');
    if (this.cache) {
      const cacheInfoPath = path.join(this.cacheDir, 'cache-info.json');
      console.log('[PackService] 缓存文件路径:', cacheInfoPath);
      try {
        fs.writeFileSync(cacheInfoPath, JSON.stringify(this.cache, null, 2));
        console.log('[PackService] 缓存信息保存成功');
      } catch (error) {
        console.error('[PackService] 缓存信息保存失败:', error);
      }
    } else {
      console.log('[PackService] 无缓存信息可保存');
    }
  }

  /**
   * 加载缓存信息
   */
  public loadCache(): PackCache | null {
    console.log('[PackService] 加载缓存信息');
    const cacheInfoPath = path.join(this.cacheDir, 'cache-info.json');
    if (fs.existsSync(cacheInfoPath)) {
      try {
        const content = fs.readFileSync(cacheInfoPath, 'utf-8');
        this.cache = JSON.parse(content);
        console.log('[PackService] 缓存信息加载成功:', this.cache);
        return this.cache;
      } catch (error) {
        console.error('[PackService] 缓存信息加载失败:', error);
        return null;
      }
    }
    console.log('[PackService] 缓存文件不存在');
    return null;
  }

  /**
   * 获取缓存的 zip 路径
   */
  public getCachedZipPath(): string | null {
    console.log('[PackService] 获取缓存的 zip 路径');
    if (this.cache && fs.existsSync(this.cache.zipPath)) {
      console.log('[PackService] 返回缓存路径:', this.cache.zipPath);
      return this.cache.zipPath;
    }
    
    // 尝试从文件加载
    const cache = this.loadCache();
    if (cache && fs.existsSync(cache.zipPath)) {
      console.log('[PackService] 从文件加载缓存路径:', cache.zipPath);
      return cache.zipPath;
    }
    
    console.log('[PackService] 无可用缓存路径');
    return null;
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    console.log('[PackService] 清除缓存');
    this.cache = null;
    const cacheInfoPath = path.join(this.cacheDir, 'cache-info.json');
    if (fs.existsSync(cacheInfoPath)) {
      try {
        fs.unlinkSync(cacheInfoPath);
        console.log('[PackService] 缓存信息文件已删除');
      } catch (error) {
        console.error('[PackService] 删除缓存信息文件失败:', error);
      }
    }
    
    // 删除所有 zip 文件
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      console.log('[PackService] 缓存目录文件数:', files.length);
      for (const file of files) {
        if (file.endsWith('.zip')) {
          try {
            fs.unlinkSync(path.join(this.cacheDir, file));
            console.log('[PackService] 删除 zip 文件:', file);
          } catch (error) {
            console.error('[PackService] 删除 zip 文件失败:', file, error);
          }
        }
      }
    }
    console.log('[PackService] 缓存清除完成');
  }

  /**
   * 获取打包预览信息
   */
  public getPackPreview(): { fileCount: number; totalSize: number; folders: string[] } {
    console.log('[PackService] 获取打包预览信息');
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config: PublishConfig = JSON.parse(content);

      let fileCount = 0;
      let totalSize = 0;
      const folders: string[] = [];

      this.traverseFiles(config.files, (node) => {
        if (node.type === 'file' && node.sourcePath && fs.existsSync(node.sourcePath)) {
          fileCount++;
          const stats = fs.statSync(node.sourcePath);
          totalSize += stats.size;
        } else if (node.type === 'folder') {
          folders.push(node.name);
        }
      });

      console.log('[PackService] 预览信息 - 文件数:', fileCount, '总大小:', totalSize, '文件夹:', folders);
      return { fileCount, totalSize, folders };
    } catch (error) {
      console.error('[PackService] 获取预览信息失败:', error);
      return { fileCount: 0, totalSize: 0, folders: [] };
    }
  }
}
