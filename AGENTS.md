# AGENTS.md

本文件面向 DeepSeek TUI、Codex 或其他 AI 助手，是理解 `E:\Study_Web` 项目的首要上下文。进入项目后请先读本文件，再读具体代码。

## 项目概况

- 项目名称：`life-science-study-platform`，界面品牌名为“生科智学 / 生命科学学子学习平台”。
- 项目定位：面向生命科学学院学生的学习资源聚合与成长支持平台。当前重点是把课程资源、学业领航、朋辈辅学、实验室开放日和“最美活动”放到统一入口。
- 目标用户：生命科学学院本科生为主，尤其是需要查找培养方案课程资料、复习经验、历年试卷、朋辈支持和学院活动展示的学生。
- 设计方向来自 `docs/design-system.md`：简洁、学术、生命科学、可信、可持续扩展；参考 `https://bis.zju.edu.cn/` 的“左侧固定目录 + 右侧卡片内容”效率，但避免重型 Bootstrap、英文数据库气质和密集图标墙。
- 当前版本阶段：前端原型 / 静态数据阶段。已经有可运行的 Vue 单页应用、主题系统、课程资源页、通用课程详情页、前端账号状态骨架、投稿弹窗、收藏/评论/信箱的前端状态模拟。尚未接入真实后端、数据库、文件上传、学校邮箱验证码或 CC98 真实认证。

## 技术栈

- 前端：Vue 3 + Vite。
- 样式：纯 CSS，按文件分层管理，没有 Tailwind、Element Plus、Ant Design、Bootstrap 等 UI 框架。
- 语言：JavaScript ESM，Vue SFC。
- 测试：Node.js 内置测试框架 `node --test`，不依赖 Jest/Vitest。
- 静态资源：主要放在 `public/`，构建时由 Vite 原样拷贝。
- 部署：
  - GitHub Pages：`.github/workflows/deploy-pages.yml` 已配置。`vite.config.js` 在 `GITHUB_PAGES=true` 时使用 `/ZJU_CLS_Study_Web/` 作为 base。
  - Netlify：`netlify.toml` 仍保留，可构建 `dist` 并做 SPA rewrite，但当前优先方案是 GitHub Pages。
- 本地端口：
  - 开发：`npm run dev`，固定 `http://127.0.0.1:5174/`。
  - 预览：`npm run preview`，固定 `http://127.0.0.1:4174/`。
  - Windows PowerShell 可能禁止 `npm.ps1`，必要时使用 `npm.cmd run dev`、`npm.cmd test`、`npm.cmd run build`。

## 目录结构与职责

### 根目录

- `index.html`：Vite HTML 入口。
- `package.json`：项目脚本和依赖声明。
- `vite.config.js`：Vue 插件和 GitHub Pages base 配置。
- `netlify.toml`：Netlify 构建与 SPA fallback 配置。
- `.github/workflows/deploy-pages.yml`：GitHub Pages 自动部署流程。
- `AGENTS.md`：给 AI 助手看的项目说明，修改重要架构后应同步更新。

### `src/`

- `src/main.js`：Vue 应用入口，只负责挂载根组件和引入样式层。
- `src/App.vue`：应用壳层，管理 hash 路由、侧边栏状态、主题、测试用户、收藏、评论、信箱消息和课程详情状态。不要把新业务全部继续塞进这里；新增复杂功能时应先抽到 `data/`、`services/` 或独立组件。

### `src/data/`

按职责分三组。

#### `src/data/config/`

纯配置常量，不引用项目其他模块。

- `navigation.js`：侧边栏导航结构。当前栏目是资源中心、学业领航、朋辈辅学、实验室开放日、最美活动；最美活动下含最美笔记、最美日程表、最美书桌。
- `themes.js`：主题列表和默认主题。
- `testUsers.js`：前端测试用户：游客、CC98 认证、邮箱认证、双认证、开发者。
- `mockMessages.js`：信箱测试消息。

#### `src/data/courses/`

课程数据提供与模型，内部相互引用。

