import * as vscode from 'vscode';
import * as path from 'path';
import { DocMappingConfig } from './docMappingConfig';
import { CodeDocMapping } from './docTypes';

/**
 * 源代码文件监听器
 * 监听源代码文件的保存事件，自动触发对应的文档更新
 */
export class SourceFileWatcher implements vscode.Disposable {
  private mappings: CodeDocMapping[] = [];
  private sourcePathToDocMap: Map<string, CodeDocMapping> = new Map();
  private disposables: vscode.Disposable[] = [];
  private onUpdateCallback?: (affectedMappings: CodeDocMapping[]) => void;
  private updateTimer: NodeJS.Timeout | undefined;
  private pendingMappings: Set<CodeDocMapping> = new Set();
  private enabled: boolean = false;

  constructor() {
    this.loadConfig();
    this.loadMappings();
    this.setupWatchers();
  }

  /** 加载配置 */
  private loadConfig(): void {
    const config = vscode.workspace.getConfiguration('repowiki');
    this.enabled = config.get<boolean>('autoUpdateOnSave', false);
  }

  /** 加载文档映射配置 */
  private loadMappings(): void {
    this.mappings = DocMappingConfig.loadFromWorkspace();
    this.buildPathMap();
  }

  /** 构建源文件路径到文档映射的索引 */
  private buildPathMap(): void {
    this.sourcePathToDocMap.clear();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceRoot) {
      return;
    }

    for (const mapping of this.mappings) {
      // 支持相对路径和绝对路径匹配
      const sourceAbsPath = path.join(workspaceRoot, mapping.sourcePath);
      this.sourcePathToDocMap.set(mapping.sourcePath, mapping);
      this.sourcePathToDocMap.set(sourceAbsPath, mapping);
    }
  }

  /** 设置文件保存监听器 */
  private setupWatchers(): void {
    // 监听文本文件保存事件
    const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
      this.handleFileSave(document);
    });

    // 监听配置变化
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('repowiki.docMappings')) {
        this.loadMappings();
      }
      if (e.affectsConfiguration('repowiki.autoUpdateOnSave')) {
        this.loadConfig();
      }
    });

    this.disposables.push(saveListener, configListener);
  }

  /** 处理文件保存事件 */
  private handleFileSave(document: vscode.TextDocument): void {
    // 检查是否启用
    if (!this.enabled) {
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }

    const filePath = document.uri.fsPath;
    const relativePath = path.relative(workspaceRoot, filePath);

    // 查找匹配的文档映射
    const affectedMappings = this.findAffectedMappings(relativePath, filePath);

    if (affectedMappings.length > 0) {
      this.scheduleUpdate(affectedMappings);
    }
  }

  /** 查找受影响的文档映射 */
  private findAffectedMappings(relativePath: string, absolutePath: string): CodeDocMapping[] {
    const affected: CodeDocMapping[] = [];

    // 精确匹配
    if (this.sourcePathToDocMap.has(relativePath)) {
      const mapping = this.sourcePathToDocMap.get(relativePath);
      if (mapping) {
        affected.push(mapping);
      }
    }

    // 绝对路径匹配
    if (this.sourcePathToDocMap.has(absolutePath)) {
      const mapping = this.sourcePathToDocMap.get(absolutePath);
      if (mapping && !affected.includes(mapping)) {
        affected.push(mapping);
      }
    }

    return affected;
  }

  /** 调度延迟更新（避免频繁更新） */
  private scheduleUpdate(affectedMappings: CodeDocMapping[]): void {
    // 添加到待更新集合
    affectedMappings.forEach((m) => this.pendingMappings.add(m));

    // 清除之前的定时器
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    // 获取延迟配置
    const config = vscode.workspace.getConfiguration('repowiki');
    const delay = config.get<number>('autoUpdateDelay', 1000);

    // 设置新的定时器
    this.updateTimer = setTimeout(() => {
      this.executeUpdate();
    }, delay);
  }

  /** 执行更新 */
  private executeUpdate(): void {
    if (this.pendingMappings.size === 0) {
      return;
    }

    const affectedMappings = Array.from(this.pendingMappings);
    this.pendingMappings.clear();

    // 检查是否显示通知
    const config = vscode.workspace.getConfiguration('repowiki');
    const showNotification = config.get<boolean>('autoUpdateShowNotification', true);

    if (showNotification) {
      const titles = affectedMappings.map((m) => m.title).join('、');
      vscode.window.showInformationMessage(
        `检测到源文件变更，将更新文档: ${titles}`,
        '立即更新',
        '取消'
      ).then((selection) => {
        if (selection === '立即更新' && this.onUpdateCallback) {
          this.onUpdateCallback(affectedMappings);
        }
      });
    } else {
      // 静默执行
      if (this.onUpdateCallback) {
        this.onUpdateCallback(affectedMappings);
      }
    }
  }

  /**
   * 设置文档更新回调
   * @param callback 当检测到源文件变更时的回调函数
   */
  onUpdate(callback: (affectedMappings: CodeDocMapping[]) => void): void {
    this.onUpdateCallback = callback;
  }

  /** 重新加载映射配置 */
  reloadMappings(): void {
    this.loadMappings();
  }

  dispose(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
