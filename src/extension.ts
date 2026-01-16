import * as vscode from 'vscode';
import { MarkdownTreeProvider } from './markdownTreeProvider';
import { FileWatcher } from './fileWatcher';
import { GroupManager } from './groupManager';
import { TreeNodeData } from './types';
import { DocGenerator } from './docGenerator';
import { AgentManager } from './agentManager';
import { AgentProviderType } from './agentTypes';

export function activate(context: vscode.ExtensionContext) {
  const treeProvider = new MarkdownTreeProvider(context);
  const fileWatcher = new FileWatcher();
  const groupManager = treeProvider.getGroupManager();

  // AI Agent 管理器
  const agentManager = new AgentManager();
  
  // 文档生成器
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const docGenerator = workspaceRoot 
    ? new DocGenerator(workspaceRoot, context.extensionPath, agentManager) 
    : undefined;

  // 首次启动初始化
  if (!groupManager.isInitialized()) {
    groupManager.markInitialized().then(() => {
      treeProvider.refresh();
    });
  }

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

  // 注册命令：删除虚拟分组
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.deleteGroup', async (node: TreeNodeData) => {
      if (!node?.groupName) {
        return;
      }

      // 物理分组不可删除
      if (node.isPhysical) {
        vscode.window.showWarningMessage('物理目录分组不可删除，只能设置别名');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `确定删除虚拟分组 "${node.groupName}"？该分组下的文件将回到物理目录分组。`,
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

  // 注册命令：重命名虚拟分组
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.renameGroup', async (node: TreeNodeData) => {
      if (!node?.groupName) {
        return;
      }

      // 物理分组不可重命名（应该使用别名功能）
      if (node.isPhysical) {
        vscode.window.showWarningMessage('物理目录分组不可重命名，请使用"设置别名"功能');
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: '输入新的虚拟分组名称',
        value: node.groupName,
        validateInput: (value) => {
          if (!value?.trim()) {
            return '虚拟分组名称不能为空';
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

  // 注册命令：设置目录别名
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.setAlias', async (node: TreeNodeData) => {
      if (!node?.directoryPath) {
        return;
      }

      const alias = await vscode.window.showInputBox({
        prompt: '输入目录别名',
        value: node.label,
        placeHolder: '别名（留空则清除别名）',
      });

      if (alias !== undefined) {
        await groupManager.setDirectoryAlias(node.directoryPath, alias.trim());
        treeProvider.refresh();
        vscode.window.showInformationMessage(`已设置目录别名`);
      }
    })
  );

  // 注册命令：检测 AI Agent
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.detectAgents', async () => {
      agentManager.show();
      
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '检测可用的 AI Agent',
          cancellable: false,
        },
        async () => {
          const configs = await agentManager.detectAvailableAgents();
          const available = configs.filter((c) => c.available);
          
          if (available.length === 0) {
            vscode.window.showErrorMessage('未检测到任何可用的 AI Agent，请先安装 Qoder、Claude 或其他支持的工具');
          } else {
            await agentManager.selectBestAgent();
            vscode.window.showInformationMessage(
              `检测到 ${available.length} 个可用的 AI Agent，当前使用: ${agentManager.getActiveAgent()?.name}`
            );
          }
        }
      );
    })
  );

  // 注册命令：切换 AI Agent
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.switchAgent', async () => {
      const agents = agentManager.getAvailableAgents();
      
      if (agents.length === 0) {
        const detect = await vscode.window.showInformationMessage(
          '还未检测 AI Agent，是否立即检测？',
          '检测',
          '取消'
        );
        
        if (detect === '检测') {
          await vscode.commands.executeCommand('repowiki.detectAgents');
        }
        return;
      }

      const items = agents.map((agent) => ({
        label: agent.name,
        description: agent === agentManager.getActiveAgent() ? '当前使用' : '',
        agent,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '选择要使用的 AI Agent',
      });

      if (selected) {
        const type = agentManager['getProviderType'](selected.agent);
        agentManager.setActiveAgent(type);
        vscode.window.showInformationMessage(`已切换到: ${selected.agent.name}`);
      }
    })
  );

  // 注册命令：初始化文档库
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.initDocs', async () => {
      if (!docGenerator) {
        vscode.window.showErrorMessage('未找到工作区根目录');
        return;
      }

      // 自动检测并选择 Agent
      if (!agentManager.getActiveAgent()) {
        await agentManager.detectAvailableAgents();
        await agentManager.selectBestAgent();
        
        if (!agentManager.getActiveAgent()) {
          vscode.window.showErrorMessage('未找到可用的 AI Agent，请先安装并配置');
          return;
        }
      }

      const confirm = await vscode.window.showWarningMessage(
        `将使用 ${agentManager.getActiveAgent()?.name} 初始化文档库并生成所有文档，这可能需要几分钟时间。是否继续？`,
        '继续',
        '取消'
      );

      if (confirm !== '继续') {
        return;
      }

      docGenerator.show();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '初始化文档库',
          cancellable: false,
        },
        async (progress) => {
          try {
            const result = await docGenerator.initializeDocs(progress);
            
            if (result.failed > 0) {
              vscode.window.showWarningMessage(
                `文档库初始化完成：成功 ${result.success}，失败 ${result.failed}`
              );
            } else {
              vscode.window.showInformationMessage(
                `文档库初始化完成：成功生成 ${result.success} 个文档`
              );
            }
            
            treeProvider.refresh();
          } catch (error: any) {
            vscode.window.showErrorMessage(`初始化失败: ${error.message}`);
          }
        }
      );
    })
  );

  // 注册命令：更新文档
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.updateDocs', async () => {
      if (!docGenerator) {
        vscode.window.showErrorMessage('未找到工作区根目录');
        return;
      }

      if (!agentManager.getActiveAgent()) {
        await agentManager.detectAvailableAgents();
        await agentManager.selectBestAgent();
        
        if (!agentManager.getActiveAgent()) {
          vscode.window.showErrorMessage('未找到可用的 AI Agent');
          return;
        }
      }

      docGenerator.show();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '更新文档',
          cancellable: false,
        },
        async (progress) => {
          try {
            const result = await docGenerator.updateDocs(progress);
            
            if (result.success === 0 && result.skipped > 0) {
              vscode.window.showInformationMessage('所有文档都是最新的');
            } else if (result.failed > 0) {
              vscode.window.showWarningMessage(
                `文档更新完成：成功 ${result.success}，失败 ${result.failed}，跳过 ${result.skipped}`
              );
            } else {
              vscode.window.showInformationMessage(
                `文档更新完成：更新 ${result.success} 个文档，跳过 ${result.skipped} 个`
              );
            }
            
            treeProvider.refresh();
          } catch (error: any) {
            vscode.window.showErrorMessage(`更新失败: ${error.message}`);
          }
        }
      );
    })
  );

  // 注册命令：强制重新生成
  context.subscriptions.push(
    vscode.commands.registerCommand('repowiki.regenerateDocs', async () => {
      if (!docGenerator) {
        vscode.window.showErrorMessage('未找到工作区根目录');
        return;
      }

      if (!agentManager.getActiveAgent()) {
        await agentManager.detectAvailableAgents();
        await agentManager.selectBestAgent();
        
        if (!agentManager.getActiveAgent()) {
          vscode.window.showErrorMessage('未找到可用的 AI Agent');
          return;
        }
      }

      const confirm = await vscode.window.showWarningMessage(
        '将删除所有现有文档并重新生成，这个操作不可撤销。是否继续？',
        '继续',
        '取消'
      );

      if (confirm !== '继续') {
        return;
      }

      docGenerator.show();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '重新生成文档',
          cancellable: false,
        },
        async (progress) => {
          try {
            const result = await docGenerator.regenerateAllDocs(progress);
            
            if (result.failed > 0) {
              vscode.window.showWarningMessage(
                `文档重新生成完成：成功 ${result.success}，失败 ${result.failed}`
              );
            } else {
              vscode.window.showInformationMessage(
                `文档重新生成完成：成功生成 ${result.success} 个文档`
              );
            }
            
            treeProvider.refresh();
          } catch (error: any) {
            vscode.window.showErrorMessage(`重新生成失败: ${error.message}`);
          }
        }
      );
    })
  );

  // 注册资源释放
  context.subscriptions.push(treeView, fileWatcher, agentManager);
  if (docGenerator) {
    context.subscriptions.push(docGenerator);
  }
}

export function deactivate() {}
