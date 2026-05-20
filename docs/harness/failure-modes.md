# Failure Modes

## PowerShell npm.ps1 被禁止

现象：PowerShell 输出 execution policy 错误。

处理：

```bash
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

## 端口访问失败

开发端口固定为：

```txt
http://127.0.0.1:5174/
```

预览端口固定为：

```txt
http://127.0.0.1:4174/
```

如果 5174 被占用，先停止旧 dev server。

## GitHub Pages 路径错误

现象：本地正常，部署后 public 资源 404。

处理：

- 检查 `vite.config.js` 的 GitHub Pages base。
- 检查资源引用是否经过 `src/utils/publicPath.js`。
- 运行：

```bash
$env:GITHUB_PAGES='true'; npm.cmd run build
```

## 课程路由异常

现象：课程卡片能显示但详情页进不去。

处理：

- 检查 `src/data/courses/resourcePaths.js`。
- 运行：

```bash
npm.cmd run harness:routes
```

## UI 变得像模板或 AI 生成页

处理：

- 阅读 `docs/design-system.md`。
- 阅读 `docs/harness/ui-rules.md`。
- 检查是否出现过度渐变、过大 hero、空泛文案、卡片套卡片。

## Harness 失败

处理顺序：

1. 看 `harness/reports/*.md` 的失败项。
2. 按失败项建议修复。
3. 单独运行失败命令，例如 `npm.cmd run harness:content`。
4. 修复后运行 `npm.cmd run harness`。
