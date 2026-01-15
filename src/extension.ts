import * as vscode from 'vscode';
import { MarkdownTreeProvider } from './markdownTreeProvider';
import { FileWatcher } from './fileWatcher';
import { GroupManager } from './groupManager';
import { TreeNodeData } from './types';

export function activate(context: vscode.ExtensionContext) {
  const treeProvider = new MarkdownTreeProvider(context);
  const fileWatcher = new FileWatcher();
  const groupManager = treeProvider.getGroupManager();

  // 注册 TreeView
  const treeView = vscode.window.createTreeView('repowiki.markdownExplorer', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // 文件变化时刷新视图
  fileWatcher.onDidChange(() => treeProvider.refresh());

  // 配置变化时刷新视图
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('repowiki')) {
        treeProvider.refresh();
      }
    })
  );

  // 注册命令：刷新
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.refresh', () => {
      treeProvider.refresh();
    })
  );

  // 注册命令：打开文件
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.openFile', async (filePath: string) => {
      if (!filePath) {
        return;
      }
      try {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(`无法打开文件: ${filePath}`);
      }
    })
  );

  // 注册命令：创建分组
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.createGroup', async () => {
      const name = await vscode.window.showInputBox({
        prompt: '输入新分组名称',
        placeHolder: '分组名称',
        validateInput: (value) => {
          if (!value?.trim()) {
            return '分组名称不能为空';
          }
          if (value === GroupManager.DEFAULT_GROUP) {
            return '不能使用默认分组名';
          }
          return null;
        },
      });

      if (name) {
        const success = await groupManager.createGroup(name.trim());
        if (success) {
          treeProvider.refresh();
        }
      }
    })
  );

  // 注册命令：删除分组
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.deleteGroup', async (node: TreeNodeData) => {
      if (!node?.groupName) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `确定删除分组 "${node.groupName}"？该分组下的文件将移至"未分类"。`,
        '确定',
        '取消'
      );

      if (confirm === '确定') {
        const success = await groupManager.deleteGroup(node.groupName);
        if (success) {
          treeProvider.refresh();
        }
      }
    })
  );

  // 注册命令：重命名分组
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.renameGroup', async (node: TreeNodeData) => {
      if (!node?.groupName) {
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: '输入新的分组名称',
        value: node.groupName,
        validateInput: (value) => {
          if (!value?.trim()) {
            return '分组名称不能为空';
          }
          if (value === GroupManager.DEFAULT_GROUP) {
            return '不能使用默认分组名';
          }
          return null;
        },
      });

      if (newName && newName !== node.groupName) {
        const success = await groupManager.renameGroup(node.groupName, newName.trim());
        if (success) {
          treeProvider.refresh();
        }
      }
    })
  );

  // 注册命令：移动文件到分组
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.moveToGroup', async (node: TreeNodeData) => {
      if (!node?.relativePath) {
        return;
      }

      const groups = groupManager.getAllGroupNames();
      const selected = await vscode.window.showQuickPick(groups, {
        placeHolder: '选择目标分组',
      });

      if (selected) {
        const success = await groupManager.moveFileToGroup(node.relativePath, selected);
        if (success) {
          treeProvider.refresh();
        }
      }
    })
  );

  // 注册资源释放
  context.subscriptions.push(treeView, fileWatcher);
}

export function deactivate() {}
