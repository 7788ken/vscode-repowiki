import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DocStatus, DocMetadata, DocGenerationResult } from './docTypes';
import { DocStatusChecker } from './docStatusChecker';
import { DocMappingConfig } from './docMappingConfig';
import { AgentManager } from './agentManager';
import { AgentCallParams } from './agentTypes';

export class DocGenerator {
  private workspaceRoot: string;
  private extensionPath: string;
  private statusChecker: DocStatusChecker;
  private outputChannel: vscode.OutputChannel;
  private agentManager: AgentManager;

  constructor(workspaceRoot: string, extensionPath: string, agentManager: AgentManager) {
    this.workspaceRoot = workspaceRoot;
    this.extensionPath = extensionPath;
    this.statusChecker = new DocStatusChecker(workspaceRoot);
    this.outputChannel = vscode.window.createOutputChannel('RepoWiki 文档生成');
    this.agentManager = agentManager;
  }

  private async checkRepowikiExists(): Promise<boolean> {
    const repowikiPath = path.join(this.workspaceRoot, 'repowiki');
    try {
      await fs.access(repowikiPath);
      return true;
    } catch {
      return false;
    }
  }

  private async initRepowikiStructure(): Promise<void> {
    const repowikiPath = path.join(this.workspaceRoot, 'repowiki');
    const contentPath = path.join(repowikiPath, 'zh', 'content');
    const metaPath = path.join(repowikiPath, 'zh', 'meta');

    await fs.mkdir(contentPath, { recursive: true });
    await fs.mkdir(metaPath, { recursive: true });

    // 模板文件从插件目录获取，而非用户工作区
    const skillTemplatePath = path.join(this.extensionPath, 'REPO_WIKI', 'skill-repowiki生成规则.md');
    const skillTargetPath = path.join(repowikiPath, 'skill.md');
    
    try {
      await fs.copyFile(skillTemplatePath, skillTargetPath);
      this.log(`✓ 已复制 skill.md 模板`);
    } catch (error) {
      this.log(`警告: 无法复制 skill.md 模板文件`);
      this.log(`  源路径: ${skillTemplatePath}`);
      this.log(`  目标路径: ${skillTargetPath}`);
      this.log(`  错误: ${error}`);
    }

    this.log('✓ 已初始化 repowiki 目录结构');
  }

  private async callAgent(docPath: string, title: string, sourceFiles: string[], isUpdate: boolean): Promise<void> {
    const agent = this.agentManager.getActiveAgent();
    
    if (!agent) {
      throw new Error('没有可用的 AI Agent，请先检测并选择一个 Agent');
    }

    this.log(`使用 ${agent.name} 生成文档`);
    if (sourceFiles.length > 0) {
      this.log(`  源文件: ${sourceFiles.join(', ')}`);
    }

    const params: AgentCallParams = {
      docPath,
      title,
      sourceFiles,
      workspaceRoot: this.workspaceRoot,
      isUpdate,
    };

    const result = await agent.call(params);

    if (!result.success) {
      throw new Error(result.error || 'Agent 调用失败');
    }

    if (result.stdout) {
      this.log(result.stdout);
    }
    if (result.stderr) {
      this.log(`stderr: ${result.stderr}`);
    }
  }

  private async generateDoc(metadata: DocMetadata): Promise<void> {
    this.log(`\n生成文档: ${metadata.title}`);
    this.log(`  路径: ${metadata.docPath}`);
    this.log(`  状态: ${metadata.status}`);

    const docAbsPath = path.join(this.workspaceRoot, 'repowiki', metadata.docPath);
    const docDir = path.dirname(docAbsPath);
    await fs.mkdir(docDir, { recursive: true });

    const isUpdate = metadata.status === DocStatus.OUTDATED;
    await this.callAgent(metadata.docPath, metadata.title, metadata.sourceFiles, isUpdate);
    
    this.log(`✓ 完成: ${metadata.title}`);
  }

