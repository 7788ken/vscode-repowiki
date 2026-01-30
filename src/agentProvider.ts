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

  /** 统一日志输出 */
  protected log(params: AgentCallParams, message: string, forceOutput: boolean = false): void {
    if (params.log) {
      params.log(`[Agent:${this.name}] ${message}`, forceOutput);
    }
  }

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
    this.log(
      params,
      `开始调用 (doc: ${params.docPath}, title: ${params.title}, mode: ${this.useStdin ? 'stdin' : 'exec'})`
    );

    // 确保输出目录存在
    const fullDocPath = path.join(params.workspaceRoot, 'repowiki', params.docPath);
    await fs.mkdir(path.dirname(fullDocPath), { recursive: true });

    if (this.useStdin) {
      // 首次尝试
      let result = await this.callWithStdin(params, startTime, false);

      // 如果失败且标记为应该重试，使用简化提示词重试一次
      if (!result.success && result.shouldRetry) {
        this.log(params, '\n🔄 使用简化提示词进行兜底重试...', true);
        result = await this.callWithStdin(params, startTime, true);

        if (result.success) {
          this.log(params, '✅ 兜底重试成功！', true);
        } else {
          this.log(params, '❌ 兜底重试仍然失败', true);
        }
      }

      return result;
    }

    try {
      const command = this.buildCommand(params);
      this.log(params, `执行命令: ${command}`);
      this.log(params, `工作目录: ${params.workspaceRoot}`);
      const { stdout, stderr } = await execAsync(command, {
        cwd: params.workspaceRoot,
        timeout: 300000, // 5 分钟超时
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      this.log(
        params,
        `命令完成 (stdout: ${stdout.length} 字符, stderr: ${stderr.length} 字符, 耗时: ${Date.now() - startTime}ms)`
      );

      return {
        success: true,
        stdout,
        stderr,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      this.log(params, `命令失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        stderr: error.stderr,
        duration: Date.now() - startTime,
      };
    }
  }

  /** 验证并写入文档内容 */
  private async validateAndWriteDoc(
    params: AgentCallParams,
    fullDocPath: string,
    content: string,
    stderr: string,
    startTime: number
  ): Promise<AgentCallResult> {
    const trimmedContent = content.trim();

    // 检查是否为有效的 Markdown 内容
    if (trimmedContent.length < 50 || !trimmedContent.includes('#')) {
      this.log(
        params,
        `⚠️ 输出校验失败 (length: ${trimmedContent.length}, hasTitle: ${trimmedContent.includes('#')})`,
        true
      );
      this.log(params, `📋 完整输出内容:\n${trimmedContent}`, true);
      if (stderr) {
        this.log(params, `📋 Stderr 内容:\n${stderr}`, true);
      }

      // 提供诊断建议
      const suggestions = [
        '可能的原因:',
        `  1. 输出内容过短 (${trimmedContent.length} 字符 < 50 字符)`,
        `  2. 缺少 Markdown 标题 (未找到 "#" 符号)`,
        '  3. Agent 可能返回了错误信息而非文档内容',
        '  4. 提示词可能未被正确理解',
        '',
        '建议的解决方式:',
        '  1. 检查 Agent 是否正常工作（手动测试命令）',
        '  2. 查看上面的完整输出内容，确认 Agent 实际返回了什么',
        '  3. 如果是网络问题，请重试',
        '  4. 如果是 Agent 限流，请稍后重试',
        `  5. 完整提示词已在日志中输出，可手动测试`,
        '',
        '🔄 正在尝试使用简化提示词重试...'
      ];
      this.log(params, suggestions.join('\n'), true);

      return {
        success: false,
        error: `输出内容无效或过短 (${trimmedContent.length} 字符，缺少有效标题)\n\n诊断信息:\n${trimmedContent.slice(0, 500)}${trimmedContent.length > 500 ? '...' : ''}\n\nStderr:\n${stderr || '(无)'}`,
        stderr,
        duration: Date.now() - startTime,
        shouldRetry: true, // 标记需要重试
      };
    }

    try {
      this.log(params, `写入文档: ${fullDocPath} (${trimmedContent.length} 字符)`);
      await fs.writeFile(fullDocPath, trimmedContent, 'utf-8');
      return {
        success: true,
        stdout: `文档已生成: ${params.docPath} (${trimmedContent.length} 字符)`,
        stderr,
        duration: Date.now() - startTime,
      };
    } catch (writeError: any) {
      this.log(params, `写入文件失败: ${writeError.message}`, true);
      return {
        success: false,
        error: `写入文件失败: ${writeError.message}`,
        stderr,
        duration: Date.now() - startTime,
      };
    }
  }

  /** 使用 stdin 传递提示词的调用方式 */
  protected async callWithStdin(params: AgentCallParams, startTime: number, useFallbackPrompt: boolean = false): Promise<AgentCallResult> {
    const args = this.buildCommandArgs(params);
    const prompt = useFallbackPrompt ? this.formatFallbackPrompt(params) : this.formatPrompt(params);
    const fullDocPath = path.join(params.workspaceRoot, 'repowiki', params.docPath);

    this.log(params, `执行命令: ${this.commandName} ${args.join(' ')}`.trim());
    this.log(params, `工作目录: ${params.workspaceRoot}`);
    this.log(params, `提示词模式: ${useFallbackPrompt ? '简化（兜底）' : '标准'}`);
    this.log(params, `提示词(${prompt.length} 字符):\n${prompt}`);

    return new Promise((resolve) => {
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
        this.log(params, '命令执行超时 (5分钟)，已发送 SIGTERM');
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
          this.log(params, `进程启动失败: ${error.message}`);
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

        const content = stdout.trim();
        this.log(
          params,
          `进程结束 (code: ${code}, stdout: ${stdout.length} 字符, stderr: ${stderr.length} 字符)`
        );

        if (code === 0 && content) {
          // 使用统一的验证和写入逻辑
          const result = await this.validateAndWriteDoc(params, fullDocPath, content, stderr, startTime);
          resolve(result);
        } else {
          const errorMsg = stderr || `进程退出码: ${code}`;
          if (!content) {
            this.log(params, `无输出内容。${errorMsg}`);
          }
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

  /** 格式化简化提示词（兜底方案） */
  protected formatFallbackPrompt(params: AgentCallParams): string {
    const sourceFilesSection = params.sourceFiles.length > 0
      ? `源文件: ${params.sourceFiles.join(', ')}`
      : '';

    return `创建文档: ${params.title}

路径: ${params.docPath}
${sourceFilesSection}

请生成 Markdown 格式的技术文档，要求:
1. 包含清晰的章节结构（使用 ## 标记）
2. 说明代码功能和用法
3. 包含代码示例
4. 直接输出文档内容，不要其他解释`;
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
- 使用相对当前文档的相对路径链接（不使用 file:// 协议），行号使用 #Lx 或 #Lx-Ly

${params.isUpdate ? '注意：这是更新操作，请保留现有文档结构，只更新变更的部分。' : ''}

请直接输出 Markdown 格式的文档内容，不要包含任何解释或前言。`;
  }
}
