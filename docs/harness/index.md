# Harness Index

本目录是项目的 harness 文档层。它给人类和 AI 共同阅读，解释项目规则、数据契约、UI 约束和后续协作流程。

## 先读什么

1. 先读仓库根目录的 `AGENTS.md`。
2. 再读本文件，判断当前任务属于哪一类。
3. 按任务读取专项文档：
   - 项目结构：`project-map.md`
   - 架构边界：`architecture.md`
   - 课程和资源数据：`data-contracts.md`
   - UI 和主题：`ui-rules.md`
   - 登录、账号、权限：`security-and-auth.md`
   - 失败排查：`failure-modes.md`
   - 用户如何使用 harness：`harness-usage-guide.md`

## Harness 分层

- `AGENTS.md`：AI 入口地图。
- `docs/harness/`：可读规则和工程背景。
- `harness/agents/`：多 agent 角色协议。
- `harness/policies/`：可执行策略的数据源。
- `harness/scripts/`：确定性检查和报告生成。
- `harness/evaluators/`：deterministic、browser、visual、llm 四层评测。
- `harness/reports/`：每次运行的报告输出。

## 设计依据

本项目优先采用 OpenAI Harness Engineering 的取向：把项目知识、工具、检查和反馈闭环放进仓库，让 AI 助手不依赖聊天历史也能稳定工作。Anthropic 的 hooks/subagents 和 LangChain/LangSmith 的 traces/evals 作为后续扩展参考。
