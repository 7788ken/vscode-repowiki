import * as vscode from 'vscode';

export class FileWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined;
  private onChangeEmitter = new vscode.EventEmitter<void>();

  /** 文件变化事件 */
  readonly onDidChange = this.onChangeEmitter.event;

  constructor() {
    this.setupWatcher();
  }

  private setupWatcher(): void {
    // 监听所有 .md 文件的变化
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*.md');

    this.watcher.onDidCreate(() => this.onChangeEmitter.fire());
    this.watcher.onDidDelete(() => this.onChangeEmitter.fire());
    this.watcher.onDidChange(() => this.onChangeEmitter.fire());
  }

  dispose(): void {
    this.watcher?.dispose();
    this.onChangeEmitter.dispose();
  }
}
