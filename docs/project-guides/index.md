# Project Guides Index

本目录是项目指南层。它给人类和 AI 共同阅读，解释项目规则、数据契约、UI 约束和后续协作流程。

## 先读什么

1. 先读仓库根目录的 `AGENTS.md`。
2. 再读仓库根目录的 `PROJECT_STATUS.md`。
3. 再读 `decisions.md`，确认稳定决策和历史取舍。
4. 再读本文件，判断当前任务属于哪一类。
5. 按任务读取专项文档：
   - 项目结构：`project-map.md`
   - 决策记录：`decisions.md`
   - 架构边界：`architecture.md`
   - 课程和资源数据：`data-contracts.md`
   - UI 和主题：`ui-rules.md`
   - 登录、账号、权限：`security-and-auth.md`
   - 失败排查：`failure-modes.md`
   - 用户如何使用项目检查：`checks-usage-guide.md`

## 项目协作分层

- `AGENTS.md`：AI 入口地图。
- `PROJECT_STATUS.md`：当前状态、近期验证、恢复顺序。
- `docs/project-guides/decisions.md`：关键决策和长期取舍。
- `docs/project-guides/`：可读规则和工程背景。
- 角色协议：explorer、planner、implementer、reviewer、ui-qa、data-auditor。
- 策略数据：权限、路由、主题、内容位置和文件边界规则。
- 检查脚本：确定性检查和报告生成。
- 评测层：deterministic、browser、visual、llm 四层评测。
- 报告输出：每次运行的检查结果。

## 设计依据

本项目优先采用仓库内工程协作体系：把项目知识、工具、检查和反馈闭环放进仓库，让 AI 助手不依赖聊天历史也能稳定工作。其他工程化 agent、hooks、traces 和 evals 体系作为后续扩展参考。
