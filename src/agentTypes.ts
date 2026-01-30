/** AI Agent 提供者类型 */
export enum AgentProviderType {
  /** Qoder CLI */
  QODER = 'qoder',
  /** Claude CLI */
  CLAUDE = 'claude',
  /** Codex CLI */
  CODEX = 'codex',
  /** Cursor CLI */
  CURSOR = 'cursor',
  /** Aider CLI */
  AIDER = 'aider',
  /** 自定义命令 */
  CUSTOM = 'custom',
}

/** Agent 提供者配置 */
export interface AgentProviderConfig {
  /** 提供者类型 */
  type: AgentProviderType;
  /** 命令路径（如果不在 PATH 中） */
  commandPath?: string;
  /** 是否可用 */
  available: boolean;
  /** 优先级（数字越小优先级越高） */
  priority: number;
  /** 额外配置 */
  extraConfig?: Record<string, any>;
}

/** Agent 调用参数 */
export interface AgentCallParams {
  /** 文档路径 */
  docPath: string;
  /** 文档标题 */
  title: string;
  /** 源代码文件路径 */
  sourceFiles: string[];
  /** 工作区根目录 */
  workspaceRoot: string;
  /** 是否为更新操作（而非新建） */
  isUpdate: boolean;
  /** 日志输出（用于输出到面板） */
  log?: (message: string, force?: boolean) => void;
}

/** Agent 调用结果 */
export interface AgentCallResult {
  /** 是否成功 */
  success: boolean;
  /** 标准输出 */
  stdout?: string;
  /** 标准错误 */
  stderr?: string;
  /** 错误信息 */
  error?: string;
  /** 耗时（毫秒） */
  duration: number;
  /** 是否应该重试（内部使用） */
  shouldRetry?: boolean;
}
