import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { AgentCallParams, AgentCallResult } from './agentTypes';

const execAsync = promisify(exec);

/** AI Agent 提供者抽象基类 */
export abstract class AgentProvider {
  /** 提供者名称 */
  abstract readonly name: string;

  /** 命令名称 */
  abstract readonly commandName: string;

  /** 是否使用 stdin 传递提示词（子类可覆盖） */
  protected useStdin: boolean = false;

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

  /** 构建命令参数数组（子类可覆盖以支持 stdin 模式） */
  buildCommandArgs(_params: AgentCallParams): string[] {
    return [];
  }

  /** 构建命令字符串（子类实现） */
  abstract buildCommand(params: AgentCallParams): string;

  /** 调用 Agent 生成文档 */
  async call(params: AgentCallParams): Promise<AgentCallResult> {
    const startTime = Date.now();

    // 确保输出目录存在
    const fullDocPath = path.join(params.workspaceRoot, 'repowiki', params.docPath);
    await fs.mkdir(path.dirname(fullDocPath), { recursive: true });

    if (this.useStdin) {
      return this.callWithStdin(params, startTime);
    }

    try {
      const command = this.buildCommand(params);
      const { stdout, stderr } = await execAsync(command, {
        cwd: params.workspaceRoot,
        timeout: 300000, // 5 分钟超时
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

  /** 使用 stdin 传递提示词的调用方式 */
  protected async callWithStdin(params: AgentCallParams, startTime: number): Promise<AgentCallResult> {
    return new Promise((resolve) => {
      const args = this.buildCommandArgs(params);
      const prompt = this.formatPrompt(params);
      const fullDocPath = path.join(params.workspaceRoot, 'repowiki', params.docPath);

      const child = spawn(this.commandName, args, {
        cwd: params.workspaceRoot,
        env: { ...process.env, LANG: 'en_US.UTF-8' }, // 确保 UTF-8 编码
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      // 设置超时
      const timeout = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        resolve({
          success: false,
          error: '命令执行超时 (5分钟)',
          stderr,
          duration: Date.now() - startTime,
        });
      }, 300000);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        if (!killed) {
          resolve({
            success: false,
            error: `进程启动失败: ${error.message}`,
            stderr,
            duration: Date.now() - startTime,
          });
        }
      });

      child.on('close', async (code) => {
        clearTimeout(timeout);
        if (killed) return;

        // 验证输出内容
        const content = stdout.trim();
        if (code === 0 && content) {
          // 检查是否为有效的 Markdown 内容
          if (content.length < 50 || !content.includes('#')) {
            resolve({
              success: false,
              error: `输出内容无效或过短 (${content.length} 字符)`,
              stderr,
              duration: Date.now() - startTime,
            });
            return;
          }

          try {
            await fs.writeFile(fullDocPath, content, 'utf-8');
            resolve({
              success: true,
              stdout: `文档已生成: ${params.docPath} (${content.length} 字符)`,
              stderr,
              duration: Date.now() - startTime,
            });
          } catch (writeError: any) {
            resolve({
              success: false,
              error: `写入文件失败: ${writeError.message}`,
              stderr,
              duration: Date.now() - startTime,
            });
          }
        } else {
          const errorMsg = stderr || `进程退出码: ${code}`;
          resolve({
            success: false,
            error: content ? errorMsg : `无输出内容。${errorMsg}`,
            stderr,
            duration: Date.now() - startTime,
          });
        }
      });

      // 通过 stdin 传递提示词
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  /** 格式化提示词（通用逻辑） */
  protected formatPrompt(params: AgentCallParams): string {
    const action = params.isUpdate ? '更新维护' : '创建';
    const sourceFilesSection = params.sourceFiles.length > 0
      ? `源代码文件：${params.sourceFiles.join(', ')}`
      : '源代码文件：请根据文档主题自行定位相关源文件';

    return `请${action}文档：${params.title}

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
- 使用 file:// 协议引用文件路径

${params.isUpdate ? '注意：这是更新操作，请保留现有文档结构，只更新变更的部分。' : ''}

请直接输出 Markdown 格式的文档内容，不要包含任何解释或前言。`;
  }
}