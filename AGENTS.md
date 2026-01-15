# RepoWiki - VSCode 插件

## 项目概述
VSCode 资源管理器侧边栏插件，用于管理和浏览工作区的 Markdown 文档。

## 技术栈
- TypeScript
- VSCode Extension API
- esbuild 打包

## 常用命令
```bash
npm run watch      # 开发模式
npm run build      # 生产构建
npm run typecheck  # 类型检查
npm run lint       # 代码检查
```

## 项目结构
```
src/
├── extension.ts           # 插件入口
├── markdownTreeProvider.ts # TreeView 数据提供者
├── groupManager.ts        # 分组管理
├── fileWatcher.ts         # 文件监听
└── types.ts               # 类型定义
```

## 调试方式
按 F5 启动调试（需要 VSCode 打开项目）
