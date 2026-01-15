import * as vscode from 'vscode';
import * as path from 'path';
import { CodeDocMapping } from './docTypes';

/** 代码文件与文档的映射配置 */
export class DocMappingConfig {
  /** 获取默认的映射关系 */
  static getDefaultMappings(): CodeDocMapping[] {
    return [
      // 核心类型
      {
        sourcePath: 'src/types.ts',
        docPath: 'zh/content/核心功能模块/类型定义.md',
        title: '类型定义',
      },
      // 分组管理
      {
        sourcePath: 'src/groupManager.ts',
        docPath: 'zh/content/核心功能模块/分组管理.md',
        title: '分组管理',
      },
      // TreeView
      {
        sourcePath: 'src/markdownTreeProvider.ts',
        docPath: 'zh/content/核心功能模块/树视图与分组.md',
        title: '树视图与分组',
      },
      // 文件监听
      {
        sourcePath: 'src/fileWatcher.ts',
        docPath: 'zh/content/核心功能模块/文件监听.md',
        title: '文件监听',
      },
      // 插件入口
      {
        sourcePath: 'src/extension.ts',
        docPath: 'zh/content/核心功能模块/插件入口与命令.md',
        title: '插件入口与命令',
      },
      // 配置文件
      {
        sourcePath: 'package.json',
        docPath: 'zh/content/配置文件/package配置.md',
        title: 'Package.json 配置',
      },
      {
        sourcePath: 'tsconfig.json',
        docPath: 'zh/content/配置文件/TypeScript配置.md',
        title: 'TypeScript 配置',
      },
      // 概述文档
      {
        sourcePath: 'README.md',
        docPath: 'zh/content/系统概述.md',
        title: '系统概述',
      },
    ];
  }

  /** 从工作区配置中加载映射关系 */
  static loadFromWorkspace(): CodeDocMapping[] {
    const config = vscode.workspace.getConfiguration('repowiki');
    const customMappings = config.get<CodeDocMapping[]>('docMappings');
    
    if (customMappings && customMappings.length > 0) {
      return customMappings;
    }
    
    return this.getDefaultMappings();
  }

  /** 保存映射关系到工作区配置 */
  static async saveToWorkspace(mappings: CodeDocMapping[]): Promise<void> {
    const config = vscode.workspace.getConfiguration('repowiki');
    await config.update('docMappings', mappings, vscode.ConfigurationTarget.Workspace);
  }
}
