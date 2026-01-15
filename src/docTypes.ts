import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** 文档状态 */
export enum DocStatus {
  /** 缺失（需要生成） */
  MISSING = 'missing',
  /** 最新（无需更新） */
  UP_TO_DATE = 'up_to_date',
  /** 过时（需要维护） */
  OUTDATED = 'outdated',
}

/** 文档元数据 */
export interface DocMetadata {
  /** 文档路径（相对于 repowiki） */
  docPath: string;
  /** 对应的源代码文件 */
  sourceFiles: string[];
  /** 文档修改时间 */
  docMtime?: Date;
  /** 最新的源码修改时间 */
  sourceMtime?: Date;
  /** 文档状态 */
  status: DocStatus;
  /** 文档标题 */
  title: string;
}

/** 代码文件与文档的映射关系 */
export interface CodeDocMapping {
  /** 源代码文件路径（相对路径） */
  sourcePath: string;
  /** 对应的文档路径（相对于 repowiki） */
  docPath: string;
  /** 文档标题 */
  title: string;
}

/** 文档生成配置 */
export interface DocGeneratorConfig {
  /** repowiki 目录路径 */
  repowikiRoot: string;
  /** 内容目录路径 */
  contentRoot: string;
  /** 元数据文件路径 */
  metadataPath: string;
  /** 是否强制重新生成 */
  forceRegenerate?: boolean;
}

/** 文档生成结果 */
export interface DocGenerationResult {
  /** 成功数量 */
  success: number;
  /** 失败数量 */
  failed: number;
  /** 跳过数量 */
  skipped: number;
  /** 总耗时（毫秒） */
  duration: number;
  /** 错误信息 */
  errors: string[];
}
