import { AgentProvider } from './agentProvider';
import { AgentCallParams } from './agentTypes';

/** Qoder CLI 提供者 */
export class QoderProvider extends AgentProvider {
  readonly name = 'Qoder CLI';
  readonly commandName = 'qoder';

  buildCommand(params: AgentCallParams): string {
    const prompt = this.formatPrompt(params);
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    
    return `qoder skill skill-repo-wiki --doc="${params.docPath}" --title="${params.title}" --prompt="${escapedPrompt}"`;
  }
}

/** Claude CLI 提供者 */
export class ClaudeProvider extends AgentProvider {
  readonly name = 'Claude CLI';
  readonly commandName = 'claude';

  buildCommand(params: AgentCallParams): string {
    const prompt = this.formatPrompt(params);
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    
    // Claude CLI 使用 -p/--print 输出并退出，需重定向到文件
    const fullDocPath = `repowiki/${params.docPath}`;
    return `claude -p '${escapedPrompt}' > "${fullDocPath}"`;
  }
}

/** Codex CLI 提供者 */
export class CodexProvider extends AgentProvider {
  readonly name = 'Codex CLI';
  readonly commandName = 'codex';

  buildCommand(params: AgentCallParams): string {
    const prompt = this.formatPrompt(params);
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    
    // Codex CLI 示例格式
    return `codex generate --prompt "${escapedPrompt}" --output "${params.docPath}" --model gpt-4`;
  }
}

/** Cursor CLI 提供者 */
export class CursorProvider extends AgentProvider {
  readonly name = 'Cursor CLI';
  readonly commandName = 'cursor';

  buildCommand(params: AgentCallParams): string {
    const prompt = this.formatPrompt(params);
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    
    // Cursor CLI 示例格式
    return `cursor --task "${escapedPrompt}" --file "${params.docPath}"`;
  }
}

/** Aider CLI 提供者 */
export class AiderProvider extends AgentProvider {
  readonly name = 'Aider CLI';
  readonly commandName = 'aider';

  buildCommand(params: AgentCallParams): string {
    const prompt = this.formatPrompt(params);
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    
    // Aider CLI 示例格式
    return `aider --message "${escapedPrompt}" --file "${params.docPath}" --yes`;
  }
}

/** 自定义命令提供者 */
export class CustomProvider extends AgentProvider {
  readonly name = 'Custom Command';
  commandName: string;
  private commandTemplate: string;

  constructor(commandName: string, commandTemplate: string) {
    super();
    this.commandName = commandName;
    this.commandTemplate = commandTemplate;
  }

  buildCommand(params: AgentCallParams): string {
    const prompt = this.formatPrompt(params);
    
    // 替换模板中的占位符
    return this.commandTemplate
      .replace('{{PROMPT}}', prompt)
      .replace('{{DOC_PATH}}', params.docPath)
      .replace('{{TITLE}}', params.title)
      .replace('{{SOURCE_FILES}}', params.sourceFiles.join(','));
  }
}
