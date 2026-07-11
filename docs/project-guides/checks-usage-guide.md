# Project Checks Usage Guide

这份文档写给项目维护者。它说明新开 AI 对话时如何使用本项目检查体系。

## 新开对话推荐流程

1. 让 AI 先读：

```txt
AGENTS.md
PROJECT_STATUS.md
docs/project-guides/index.md
docs/project-guides/decisions.md
```

2. 说明任务类型：

- UI 改动：同时读 `docs/project-guides/ui-rules.md`
- 课程或资源改动：同时读 `docs/project-guides/data-contracts.md`
- 登录、投稿、评论、收藏：同时读 `docs/project-guides/security-and-auth.md`
- 架构重构：同时读 `docs/project-guides/architecture.md`

3. 明确权限：

```txt
可以改文件 / 只讨论计划 / 只做代码审查 / 需要跑测试
```

4. 完成后要求：

```bash
npm.cmd test
npm.cmd run build
npm.cmd run check
```

## 推荐任务写法

好任务：

```txt
请先读取 AGENTS.md 和 docs/project-guides/data-contracts.md。
我要新增一个课程资料入口，不能把正文写入 Vue 组件。
完成后运行 npm.cmd run check:routes 和 npm.cmd test。
```

不推荐：

```txt
帮我改一下页面。
```

## 多 Agent 使用技巧

项目已经提供角色协议：

```txt
explorer
planner
implementer
reviewer
ui-qa
data-auditor
```

复杂任务可以要求：

```txt
先用 explorer 读现状，再用 planner 出计划，implementer 执行，reviewer 审查。
```

如果平台支持并行 agent，可以让：

- `ui-qa` 专看视觉和响应式。
- `data-auditor` 专查 CSV、public 内容和路由。
- `reviewer` 专查测试缺口和架构违规。

## 什么时候跑哪些项目检查

- 改课程、路由：`npm.cmd run check:routes`
- 改内容位置：`npm.cmd run check:content`
- 改主题：`npm.cmd run check:themes`
- 改权限、组件边界：`npm.cmd run check:architecture`
- 改完一轮：`npm.cmd run check`
- 检查真实页面交互：`npm.cmd run check:browser`

## 读报告

`npm.cmd run check` 会生成 JSON 和 Markdown 两份报告。

重点看：

- 哪个检查失败
- 失败文件
- 失败原因
- 建议下一步

生成的报告默认被 `.gitignore` 忽略，避免污染提交。

## 交接文档更新

完成会改变项目状态或长期取舍的任务后，优先更新：

- `PROJECT_STATUS.md`
- `docs/project-guides/decisions.md`
- 被修改目录下最接近的 README
