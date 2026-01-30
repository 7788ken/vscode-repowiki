import { AgentProvider } from './agentProvider';
import { AgentCallParams, AgentCallResult } from './agentTypes';
import * as fs from 'fs/promises';
import * as path from 'path';

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

/** Claude CLI 提供者 - 扩展接口用于源代码内容 */
interface ClaudeCallParams extends AgentCallParams {
  _sourceContent?: string;
}

/** Claude CLI 提供者 */
export class ClaudeProvider extends AgentProvider {
  readonly name = 'Claude CLI';
  readonly commandName = 'claude';
  protected useStdin = true;

  buildCommandArgs(_params: AgentCallParams): string[] {
    // Claude CLI 使用 -p/--print 输出并退出，通过 stdin 接收提示词
    return ['-p'];
  }

  buildCommand(params: AgentCallParams): string {
    // 保留用于兼容性，实际使用 stdin 模式
    const prompt = this.formatPrompt(params);
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const fullDocPath = `repowiki/${params.docPath}`;
    return `claude -p '${escapedPrompt}' > "${fullDocPath}"`;
  }

  /** 重写 formatPrompt 以包含源代码内容 */
  protected formatPrompt(params: AgentCallParams): string {
    const claudeParams = params as ClaudeCallParams;
    const action = params.isUpdate ? '更新维护' : '创建';
    const sourceFilesSection = params.sourceFiles.length > 0
      ? `源代码文件：${params.sourceFiles.join(', ')}`
      : '源代码文件：请根据文档主题自行定位相关源文件';

    let prompt = `请${action}文档：${params.title}

文档路径：${params.docPath}
${sourceFilesSection}

请严格遵循 repowiki/skill.md 中的文档编写规范：
1. 文档开头使用 <cite> 标签声明引用的源代码文件
2. 每个章节末尾添加 **Section sources** 标注内容来源
3. 使用 Mermaid 图表可视化复杂流程（不使用样式定义）
4. 代码示例需要指定语言以启用语法高亮
5. 保持内容与代码同步，引用真实的代码路径

文档结构要求：
- 一级标题作为文档标题（仅一个）
- 二级标题作为主要章节
- 包含目录（TOC）便于导航
- 使用相对当前文档的相对路径链接（不使用 file:// 协议），行号使用 #Lx 或 #Lx-Ly

${params.isUpdate ? '注意：这是更新操作，请保留现有文档结构，只更新变更的部分。\n' : ''}`;

    // 如果有预读取的源代码内容，附加到提示词中
    if (claudeParams._sourceContent) {
      prompt += `\n以下是源代码文件的内容供参考：\n${claudeParams._sourceContent}\n`;
    }

    prompt += '\n请直接输出 Markdown 格式的文档内容，不要包含任何解释或前言。';

    return prompt;
  }

  /** 重写调用方法以预读取源代码 */
  async call(params: AgentCallParams): Promise<AgentCallResult> {
    // 尝试读取源代码文件内容
    let sourceContent = '';
    for (const sourceFile of params.sourceFiles) {
      const fullPath = path.join(params.workspaceRoot, sourceFile);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        // 限制单个文件最大字符数，避免提示词过长
        const maxChars = 10000;
        const truncated = content.length > maxChars 
          ? content.substring(0, maxChars) + '\n... (内容已截断)'
          : content;
        sourceContent += `\n\n--- ${sourceFile} ---\n\`\`\`\n${truncated}\n\`\`\``;
      } catch {
        // 文件不存在或无法读取，跳过
      }
    }

    // 创建包含源代码内容的增强参数
    const enhancedParams: ClaudeCallParams = {
      ...params,
      _sourceContent: sourceContent || undefined,
    };

    return super.call(enhancedParams);
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