  async initializeDocs(
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<DocGenerationResult> {
    const startTime = Date.now();
    const result: DocGenerationResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      errors: [],
    };

    this.log('=== 初始化文档库 ===\n');

    const exists = await this.checkRepowikiExists();
    if (!exists) {
      progress.report({ message: '初始化目录结构...' });
      await this.initRepowikiStructure();
    }

    const mappings = DocMappingConfig.loadFromWorkspace();
    this.log(`加载了 ${mappings.length} 个文档映射配置\n`);

    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      const progressPercent = ((i + 1) / mappings.length) * 100;
      
      progress.report({
        message: `生成 ${mapping.title} (${i + 1}/${mappings.length})`,
        increment: progressPercent / mappings.length,
      });

      try {
        const metadata: DocMetadata = {
          docPath: mapping.docPath,
          sourceFiles: [mapping.sourcePath],
          status: DocStatus.MISSING,
          title: mapping.title,
        };

        await this.generateDoc(metadata);
        result.success++;
      } catch (error: any) {
        this.log(`✗ 失败: ${mapping.title} - ${error.message}`);
        result.failed++;
        result.errors.push(`${mapping.title}: ${error.message}`);
      }
    }

    result.duration = Date.now() - startTime;
    this.logSummary(result);
    return result;
  }

  async updateDocs(
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<DocGenerationResult> {
    const startTime = Date.now();
    const result: DocGenerationResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      errors: [],
    };

    this.log('=== 更新文档库 ===\n');

    progress.report({ message: '检查文档状态...' });
    const mappings = DocMappingConfig.loadFromWorkspace();
    const metadataList = await this.statusChecker.checkAllDocs(mappings);
    const summary = this.statusChecker.summarizeStatus(metadataList);

    this.log(`文档状态统计:`);
    this.log(`  缺失: ${summary.missing}`);
    this.log(`  过时: ${summary.outdated}`);
    this.log(`  最新: ${summary.upToDate}\n`);

    const docsToProcess = metadataList.filter(
      (m) => m.status === DocStatus.MISSING || m.status === DocStatus.OUTDATED
    );

    if (docsToProcess.length === 0) {
      this.log('所有文档都是最新的，无需更新。');
      result.skipped = metadataList.length;
      result.duration = Date.now() - startTime;
      return result;
    }

    for (let i = 0; i < docsToProcess.length; i++) {
      const metadata = docsToProcess[i];
      const progressPercent = ((i + 1) / docsToProcess.length) * 100;
      
      const action = metadata.status === DocStatus.MISSING ? '生成' : '维护';
      progress.report({
        message: `${action} ${metadata.title} (${i + 1}/${docsToProcess.length})`,
        increment: progressPercent / docsToProcess.length,
      });

      try {
        await this.generateDoc(metadata);
        result.success++;
      } catch (error: any) {
        this.log(`✗ 失败: ${metadata.title} - ${error.message}`);
        result.failed++;
        result.errors.push(`${metadata.title}: ${error.message}`);
      }
    }

    result.skipped = summary.upToDate;
    result.duration = Date.now() - startTime;
    this.logSummary(result);
    return result;
  }

  async regenerateAllDocs(
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<DocGenerationResult> {
    this.log('=== 强制重新生成所有文档 ===\n');
    
    const repowikiPath = path.join(this.workspaceRoot, 'repowiki', 'zh', 'content');
    try {
      await fs.rm(repowikiPath, { recursive: true, force: true });
      this.log('已清空现有文档\n');
    } catch (error) {
      this.log(`清空文档失败: ${error}`);
    }

    return this.initializeDocs(progress);
  }

  private log(message: string): void {
    this.outputChannel.appendLine(message);
  }

  private logSummary(result: DocGenerationResult): void {
    this.log('\n=== 生成结果 ===');
    this.log(`成功: ${result.success}`);
    this.log(`失败: ${result.failed}`);
    this.log(`跳过: ${result.skipped}`);
    this.log(`耗时: ${(result.duration / 1000).toFixed(2)} 秒`);

    if (result.errors.length > 0) {
      this.log('\n错误详情:');
      result.errors.forEach((err) => this.log(`  - ${err}`));
    }
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}