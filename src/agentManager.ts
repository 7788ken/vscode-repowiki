import * as vscode from 'vscode';
import { AgentProvider } from './agentProvider';
import { AgentProviderType, AgentProviderConfig } from './agentTypes';
import {
  QoderProvider,
  ClaudeProvider,
  CodexProvider,
  CursorProvider,
  AiderProvider,
  CustomProvider,
} from './agentProviders';

/** AI Agent 管理器 */
export class AgentManager {
  private providers: Map<AgentProviderType, AgentProvider> = new Map();
  private availableProviders: AgentProvider[] = [];
  private activeProvider: AgentProvider | undefined;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('RepoWiki Agent Manager');
    this.initializeProviders();
  }

  /** 初始化所有提供者 */
  private initializeProviders(): void {
    this.providers.set(AgentProviderType.QODER, new QoderProvider());
    this.providers.set(AgentProviderType.CLAUDE, new ClaudeProvider());
    this.providers.set(AgentProviderType.CODEX, new CodexProvider());
    this.providers.set(AgentProviderType.CURSOR, new CursorProvider());
    this.providers.set(AgentProviderType.AIDER, new AiderProvider());
  }

  /** 检测所有可用的 Agent */
  async detectAvailableAgents(): Promise<AgentProviderConfig[]> {
    this.log('开始检测可用的 AI Agent...\n');

    // 清空之前的检测结果，避免重复
    this.availableProviders = [];

    const configs: AgentProviderConfig[] = [];

    for (const [type, provider] of this.providers.entries()) {
      const available = await provider.isAvailable();
      const version = available ? await provider.getVersion() : undefined;

      this.log(`${provider.name}: ${available ? '✓ 可用' : '✗ 不可用'}${version ? ` (${version})` : ''}`);

      configs.push({
        type,
        available,
        priority: this.getDefaultPriority(type),
      });

      if (available) {
        this.availableProviders.push(provider);
      }
    }

    // 加载用户自定义配置
    const customConfig = this.loadCustomProviderConfig();
    if (customConfig) {
      const customProvider = new CustomProvider(
        customConfig.commandName,
        customConfig.commandTemplate
      );
      const available = await customProvider.isAvailable();

      this.log(`自定义命令 (${customConfig.commandName}): ${available ? '✓ 可用' : '✗ 不可用'}`);

      configs.push({
        type: AgentProviderType.CUSTOM,
        available,
        priority: customConfig.priority || 100,
        extraConfig: customConfig,
      });

      if (available) {
        this.providers.set(AgentProviderType.CUSTOM, customProvider);
        this.availableProviders.push(customProvider);
      }
    }

    this.log(`\n检测完成，找到 ${this.availableProviders.length} 个可用的 Agent\n`);

    return configs;
  }

  /** 自动选择最佳 Agent */
  async selectBestAgent(): Promise<AgentProvider | undefined> {
    if (this.availableProviders.length === 0) {
      await this.detectAvailableAgents();
    }

    // 从配置中读取用户偏好
    const config = vscode.workspace.getConfiguration('repowiki');
    const preferredType = config.get<AgentProviderType>('preferredAgent');

    // 如果用户指定了偏好，优先使用
    if (preferredType) {
      const preferred = this.providers.get(preferredType);
      if (preferred && this.availableProviders.includes(preferred)) {
        this.activeProvider = preferred;
        this.log(`使用用户偏好的 Agent: ${preferred.name}`);
        return preferred;
      }
    }

    // 否则按优先级排序
    const sorted = [...this.availableProviders].sort((a, b) => {
      const priorityA = this.getDefaultPriority(this.getProviderType(a));
      const priorityB = this.getDefaultPriority(this.getProviderType(b));
      return priorityA - priorityB;
    });

    this.activeProvider = sorted[0];
    if (this.activeProvider) {
      this.log(`自动选择 Agent: ${this.activeProvider.name}`);
    }

    return this.activeProvider;
  }

  /** 获取当前激活的 Agent */
  getActiveAgent(): AgentProvider | undefined {
    return this.activeProvider;
  }

  /** 手动设置激活的 Agent */
  setActiveAgent(type: AgentProviderType): boolean {
    const provider = this.providers.get(type);
    if (provider && this.availableProviders.includes(provider)) {
      this.activeProvider = provider;
      this.log(`切换到 Agent: ${provider.name}`);
      return true;
    }
    return false;
  }

  /** 获取所有可用的 Agent */
  getAvailableAgents(): AgentProvider[] {
    return [...this.availableProviders];
  }

  /** 获取提供者类型的默认优先级 */
  private getDefaultPriority(type: AgentProviderType): number {
    const priorities: Record<AgentProviderType, number> = {
      [AgentProviderType.QODER]: 1,
      [AgentProviderType.CLAUDE]: 2,
      [AgentProviderType.CODEX]: 3,
      [AgentProviderType.CURSOR]: 4,
      [AgentProviderType.AIDER]: 5,
      [AgentProviderType.CUSTOM]: 100,
    };
    return priorities[type] || 999;
  }

  /** 根据 Provider 实例获取类型 */
  private getProviderType(provider: AgentProvider): AgentProviderType {
    for (const [type, p] of this.providers.entries()) {
      if (p === provider) {
        return type;
      }
    }
    return AgentProviderType.CUSTOM;
  }

  /** 加载自定义提供者配置 */
  private loadCustomProviderConfig(): { commandName: string; commandTemplate: string; priority?: number } | undefined {
    const config = vscode.workspace.getConfiguration('repowiki');
    const customCommand = config.get<string>('customAgentCommand');
    const customTemplate = config.get<string>('customAgentTemplate');

    if (customCommand && customTemplate) {
      return {
        commandName: customCommand,
        commandTemplate: customTemplate,
        priority: config.get<number>('customAgentPriority'),
      };
    }

    return undefined;
  }

  /** 输出日志 */
  private log(message: string): void {
    this.outputChannel.appendLine(message);
  }

  /** 显示输出面板 */
  show(): void {
    this.outputChannel.show();
  }

  /** 释放资源 */
  dispose(): void {
    this.outputChannel.dispose();
  }
}
