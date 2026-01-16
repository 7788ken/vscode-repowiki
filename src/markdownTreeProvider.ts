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
      const item = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = element.isPhysical ? 'physicalGroup' : 'virtualGroup';
      item.iconPath = new vscode.ThemeIcon(element.isPhysical ? 'folder' : 'folder-library');
      item.tooltip = element.isPhysical
        ? `物理目录: ${element.directoryPath || ''}`
        : '虚拟分组';
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

    // 根节点：返回目录树根节点
    if (!element) {
      return this.getRootNodes();
    }

    if (element.type !== 'group') {
      return [];
    }

    if (element.isPhysical) {
      return this.getDirectoryChildren(element.directoryPath || '');
    }

    if (element.groupName) {
      return this.getVirtualGroupFileNodes(element.groupName);
    }

    return [];
  }

  /** 获取根节点（目录树根 + 虚拟分组） */
  private async getRootNodes(): Promise<TreeNodeData[]> {
    const files = await this.scanMarkdownFiles();
    const directories = this.getImmediateDirectories(files, '');
    const directoryNodes = directories.map((dirPath) => this.buildDirectoryNode(dirPath));

    const rootFiles = files
      .filter((f) => f.directory === '' && f.isPhysical)
      .map((f) => this.buildFileNode(f));

    const virtualGroups = this.groupManager.getAllVirtualGroupNames();
    const virtualGroupNodes = virtualGroups.map((name) => ({
      type: 'group' as const,
      label: name,
      groupName: name,
      isPhysical: false,
    }));

    directoryNodes.sort((a, b) => a.label.localeCompare(b.label));
    rootFiles.sort((a, b) => a.label.localeCompare(b.label));
    virtualGroupNodes.sort((a, b) => a.label.localeCompare(b.label));

    return [...directoryNodes, ...rootFiles, ...virtualGroupNodes];
  }

  /** 获取目录下的直接子节点（子目录 + 文件） */
  private async getDirectoryChildren(directoryPath: string): Promise<TreeNodeData[]> {
    const files = await this.scanMarkdownFiles();
    const directories = this.getImmediateDirectories(files, directoryPath);
    const directoryNodes = directories.map((dirPath) => this.buildDirectoryNode(dirPath));

    const fileNodes = files
      .filter((f) => f.directory === directoryPath && f.isPhysical)
      .map((f) => this.buildFileNode(f));

    directoryNodes.sort((a, b) => a.label.localeCompare(b.label));
    fileNodes.sort((a, b) => a.label.localeCompare(b.label));

    return [...directoryNodes, ...fileNodes];
  }

  /** 获取虚拟分组下的文件节点 */
  private async getVirtualGroupFileNodes(groupName: string): Promise<TreeNodeData[]> {
    const files = await this.scanMarkdownFiles();
    return files
      .filter((f) => !f.isPhysical && f.groupName === groupName)
      .map((f) => this.buildFileNode(f))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private buildDirectoryNode(directoryPath: string): TreeNodeData {
    const displayName = this.groupManager.getDirectoryDisplayName(directoryPath);
    const label = displayName === directoryPath ? path.basename(directoryPath) : displayName;

    return {
      type: 'group' as const,
      label,
      isPhysical: true,
      directoryPath,
    };
  }

  private buildFileNode(file: MarkdownFileInfo): TreeNodeData {
    return {
      type: 'file' as const,
      label: file.name,
      filePath: file.absolutePath,
      relativePath: file.relativePath,
    };
  }

  private getImmediateDirectories(files: MarkdownFileInfo[], baseDir: string): string[] {
    const result = new Set<string>();
    const prefix = baseDir ? `${baseDir}${path.sep}` : '';

    for (const file of files) {
      if (!file.isPhysical) {
        continue;
      }
      if (!file.directory) {
        continue;
      }

      if (baseDir) {
        if (!file.directory.startsWith(prefix)) {
          continue;
        }
        const remainder = file.directory.slice(prefix.length);
        if (!remainder) {
          continue;
        }
        const nextSegment = remainder.split(path.sep)[0];
        result.add(`${baseDir}${path.sep}${nextSegment}`);
      } else {
        const nextSegment = file.directory.split(path.sep)[0];
        result.add(nextSegment);
      }
    }

    return [...result];
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
      const directoryPath = path.dirname(relativePath);
      const directory = directoryPath === '.' ? '' : directoryPath;
      
      // 获取文件所属分组
      const { groupName, isPhysical } = this.groupManager.getFileGroup(relativePath);

      return {
        name,
        absolutePath: uri.fsPath,
        relativePath,
        groupName,
        directory,
        isPhysical,
      };
    });
  }
}
