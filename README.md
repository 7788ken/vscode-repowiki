# RepoWiki

一个 VSCode 插件，用于在资源管理器侧边栏中管理和浏览工作区的 Markdown 文档。

## 功能特性

- 自动扫描工作区中的所有 `.md` 文档
- 支持自定义分组管理文档
- 实时监听文件变化，自动更新列表
- 点击文件名直接在编辑器中打开
- 分组配置自动保存到工作区设置

## 安装

### 方式一：从 VSIX 安装

1. 构建 VSIX 包：
   ```bash
   npm install
   npm run build
   npx vsce package
   ```

2. 在 VSCode 中安装：
   - 打开 VSCode
   - 按 `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`)
   - 输入 `Extensions: Install from VSIX...`
   - 选择生成的 `.vsix` 文件

### 方式二：开发模式调试

1. 克隆项目并安装依赖：
   ```bash
   git clone <repository-url>
   cd vscode-repowiki
   npm install
   ```

2. 在 VSCode 中打开项目，按 `F5` 启动调试

## 使用说明

### 基本操作

1. **查看文档列表**：安装后，侧边栏会出现「RepoWiki」图标，点击即可查看工作区所有 Markdown 文档

2. **打开文档**：点击列表中的文件名，文档会在主编辑器区域打开

3. **刷新列表**：点击视图标题栏的刷新按钮

### 分组管理

1. **创建分组**：
   - 点击视图标题栏的「新建文件夹」图标
   - 输入分组名称

2. **移动文件到分组**：
   - 右键点击文件
   - 选择「移动到分组」
   - 选择目标分组

3. **重命名分组**：
   - 右键点击分组名称
   - 选择「重命名分组」

4. **删除分组**：
   - 点击分组名称右侧的删除图标
   - 确认删除（文件会移至「未分类」）

### 配置项

在 VSCode 设置中可配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `repowiki.groups` | 分组配置 | `{}` |
| `repowiki.excludePatterns` | 排除的文件匹配模式 | `["**/node_modules/**", "**/.git/**"]` |

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run watch

# 类型检查
npm run typecheck

# 生产构建
npm run build

# 代码检查
npm run lint
```

## 项目结构

```
src/
├── extension.ts           # 插件入口
├── markdownTreeProvider.ts # TreeView 数据提供者
├── groupManager.ts        # 分组管理器
├── fileWatcher.ts         # 文件监听器
└── types.ts               # 类型定义
```

## 许可证

MIT
