# 自动更新功能说明

## 功能概述

RepoWiki 现在支持**源代码保存时自动更新文档**的功能。当你修改并保存源代码文件时，插件会自动检测对应的文档是否需要更新，并提示你进行更新。

## 工作原理

### 1. 文件监听机制

- 监听工作区中所有文件的保存事件
- 根据文档映射配置（`docMappings`）判断保存的文件是否对应某个文档
- 如果是，则检查该文档的状态（是否过时或缺失）

### 2. 文档状态检测

文档状态通过比较源代码文件和文档文件的修改时间（mtime）来判断：

- **MISSING** - 文档不存在
- **OUTDATED** - 源代码文件比文档新
- **UP_TO_DATE** - 文档最新

### 3. 自动更新流程

```
保存源文件 → 检测映射关系 → 检查文档状态 → 延迟等待 → 显示通知 → 执行更新
```

## 配置项

在 VSCode 的 `settings.json` 中可以配置以下选项：

### `repowiki.autoUpdateOnSave`

- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 是否启用源文件保存时自动更新文档功能

```json
{
  "repowiki.autoUpdateOnSave": true
}
```

### `repowiki.autoUpdateDelay`

- **类型**: `number`
- **默认值**: `1000`（毫秒）
- **范围**: `0-10000`
- **说明**: 自动更新的延迟时间，避免频繁保存时触发多次更新

```json
{
  "repowiki.autoUpdateDelay": 2000
}
```

### `repowiki.autoUpdateShowNotification`

- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 是否在检测到文档需要更新时显示通知提示

```json
{
  "repowiki.autoUpdateShowNotification": false
}
```

## 使用示例

### 启用自动更新

1. 打开 VSCode 设置（`Cmd+,` 或 `Ctrl+,`）
2. 搜索 `repowiki.autoUpdateOnSave`
3. 勾选启用

或在 `settings.json` 中添加：

```json
{
  "repowiki.autoUpdateOnSave": true,
  "repowiki.autoUpdateDelay": 1500,
  "repowiki.autoUpdateShowNotification": true
}
```

### 工作流程

1. **修改源代码**: 编辑 `src/extension.ts` 文件
2. **保存文件**: 按 `Cmd+S` 或 `Ctrl+S`
3. **检测通知**: 插件显示通知"检测到源文件变更，将更新文档: 插件入口与命令"
4. **选择操作**:
   - 点击"立即更新" - 执行文档更新
   - 点击"取消" - 忽略此次更新
   - 如果关闭通知窗口，则不会更新

### 批量更新

如果在短时间内保存了多个源文件，插件会：

- 等待配置的延迟时间（默认 1 秒）
- 收集所有需要更新的文档
- 一次性显示包含所有文档名的通知
- 点击"立即更新"后批量更新所有文档

## 配置文档映射

文档映射关系在 `repowiki.docMappings` 配置中定义：

```json
{
  "repowiki.docMappings": [
    {
      "sourcePath": "src/extension.ts",
      "docPath": "zh/content/核心功能模块/插件入口与命令.md",
      "title": "插件入口与命令"
    },
    {
      "sourcePath": "src/groupManager.ts",
      "docPath": "zh/content/核心功能模块/分组管理.md",
      "title": "分组管理"
    }
  ]
}
```

## 技术实现

### 核心组件

1. **SourceFileWatcher** (`src/sourceFileWatcher.ts`)
   - 监听文件保存事件
   - 管理更新延迟和去重
   - 触发更新回调

2. **DocStatusChecker** (`src/docStatusChecker.ts`)
   - 检查文档状态
   - 比较文件修改时间

3. **DocGenerator** (`src/docGenerator.ts`)
   - 提供单个文档更新方法 `updateSingleDoc()`
   - 调用 AI Agent 生成文档

### 关键特性

- **延迟更新**: 避免频繁保存时触发多次更新
- **智能去重**: 同一个文档在短时间内多次变更只更新一次
- **状态检查**: 只有真正需要更新的文档才会触发更新
- **用户控制**: 通过通知让用户决定是否立即更新

## 注意事项

1. **性能考虑**: 自动更新会调用 AI Agent，可能需要几秒到几十秒
2. **网络要求**: 需要确保 AI Agent（如 Claude、Qoder 等）可用
3. **文档映射**: 只有在 `docMappings` 中配置的文件才会触发自动更新
4. **手动更新**: 你仍然可以使用"更新文档"按钮手动更新所有文档

## 故障排查

### 自动更新不工作？

1. 检查 `repowiki.autoUpdateOnSave` 是否启用
2. 确认源文件在 `docMappings` 配置中
3. 检查 AI Agent 是否可用（执行"检测 AI Agent"命令）
4. 查看 VSCode 输出面板的"RepoWiki 文档生成"频道

### 如何查看详细日志？

启用日志输出：

```json
{
  "repowiki.enableLogging": true
}
```

然后打开 VSCode 输出面板（`View > Output`），选择"RepoWiki 文档生成"频道。

## 未来改进

可能的增强功能：

- [ ] 支持通配符匹配（如 `src/**/*.ts`）
- [ ] 添加忽略文件列表配置
- [ ] 支持静默自动更新（无需用户确认）
- [ ] 更新历史记录和回滚功能
- [ ] 批量文件保存时的一次性确认

---

**版本**: 0.0.1+
**更新日期**: 2025-01-17
