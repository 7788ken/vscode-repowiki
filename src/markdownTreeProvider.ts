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
      // 根据分组类型设置不同的 contextValue
      item.contextValue = element.isPhysical ? 'physicalGroup' : 'virtualGroup';
      item.iconPath = new vscode.ThemeIcon(element.isPhysical ? 'folder' : 'folder-library');
      item.tooltip = element.isPhysical ? `物理目录: ${element.directoryPath}` : '虚拟分组';
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
      return this.getFileNodes(element.groupName, element.isPhysical || false, element.directoryPath);
    }

    return [];
  }

  /** 获取所有分组节点（物理+虚拟） */
  private async getGroupNodes(): Promise<TreeNodeData[]> {
    const files = await this.scanMarkdownFiles();
    const nodes: TreeNodeData[] = [];

    // 1. 物理分组（目录）
    const physicalGroups = await this.groupManager.getPhysicalGroups(files);
    for (const [dirPath, displayName] of physicalGroups.entries()) {
      nodes.push({
        type: 'group' as const,
        label: displayName,
        groupName: displayName,
        isPhysical: true,
        directoryPath: dirPath,
      });
    }

    // 2. 虚拟分组
    const virtualGroups = this.groupManager.getAllVirtualGroupNames();
    for (const name of virtualGroups) {
      nodes.push({
        type: 'group' as const,
        label: name,
        groupName: name,
        isPhysical: false,
      });
    }

    // 排序：物理分组在前，虚拟分组在后
    nodes.sort((a, b) => {
      if (a.isPhysical === b.isPhysical) {
        return a.label.localeCompare(b.label);
      }
      return a.isPhysical ? -1 : 1;
    });

    return nodes;
  }

  /** 获取指定分组下的文件节点 */
  private async getFileNodes(groupName: string, isPhysical: boolean, directoryPath?: string): Promise<TreeNodeData[]> {
    const files = await this.scanMarkdownFiles();
    
    return files
      .filter((f) => {
        if (isPhysical && directoryPath !== undefined) {
          // 物理分组：只显示该目录下且未被虚拟分组占用的文件
          return f.directory === directoryPath && f.isPhysical;
        } else {
          // 虚拟分组：显示分配到该虚拟分组的文件
          return !f.isPhysical && f.groupName === groupName;
        }
      })
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
      const directory = path.dirname(relativePath);
      
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