- `resourceCatalog.js`：解析 `public/resource/summary/introduction.csv`，按 2024 培养方案结构生成资源页分组。
- `resourceData.js`：加载课程 CSV，并缓存课程目录。
- `resourcePaths.js`：集中管理资源路由、课程详情 tab、旧版 BIO2110F 静态资料路径。路由格式形如 `#resources/#BIO2110F/#materials/#1`。
- `courseDetails.js`：把 CSV 中任意课程转成通用详情模型。目前所有课程都可点击进入详情页；学习心得、复习资料、历年试卷默认空集合。

#### `src/data/legacy/`

- `profile.js`：早期账号展示数据，部分测试仍引用；后续若废弃需同步改测试。

### `src/components/`

可复用组件。组件应尽量只接收 props、发出事件，不直接读写全局状态。

- `AppSidebar.vue`：左侧固定导航。
- `ResourcePage.vue`：资源中心页，负责展示课程分类、课程卡片、培养方案选择器。
- `CourseDetailPage.vue`：通用课程详情页。当前课程总览只展示顶部摘要行；其他三个 tab 暂时为空并提供投稿入口。
- `ContributionBox.vue`：投稿按钮与居中弹窗。字段包括标题、副标题、CC98 名字、CC98 链接、内容、图片、复习资料链接。当前只做前端状态，不实际上传文件。
- `CommentSection.vue`：评论区。只有认证用户可评论。
- `FavoriteButton.vue`：收藏按钮。
- `SettingsPanel.vue`：设置页，展示账号状态、测试账号切换、主题选择。
- `components/account/`：
  - `AccountPopover.vue`：右上角头像弹出的账号面板。
  - `MailboxPopover.vue`：右上角信箱面板。
  - `AuthStatusBadges.vue`：认证状态标签。
  - `UserSwitcher.vue`：测试用户切换控件。

### `src/services/`

逻辑服务层。新增规则优先写在这里并配测试，不要散落在 Vue 模板里。

- `authService.js`：登录/认证状态、投稿/评论/收藏权限、投稿消息和评论消息生成。
- `avatarService.js`：头像占位颜色轮换。
- `courseOverviewService.js`：从课程 CSV 模型生成课程总览字段和顶部摘要事实卡。
- `favoriteService.js`：收藏 key 生成、切换和判断。

### `src/utils/`

- `markdownContent.js`：解析带 frontmatter 的 Markdown，并提供正文段落解析。
- `publicPath.js`：给 `public/` 下资源加上 Vite base，保证 GitHub Pages 项目路径下资源可访问。凡是 fetch 或引用 public 静态资源时，都应考虑使用这里的 helper。

### `src/styles/`

纯 CSS 分层。

- `base.css`：全局变量、主题 token、基础 reset、字体、背景。
- `layout.css`：页面壳、顶栏、响应式主布局。
- `sidebar.css`：侧边栏和品牌导航。
- `resource.css`：资源中心和课程卡片。
- `course-detail.css`：课程详情、投稿弹窗、评论、PDF/卡片区域。
- `settings.css`：设置页。
- `auth.css`：右上角账号、信箱、认证标签等。
- `home.css`：未进入资源页时的首页/栏目预览。

### `public/`

Vite 会原样发布这些资源。面向用户的静态内容应优先放在这里，而不是塞进前端组件。

- `public/resource/`
  - `summary/introduction.csv`：课程目录核心数据源，课程代码是唯一标识。
  - `summary/summary.md`：资源页说明。
  - `educational_program/2023.pdf`、`2024.pdf`、`2025.pdf`：培养方案 PDF；当前 UI 仅支持 2024。
  - `courses/basic|general|major|personal/`：课程资料目录，按培养方案类别拆分。当前实际资料主要在 `basic/BIO2110F_microbiology-a/`，但详情页目前暂时不展示这些旧内容集合。
- `public/showcase/`
  - `desks/`：预留给“最美书桌”图片或数据。
  - `notes/`：预留给“最美笔记”图片、Markdown 或数据。
  - `schedule/`：预留给“最美日程表”图片或数据。
