import * as vscode from 'vscode';
import * as path from 'path';
import { GroupConfig, DirectoryAliasConfig } from './types';

const CONFIG_SECTION = 'repowiki';
const GROUPS_KEY = 'groups';
const ALIASES_KEY = 'directoryAliases';
const INITIALIZED_KEY = 'initialized';
const DEFAULT_GROUP = '未分类';

export class GroupManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /** 获取所有虚拟分组配置 */
  getGroups(): GroupConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<GroupConfig>(GROUPS_KEY) || {};
  }

  /** 获取目录别名配置 */
  getDirectoryAliases(): DirectoryAliasConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<DirectoryAliasConfig>(ALIASES_KEY) || {};
  }

  /** 设置目录别名 */
  async setDirectoryAlias(directoryPath: string, alias: string): Promise<boolean> {
    const aliases = this.getDirectoryAliases();
    aliases[directoryPath] = alias;
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(ALIASES_KEY, aliases, vscode.ConfigurationTarget.Workspace);
    return true;
  }

  /** 获取目录的显示名称（别名或原始路径） */
  getDirectoryDisplayName(directoryPath: string): string {
    const aliases = this.getDirectoryAliases();
    return aliases[directoryPath] || directoryPath || '根目录';
  }

  /** 检查是否已初始化 */
  isInitialized(): boolean {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<boolean>(INITIALIZED_KEY) || false;
  }

  /** 标记为已初始化 */
  async markInitialized(): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(INITIALIZED_KEY, true, vscode.ConfigurationTarget.Workspace);
  }

  /** 获取文件所属分组（优先虚拟分组，再物理目录） */
  getFileGroup(relativePath: string): { groupName: string; isPhysical: boolean } {
    // 先查虚拟分组
    const groups = this.getGroups();
    for (const [groupName, files] of Object.entries(groups)) {
      if (files.includes(relativePath)) {
        return { groupName, isPhysical: false };
      }
    }

    // 返回物理分组（目录）
    const directory = path.dirname(relativePath);
    const displayName = this.getDirectoryDisplayName(directory);
    return { groupName: displayName, isPhysical: true };
  }

  /** 获取所有物理分组（从文件列表中提取目录） */
  async getPhysicalGroups(files: Array<{ relativePath: string }>): Promise<Map<string, string>> {
    const directories = new Map<string, string>(); // 目录路径 -> 显示名称

    for (const file of files) {
      const dir = path.dirname(file.relativePath);
      if (!directories.has(dir)) {
        const displayName = this.getDirectoryDisplayName(dir);
        directories.set(dir, displayName);
      }
    }

    return directories;
  }

  /** 创建新虚拟分组 */
  async createGroup(name: string): Promise<boolean> {
    if (!name || name === DEFAULT_GROUP) {
      vscode.window.showWarningMessage('分组名无效');
      return false;
    }

    const groups = this.getGroups();
    if (groups[name]) {
      vscode.window.showWarningMessage(`虚拟分组 "${name}" 已存在`);
      return false;
    }

    groups[name] = [];
    await this.saveGroups(groups);
    return true;
  }

  /** 删除虚拟分组（文件移至物理分组） */
  async deleteGroup(name: string): Promise<boolean> {
    if (name === DEFAULT_GROUP) {
      vscode.window.showWarningMessage('无法删除默认分组');
      return false;
    }

    const groups = this.getGroups();
    if (!groups[name]) {
      return false;
    }

    delete groups[name];
    await this.saveGroups(groups);
    return true;
  }

  /** 重命名虚拟分组 */
  async renameGroup(oldName: string, newName: string): Promise<boolean> {
    if (oldName === DEFAULT_GROUP || newName === DEFAULT_GROUP) {
      vscode.window.showWarningMessage('无法重命名默认分组');
      return false;
    }

    const groups = this.getGroups();
    if (!groups[oldName] || groups[newName]) {
      return false;
    }

    groups[newName] = groups[oldName];
    delete groups[oldName];
    await this.saveGroups(groups);
    return true;
  }

  /** 移动文件到虚拟分组 */
  async moveFileToGroup(relativePath: string, groupName: string): Promise<boolean> {
    const groups = this.getGroups();

    // 从所有虚拟分组中移除该文件
    for (const files of Object.values(groups)) {
      const idx = files.indexOf(relativePath);
      if (idx !== -1) {
        files.splice(idx, 1);
      }
    }

    // 添加到目标虚拟分组
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(relativePath);

    await this.saveGroups(groups);
    return true;
  }

  /** 获取所有虚拟分组名 */
  getAllVirtualGroupNames(): string[] {
    const groups = this.getGroups();
    return Object.keys(groups);
  }

  /** 保存虚拟分组配置到工作区设置 */
  private async saveGroups(groups: GroupConfig): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(GROUPS_KEY, groups, vscode.ConfigurationTarget.Workspace);
  }

  /** 默认分组名称 */
  static get DEFAULT_GROUP(): string {
    return DEFAULT_GROUP;
  }
}
