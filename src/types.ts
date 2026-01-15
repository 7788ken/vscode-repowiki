import * as vscode from 'vscode';

/** TreeView 节点类型 */
export type TreeItemType = 'group' | 'file';

/** 分组类型 */
export type GroupType = 'physical' | 'virtual';

/** 虚拟分组配置：分组名 -> 文件相对路径数组 */
export type GroupConfig = Record<string, string[]>;

/** 目录别名配置：目录路径 -> 显示别名 */
export type DirectoryAliasConfig = Record<string, string>;

/** TreeView 节点数据 */
export interface TreeNodeData {
  type: TreeItemType;
  label: string;
  /** 文件节点的绝对路径 */
  filePath?: string;
  /** 文件节点的相对路径（用于配置存储） */
  relativePath?: string;
  /** 分组节点名称 */
  groupName?: string;
  /** 是否为物理分组（基于目录） */
  isPhysical?: boolean;
  /** 物理分组的原始目录路径 */
  directoryPath?: string;
}

/** Markdown 文件信息 */
export interface MarkdownFileInfo {
  /** 文件名（不含路径） */
  name: string;
  /** 绝对路径 */
  absolutePath: string;
  /** 相对于工作区的路径 */
  relativePath: string;
  /** 所属分组名 */
  groupName: string;
  /** 所在目录（相对路径） */
  directory: string;
  /** 是否属于物理分组 */
  isPhysical: boolean;
}