- `public/lab/`：预留给实验室开放日内容，例如实验室介绍、导师方向、开放日安排、报名说明。
- `public/navigator/`：预留给学业领航内容，例如培养方案解读、选课路径、升学/保研/竞赛经验。
- `public/peer/`：预留给朋辈辅学内容，例如答疑安排、学习小组、朋辈导师信息、经验帖索引。

### `demo_data/`

早期测试/演示数据。当前主要有效数据已经迁移到 `public/resource/`。除非用户明确要求回溯，否则新功能不要依赖 `demo_data/`。

### `docs/`

- `docs/design-system.md`：项目设计系统和初版视觉方向。做 UI 改动前应阅读，保持“简洁、学术、生命科学、可信、克制圆角”的方向。

### `tests/`

使用 Node 内置测试。当前测试覆盖：

- 导航数据：`sidebar.test.js`
- 设置与主题：`settings.test.js`、`themeCss.test.js`
- 响应式布局：`responsiveLayout.test.js`
- 资源页、培养方案、课程目录：`resourceCatalog.test.js`、`resourceProgram.test.js`
- 路由和路径：`resourcePaths.test.js`、`githubPages.test.js`
- 课程详情与课程总览：`courseDetails.test.js`、`courseOverview.test.js`
- 投稿弹窗：`contributionBox.test.js`
- Markdown 解析：`markdownContent.test.js`
- 认证/权限/收藏/消息：`authState.test.js`
- Netlify 配置：`netlifyConfig.test.js`

## 功能模块

### 已实现

- 左侧固定侧边栏与移动端折叠。
- 资源中心课程卡片，按 2024 培养方案顺序分为专业基础课程、专业课、个性修读课程、通识课。
- 培养方案选择器：2023、2024、2025 选项存在，但仅 2024 可用。
- 所有课程卡片均可点击进入详情页，URL 使用课程代码，不使用英文翻译。
- 通用课程详情页：
  - 课程总览：只显示顶部摘要行和四个事实卡。
  - 学习心得、复习资料、历年试卷：当前为空状态，提供投稿入口。
- 投稿交互：点击“投稿”打开居中弹窗，收集标题、副标题、CC98 名字、CC98 链接、内容、图片、复习资料链接。
- 前端账号骨架：
  - 测试用户：游客、CC98 认证者、邮箱认证者、双认证者、开发者。
  - 顶栏显示信箱和头像。
  - 设置页可切换测试用户和主题。
  - 认证用户可投稿和评论；游客看到权限提示。
- 收藏、评论、信箱消息为前端本地状态模拟。
- 多主题系统：石墨白、林冠绿、冰原蓝、星夜黑、电弧黑。
- GitHub Pages 部署工作流和 Netlify 配置。

### 预留 / 未完成

- 真实登录系统尚未实现。当前没有后端、数据库、session、JWT、OAuth 或真实验证码。
- CC98 认证目前只是测试状态，没有接入 CC98 API，也没有真实验证码验证流程。
- 学校邮箱验证码尚未实现，需要 SMTP/邮件服务和后端接口。
- 投稿只是前端弹窗与消息模拟，没有实际写入服务器、审核流、文件上传或图片存储。
- 收藏和评论只存在浏览器本地状态，不跨设备、不持久到后端。
- 课程详情的学习心得、复习资料、历年试卷当前故意为空；旧的 BIO2110F Markdown/PDF 仍在 `public/resource/courses/basic/BIO2110F_microbiology-a/`，可作为后续内容接入参考。
- 学业领航、朋辈辅学、实验室开放日、最美活动目前主要是导航与资源目录预留，未做完整页面。

## 开发思路与取舍

