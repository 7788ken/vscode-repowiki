import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DocStatus, DocMetadata, CodeDocMapping } from './docTypes';

export class DocStatusChecker {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /** 获取文件修改时间 */
  private async getFileMtime(filePath: string): Promise<Date | undefined> {
    try {
      const stat = await fs.stat(filePath);
      return stat.mtime;
    } catch {
      return undefined;
    }
  }

  /** 检查单个文档状态 */
  async checkDocStatus(mapping: CodeDocMapping): Promise<DocMetadata> {
    const docAbsPath = path.join(this.workspaceRoot, 'repowiki', mapping.docPath);
    const sourceAbsPath = path.join(this.workspaceRoot, mapping.sourcePath);

    const docMtime = await this.getFileMtime(docAbsPath);
    const sourceMtime = await this.getFileMtime(sourceAbsPath);

    let status: DocStatus;

    if (!docMtime) {
      // 文档不存在
      status = DocStatus.MISSING;
    } else if (!sourceMtime) {
      // 源码文件不存在（可能被删除）
      status = DocStatus.UP_TO_DATE;
    } else if (sourceMtime > docMtime) {
      // 源码比文档新
      status = DocStatus.OUTDATED;
    } else {
      // 文档最新
      status = DocStatus.UP_TO_DATE;
    }

    return {
      docPath: mapping.docPath,
      sourceFiles: [mapping.sourcePath],
      docMtime,
      sourceMtime,
      status,
      title: mapping.title,
    };
  }

  /** 批量检查所有文档状态 */
  async checkAllDocs(mappings: CodeDocMapping[]): Promise<DocMetadata[]> {
    const results = await Promise.all(
      mappings.map((mapping) => this.checkDocStatus(mapping))
    );
    return results;
  }

  /** 统计文档状态 */
  summarizeStatus(metadataList: DocMetadata[]): {
    missing: number;
    outdated: number;
    upToDate: number;
  } {
    return {
      missing: metadataList.filter((m) => m.status === DocStatus.MISSING).length,
      outdated: metadataList.filter((m) => m.status === DocStatus.OUTDATED).length,
      upToDate: metadataList.filter((m) => m.status === DocStatus.UP_TO_DATE).length,
    };
  }
}
