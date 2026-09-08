# Project Map

## 根目录

- `index.html`：Vite 入口。
- `package.json`：脚本、依赖和项目检查命令。
- `vite.config.js`：Vue 插件和 GitHub Pages base。
- `.github/workflows/deploy-pages.yml`：GitHub Pages 部署。
- `AGENTS.md`：AI 入口地图。
- `PROJECT_STATUS.md`：当前项目状态、近期完成事项、恢复顺序。

## `src/`

- `src/main.js`：挂载 Vue 应用和引入 CSS。
- `src/App.vue`：应用壳层和当前主要编排中心，管理 hash 路由、真实/演示身份、账号与资料状态、课程详情以及三门题库流程。文件已经较大；新增复杂功能时优先拆到页面组件、data 或 service。

## `src/data/`

- `config/`：导航、主题、测试用户、信箱模拟消息。
- `courses/`：课程 CSV 解析、资源分组、课程详情模型、hash 路由、资源路径与培养方案（`programCatalog.js`）。
- `legacy/`：早期账号展示数据，保留兼容测试。

## `src/components/`

展示组件层。组件尽量只做 UI 和事件转发，不直接决定权限和业务规则。

重点组件：

- `ResourcePage.vue`：资源中心课程分组和卡片。
- `HomePage.vue`：首页聚焦搜索、近期活动和热门资料。
- `ActivityPage.vue` / `ActivityDetailPage.vue`：活动目录与详情。
- `CourseDetailPage.vue`：通用课程详情框架。
- `ContributionBox.vue`：投稿按钮和居中弹窗。
- `components/account/`：账号面板、认证状态、信箱与通知。
- `components/admin/`：`#admin` 管理员平台。
- `components/profile/`：个人主页与内容管理。

## `src/services/`

共享逻辑层。新增权限、收藏、消息、课程字段生成等规则优先放这里。

- `authService.js`：账号状态、认证状态、投稿/评论/收藏权限、消息生成。
- `courseOverviewService.js`：课程总览字段。
- `favoriteService.js`：收藏 key 和切换。
- `avatarService.js`：头像颜色。
- `apiClient.js`：多数前端 API 客户端共享的请求、JSON 和错误处理。
- `*ApiClient.js`：认证、账号、资料、评论、投稿、管理、活动、资料和题库接口边界。
- `searchApiClient.js`：跨课程、内容、活动和学生主页的搜索接口客户端；当前未挂载到页面。

## `public/`

面向用户的静态内容和可迁移资源。课程资料、Markdown、PDF、活动图片等应优先放这里。

- `public/resource/summary/introduction.csv`：课程目录核心数据源。
- `public/resource/courses/`：课程资料目录。
- `public/resource/quiz/`：三门已迁移题库的静态源数据与二进制资源。
- `public/content/activities/catalog.json`：活动后端的初始种子和静态回退。
- `public/lab/`：实验室开放日预留。
- `public/navigator/`：学业领航预留。
- `public/peer/`：朋辈辅学预留。
- `public/showcase/`：最美笔记、课表、书桌预留。

## `tests/`

使用 Node.js 内置测试。测试覆盖前端数据/服务/UI 契约、后端 SQLite 与 HTTP 流程、路由、主题、题库、搜索、学生主页、投稿审核和部署配置。

## `server/`

- `server/server.js`：Node HTTP 入口和各领域 handler 编排。
- `server/authStore.js`、`authService.js`、`emailAuthService.js`、`loginGuard.js`：账号、身份、会话、邮箱验证码和登录限流。
- `server/account/`：课程清单、XLSX 解析、收藏和通知。
- `server/profile/`：公开/本人资料、头像、帖子与投稿管理。
- `server/content/`：课程内容、评论、投稿审核、点赞、活动和操作日志。
- `server/activity/`：活动读写与发布流程。
- `server/quiz/`：题库导入、安全答题、评分、进度、错题和词汇同步。
- `server/search/`：课程、公开内容、活动和学生主页的跨源搜索。
- `server/studentHomepage/`：学生主页目录、申请和管理员审核；当前尚无对应 Vue 页面。

## 项目检查体系

项目级标准检查体系不替代业务测试，而是把 AI 协作、架构规则、自动检查和报告组织起来。

- `project-checks/scripts/`：`run-checks.mjs`（总入口）、`check-architecture.mjs`、`check-routes.mjs`、`check-content-location.mjs`、`check-themes.mjs`、`collect-report.mjs`、`run-browser-checks.mjs`。
- `project-checks/policies/`：架构、路由、内容位置、主题、权限规则。
- `project-checks/evaluators/`：deterministic / browser / visual / llm 评测。
- `project-checks/agents/`：explorer、planner、implementer、reviewer、ui-qa、data-auditor 角色协议。
- `project-checks/reports/`：项目检查报告（被忽略，不提交）。