- 当前优先做“可扩展前端骨架”，不是一次性做完整业务系统。
- 课程代码是课程唯一标识，URL 和数据查找都应基于课程代码。
- 课程信息来源应尽量来自 CSV 或 `public/` 下内容文件，不要把长文本写死在 Vue 组件里。
- 前端组件只负责展示和交互；权限、收藏、课程字段生成等规则应放入 `src/services/`。
- `src/data/` 放结构化静态配置；`public/` 放用户内容和可迁移资源；`src/components/` 放 UI。
- 当前无路由库，使用手写 hash 路由。不要贸然引入 Vue Router，除非用户明确要求或功能复杂到需要。
- 当前无状态管理库。局部状态在 `App.vue`，纯逻辑在服务层。不要为少量状态引入 Pinia/Vuex。
- 当前无 UI 框架。保持纯 CSS 和现有设计 token，不要随意引入组件库。
- GitHub Pages 下 public 资源路径必须考虑 base，使用 `src/utils/publicPath.js`。

## 开发约定

### 代码风格

- 使用 Vue 3 `<script setup>`。
- 使用 ESM `import/export`。
- 组件命名使用 PascalCase，文件名同组件名。
- 服务函数使用明确动词命名，例如 `canSubmitResource`、`buildSummaryFacts`、`toggleFavorite`。
- CSS 使用语义化 class，整体偏 BEM 风格，例如 `course-detail__hero-main`、`resource-category__header`。
- 不要在模板里堆复杂判断；复杂逻辑先提到 computed、service 或 data helper。
- 中文文案使用 UTF-8。注意某些 PowerShell 输出可能乱码，但不要把乱码写回文件。

### UI 风格

- 保持工作型、学术型界面，不做营销落地页。
- 卡片圆角保持克制，通常不超过 8px。
- 不使用装饰性渐变球、过度阴影、过度玻璃拟态。
- 页面应适配大屏，不要写死固定列数；优先使用 `auto-fit/minmax`。
- 控件文案面向用户，不展示“来自 CSV”“后端待接入”等实现说明。

### 测试策略

- 改功能前优先补或更新测试，再实现。
- 每次改动至少运行：
  - `npm.cmd test`
  - `npm.cmd run build`
- 如果改 GitHub Pages 资源路径，还应运行：
  - PowerShell: `$env:GITHUB_PAGES='true'; npm.cmd run build`
- 测试以行为和数据契约为主，不做脆弱的 DOM 快照。
- 新增服务层函数必须有测试。
- 改课程分类、路由、CSV 字段、投稿表单、权限逻辑时，优先补充对应测试。

### 部署注意

- GitHub Pages 仓库名当前按 `ZJU_CLS_Study_Web` 配置。若仓库名变化，修改 `vite.config.js` 中的 `githubPagesBase`，并确认 `tests/githubPages.test.js` 是否需要同步。
- `dist/` 是构建产物，不应作为源码手工编辑。
- `node_modules/` 不应提交。
- Netlify 配置保留，但当前说明和 workflow 以 GitHub Pages 为主。

## 给后续 AI 助手的具体提醒

- 不要把新的学习心得、复习资料、试卷正文直接写入 Vue 组件。应放入 `public/` 下的 Markdown/CSV/JSON，再由代码读取。
- 不要恢复旧的“培养方案信息 / 课程总览”大段字段展示。当前用户要求课程总览只保留顶部摘要行。
- 不要把课程 URL 做成中文名或英文名；保持 `#resources/#课程代码`。
- 如果要重新接入 BIO2110F 的旧 Markdown/PDF，先确认用户是否希望恢复内容列表；当前状态是“所有课程三类资料先保持空”。
- 如果要做真实登录，建议新增后端项目或 `server/` 目录，不要在当前纯前端里伪造安全逻辑。前端已有权限接口只是 UI 骨架。
- 如果要做 CC98 验证码认证，当前推荐最小后端方案是 Express + SQLite/PostgreSQL + 手动发放验证码校验。真实安全逻辑必须在后端完成。
- 如果要做学校邮箱验证码，需准备 SMTP 服务、后端接口、验证码表、过期时间和限流策略。
- 当前本地开发端口是 5174，不是 Vite 默认 5173。
