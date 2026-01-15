import { exec } from 'child_process';
import { promisify } from 'util';
import { AgentCallParams, AgentCallResult } from './agentTypes';

const execAsync = promisify(exec);

/** AI Agent 提供者抽象基类 */
export abstract class AgentProvider {
  /** 提供者名称 */
  abstract readonly name: string;

  /** 命令名称 */
  abstract readonly commandName: string;

  /** 检测命令是否可用 */
  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`which ${this.commandName}`, {
        timeout: 5000,
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /** 获取版本信息 */
  async getVersion(): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync(`${this.commandName} --version`, {
        timeout: 5000,
      });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  /** 构建命令字符串（子类实现） */
  abstract buildCommand(params: AgentCallParams): string;

  /** 调用 Agent 生成文档 */
  async call(params: AgentCallParams): Promise<AgentCallResult> {
    const startTime = Date.now();

    try {
      const command = this.buildCommand(params);
      const { stdout, stderr } = await execAsync(command, {
        cwd: params.workspaceRoot,
        timeout: 120000, // 2 分钟超时
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        success: true,
        stdout,
        stderr,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stderr: error.stderr,
        duration: Date.now() - startTime,
      };
    }
  }

  /** 格式化提示词（通用逻辑） */
  protected formatPrompt(params: AgentCallParams): string {
    const action = params.isUpdate ? '更新维护' : '创建';
    return `请${action}文档：${params.title}

文档路径：${params.docPath}
源代码文件：${params.sourceFiles.join(', ')}

请严格遵循 REPO_WIKI/skill-repowiki生成规则.md 中的文档编写规范：
1. 使用 <cite> 标签声明引用文件
2. 每个章节末尾添加 Section sources
3. 使用 Mermaid 图表可视化流程
4. 代码示例需要语法高亮
5. 保持内容与代码同步

${params.isUpdate ? '注意：这是更新操作，请保留现有文档结构，只更新变更的部分。' : ''}`;
  }
}
