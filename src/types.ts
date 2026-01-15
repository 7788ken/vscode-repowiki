import * as vscode from 'vscode';

/** TreeView 节点类型 */
export type TreeItemType = 'group' | 'file';

/** 分组配置：分组名 -> 文件相对路径数组 */
export type GroupConfig = Record<string, string[]>;

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
}
