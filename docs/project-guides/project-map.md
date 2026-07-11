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
- `src/App.vue`：应用壳层，管理 hash 路由、主题、测试用户、账号弹层、信箱、课程详情状态。新增复杂功能时优先拆到组件、data 或 service。

## `src/data/`

- `config/`：导航、主题、测试用户、信箱模拟消息。
- `courses/`：课程 CSV 解析、资源分组、课程详情模型、hash 路由与资源路径。
- `legacy/`：早期账号展示数据，保留兼容测试。

## `src/components/`

展示组件层。组件尽量只做 UI 和事件转发，不直接决定权限和业务规则。

重点组件：

- `ResourcePage.vue`：资源中心课程分组和卡片。
- `CourseDetailPage.vue`：通用课程详情框架。
- `ContributionBox.vue`：投稿按钮和居中弹窗。
- `SettingsPanel.vue`：主题和测试用户切换。
- `components/account/`：账号面板、信箱和认证状态。

## `src/services/`

共享逻辑层。新增权限、收藏、消息、课程字段生成等规则优先放这里。

- `authService.js`：账号状态、认证状态、投稿/评论/收藏权限、消息生成。
- `courseOverviewService.js`：课程总览字段。
- `favoriteService.js`：收藏 key 和切换。
- `avatarService.js`：头像颜色。

## `public/`

面向用户的静态内容和可迁移资源。课程资料、Markdown、PDF、活动图片等应优先放这里。

- `public/resource/summary/introduction.csv`：课程目录核心数据源。
- `public/resource/courses/`：课程资料目录。
- `public/lab/`：实验室开放日预留。
- `public/navigator/`：学业领航预留。
- `public/peer/`：朋辈辅学预留。
- `public/showcase/`：最美笔记、课表、书桌预留。

## `tests/`

使用 Node.js 内置测试。测试关注数据契约、服务逻辑、路由、主题、投稿和部署配置。

## 项目检查体系

项目级标准检查体系不替代业务测试，而是把 AI 协作、架构规则、自动检查和报告组织起来。
