# AGENTS.md

本文件是 `E:\Study_Web` 的 AI 入口地图。Codex、DeepSeek TUI、Claude Code 或其他 AI 助手进入项目后，先读本文件，再按任务类型读取 `docs/harness/`。

## 项目速览

- 项目名：`life-science-study-platform`
- 品牌名：生科智学 / 生命科学学子学习平台
- 定位：面向生命科学学院学生的学习资源、课程资料、朋辈支持、实验室开放日和活动展示平台
- 阶段：Vue 3 + Vite 前端原型 / 静态数据阶段，真实后端登录、数据库、文件上传和验证码认证尚未接入
- 主要部署：GitHub Pages；Netlify 配置仍保留

## 技术栈

- Vue 3 + Vite
- JavaScript ESM
- 纯 CSS，无 UI 框架
- Node.js 内置测试：`node --test`
- 本地开发端口：`http://127.0.0.1:5174/`
- 本地预览端口：`http://127.0.0.1:4174/`

Windows PowerShell 可能禁用 `npm.ps1`，本地命令优先使用：

```bash
npm.cmd test
npm.cmd run build
npm.cmd run dev
npm.cmd run harness
```

## AI 阅读顺序

1. `AGENTS.md`
2. `docs/harness/index.md`
3. 按任务读取专项文档：
   - 架构或目录问题：`docs/harness/project-map.md`、`docs/harness/architecture.md`
   - 课程、资源、路由：`docs/harness/data-contracts.md`
   - UI、主题、文案：`docs/harness/ui-rules.md`、`docs/design-system.md`
   - 登录、权限、认证：`docs/harness/security-and-auth.md`
   - 排错：`docs/harness/failure-modes.md`
4. 如果要执行检查，读取 `harness/README.md` 和对应 `harness/scripts/`

## 关键目录

- `src/data/`：结构化静态数据，含导航、主题、测试用户、课程目录和资源路径
- `src/components/`：Vue 展示组件，尽量只接收 props 和发出事件
- `src/services/`：认证、收藏、课程总览等共享业务规则
- `src/styles/`：基础、布局、侧边栏、资源页、课程详情、设置和账号样式
- `public/`：面向用户的静态内容和可迁移资料
- `tests/`：Node 内置测试
- `docs/harness/`：人类和 AI 共读的 harness 文档层
- `harness/`：可执行的 harness 策略、脚本、评测、报告和角色协议

## 不要做

- 不要把课程正文、学习心得、复习资料、试卷正文写进 Vue 组件
- 不要把课程 URL 做成中文名或英文名；课程详情使用 `#resources/#课程代码`
- 不要在组件里复制认证、投稿、评论、收藏权限逻辑；走 `src/services/authService.js`
- 不要手工编辑 `dist/` 或 `node_modules/`
- 不要随意引入 UI 框架、路由库或状态管理库
- 不要把前端权限判断当成真实安全边界

## 常用命令

```bash
npm.cmd test
npm.cmd run build
npm.cmd run harness
npm.cmd run harness:routes
npm.cmd run harness:content
npm.cmd run harness:themes
npm.cmd run harness:architecture
```

浏览器冒烟测试：

```bash
npm.cmd run harness:browser
```

## Harness 使用原则

本项目按 OpenAI Harness Engineering 思路建设 repo-local harness：项目知识进入仓库，规则进入可执行检查，AI 改动后要能测试、报告和复盘。新开对话时，请让 AI 先读本文件和 `docs/harness/harness-usage-guide.md`。
