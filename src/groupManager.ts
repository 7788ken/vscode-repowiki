import * as vscode from 'vscode';
import { GroupConfig } from './types';

const CONFIG_SECTION = 'repowiki';
const GROUPS_KEY = 'groups';
const DEFAULT_GROUP = '未分类';

export class GroupManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /** 获取所有分组配置 */
  getGroups(): GroupConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<GroupConfig>(GROUPS_KEY) || {};
  }

  /** 获取文件所属分组 */
  getFileGroup(relativePath: string): string {
    const groups = this.getGroups();
    for (const [groupName, files] of Object.entries(groups)) {
      if (files.includes(relativePath)) {
        return groupName;
      }
    }
    return DEFAULT_GROUP;
  }

  /** 创建新分组 */
  async createGroup(name: string): Promise<boolean> {
    if (!name || name === DEFAULT_GROUP) {
      vscode.window.showWarningMessage('分组名无效');
      return false;
    }

    const groups = this.getGroups();
    if (groups[name]) {
      vscode.window.showWarningMessage(`分组 "${name}" 已存在`);
      return false;
    }

    groups[name] = [];
    await this.saveGroups(groups);
    return true;
  }

  /** 删除分组（文件移至未分类） */
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

  /** 重命名分组 */
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

  /** 移动文件到指定分组 */
  async moveFileToGroup(relativePath: string, groupName: string): Promise<boolean> {
    const groups = this.getGroups();

    // 从所有分组中移除该文件
    for (const files of Object.values(groups)) {
      const idx = files.indexOf(relativePath);
      if (idx !== -1) {
        files.splice(idx, 1);
      }
    }

    // 添加到目标分组（如果不是未分类）
    if (groupName !== DEFAULT_GROUP) {
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(relativePath);
    }

    await this.saveGroups(groups);
    return true;
  }

  /** 获取所有分组名（包括默认分组） */
  getAllGroupNames(): string[] {
    const groups = this.getGroups();
    const names = Object.keys(groups);
    if (!names.includes(DEFAULT_GROUP)) {
      names.unshift(DEFAULT_GROUP);
    }
    return names;
  }

  /** 保存分组配置到工作区设置 */
  private async saveGroups(groups: GroupConfig): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(GROUPS_KEY, groups, vscode.ConfigurationTarget.Workspace);
  }

  /** 默认分组名称 */
  static get DEFAULT_GROUP(): string {
    return DEFAULT_GROUP;
  }
}
