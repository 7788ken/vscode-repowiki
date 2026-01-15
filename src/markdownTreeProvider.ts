import * as vscode from 'vscode';
import * as path from 'path';
import { TreeNodeData, MarkdownFileInfo } from './types';
import { GroupManager } from './groupManager';

export class MarkdownTreeProvider implements vscode.TreeDataProvider<TreeNodeData> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNodeData | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private groupManager: GroupManager;

  constructor(context: vscode.ExtensionContext) {
    this.groupManager = new GroupManager(context);
  }

  /** 刷新整个树视图 */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /** 获取分组管理器 */
  getGroupManager(): GroupManager {
    return this.groupManager;
  }

  getTreeItem(element: TreeNodeData): vscode.TreeItem {
    if (element.type === 'group') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = 'group';
      item.iconPath = new vscode.ThemeIcon('folder');
      return item;
    }

    // 文件节点
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'file';
    item.iconPath = new vscode.ThemeIcon('markdown');
    item.tooltip = element.relativePath;
    item.command = {
      command: 'repowiki.openFile',
      title: '打开文件',
      arguments: [element.filePath],
    };
    return item;
  }

  async getChildren(element?: TreeNodeData): Promise<TreeNodeData[]> {
    if (!vscode.workspace.workspaceFolders?.length) {
      return [];
    }

    // 根节点：返回所有分组
    if (!element) {
      return this.getGroupNodes();
    }

    // 分组节点：返回该分组下的文件
    if (element.type === 'group' && element.groupName) {
      return this.getFileNodes(element.groupName);
    }

    return [];
  }

  /** 获取所有分组节点 */
  private async getGroupNodes(): Promise<TreeNodeData[]> {
    const files = await this.scanMarkdownFiles();
    const groupNames = new Set<string>();

    // 收集所有使用中的分组名
    for (const file of files) {
      groupNames.add(file.groupName);
    }

    // 添加用户创建的空分组
    const configGroups = this.groupManager.getAllGroupNames();
    for (const name of configGroups) {
      groupNames.add(name);
    }

    // 确保"未分类"在最后
    const sorted = Array.from(groupNames).filter((n) => n !== GroupManager.DEFAULT_GROUP);
    sorted.sort();
    sorted.push(GroupManager.DEFAULT_GROUP);

    return sorted.map((name) => ({
      type: 'group' as const,
      label: name,
      groupName: name,
    }));
  }

  /** 获取指定分组下的文件节点 */
  private async getFileNodes(groupName: string): Promise<TreeNodeData[]> {
    const files = await this.scanMarkdownFiles();
    return files
      .filter((f) => f.groupName === groupName)
      .map((f) => ({
        type: 'file' as const,
        label: f.name,
        filePath: f.absolutePath,
        relativePath: f.relativePath,
      }));
  }

  /** 扫描工作区所有 Markdown 文件 */
  private async scanMarkdownFiles(): Promise<MarkdownFileInfo[]> {
    const config = vscode.workspace.getConfiguration('repowiki');
    const excludePatterns = config.get<string[]>('excludePatterns') || [];

    // 构建排除 glob
    const exclude = excludePatterns.length > 0 ? `{${excludePatterns.join(',')}}` : undefined;

    const uris = await vscode.workspace.findFiles('**/*.md', exclude);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return [];
    }

    return uris.map((uri) => {
      const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
      const name = path.basename(uri.fsPath);
      const groupName = this.groupManager.getFileGroup(relativePath);

      return {
        name,
        absolutePath: uri.fsPath,
        relativePath,
        groupName,
      };
    });
  }
}
