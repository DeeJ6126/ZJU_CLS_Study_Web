# New Round 专项 Bug 审计(2026-09-05)

**基线**: HEAD `fbf1fa4` · 361/361 测试通过 · main 干净
**审计模式**: 8 个 explore agent 并行,只读,不修复
**总计**: 123 个 bug(15 critical / 31 high / 42 medium / 35 low)
**状态**: 留档,准备分批修复

---

## 严重度分布

| Agent 范围 | critical | high | medium | low | 合计 |
|---|---|---|---|---|---|
| 1. 前端 UI 完整性 | 5 | 9 | 9 | 7 | 30 |
| 2. 新 round 综合(功能缺失) | 0 | 1 | 4 | 3 | 8 |
| 3. 评论 + 通知 + UBB 集成 | 0 | 2 | 5 | 4 | 11 |
| 4. 服务端安全 + 边界 | 1 | 5 | 6 | 9 | 21 |
| 5. 资源平台端到端 | 4 | 4 | 3 | 0 | 11 |
| 6. 导航 + 路由 + URL 状态 | 2 | 4 | 6 | 5 | 17 |
| 7. 状态隔离 + 数据流 | 3 | 4 | 5 | 3 | 15 |
| 8. 认证 + 权限 | 0 | 2 | 4 | 4 | 10 |
| **合计** | **15** | **31** | **42** | **35** | **123** |

---

## 15 个 critical bug(必须修)

### 来源 1 — 前端 UI

- **CRIT-UI-1** "查看成绩"按钮是死按钮,无 click handler — `src/components/CourseDetailPage.vue:244-248, 335-339`
- **CRIT-UI-2** `StudentHomepageListModal.vue` 整文件是 stub,`studentHomepageApiClient.js` 导出 `{}` — `src/components/StudentHomepageListModal.vue:1`、`src/services/studentHomepageApiClient.js:1-2`
- **CRIT-UI-3** 活动详情页是占位 "内容待后续完善" — `src/components/ActivityDetailPage.vue:42-44`
- **CRIT-UI-4** AuthDialog 假模态:标 `aria-modal="true"` 但无遮罩 / 焦点 trap / Esc 关闭 — `src/components/account/AuthDialog.vue:65`、`src/styles/auth.css:289-300`
- **CRIT-UI-5** 通知"查看"对无 target 通知静默成功 — `src/App.vue:1761-1762`、`src/components/account/NotificationsPage.vue:39`

### 来源 5 — 资源平台

- **CRIT-RES-1** 投稿图片选择器是空架子:UI 暴露但后端只存文件名,二进制未上传 — `src/components/ContributionBox.vue:61-63, 247-250`、`server/content/contentStore.js:540-545`、`server/content/submissionService.js:67, 78`
- **CRIT-RES-2** 评论可跨 content 引用 parentCommentId(数据完整性 + 跨内容信息泄露) — `server/content/commentService.js:13-43`
- **CRIT-RES-3** 投稿不要求 CC98/邮箱认证(绕过前端即可裸账号投稿) — `server/content/contentHttpService.js:261-273`
- **CRIT-RES-4** revision 通过时旧 PDF 永远不删(资源泄漏) — `server/content/submissionService.js:199-204`

### 来源 4 — 服务端安全

- **CRIT-SEC-1** 种子 CC98 验证码 + admin 白名单名字硬编码进仓库 + invite token 弱 = 静默提权 — `src/data/config/cc98VerificationCodes.js:12-30`、`server/authService.js:194-198`

### 来源 6 — 导航 + 路由

- **CRIT-NAV-1** 活动详情路由不可达:点击"查看活动详情"跳转到"刷题"页 — `src/App.vue:2591-2656`(模板无 `activity-detail` 分支)
- **CRIT-NAV-2** 顶栏搜索结果点击后全部跳到首页(后端 hash 格式 `#/foo` 与前端 `#foo` 不兼容) — `src/components/SearchBar.vue:110-120`

### 来源 7 — 状态隔离

- **CRIT-STATE-1** Quiz localStorage 完全不按账号隔离 — `src/services/botanyQuizService.js:1-2`、`microbiologyQuizService.js:1-3`、`molecularQuizService.js:1-3`
- **CRIT-STATE-2** 真实账号登录会"继承" demo 错题/生词到服务器(不可逆污染) — `src/App.vue:1693-1720 migrateLocalQuizData`
- **CRIT-STATE-3** 真实账号登录会"接管" demo 练习 session(题目顺序、已答记录全转移) — `src/App.vue:1695 claimQuizSession`

---

## 31 个 high bug(应修)

### 来源 1 — 前端 UI(9 high)

- **HI-UI-1** ContributionBox 模态无 Esc 关闭 + 无焦点 trap — `src/components/ContributionBox.vue:168-179`
- **HI-UI-2** QuizPracticePanel + App.vue 重复挂载 window keydown 监听(按键触发两次) — `src/components/QuizPracticePanel.vue:254-260`、`src/App.vue:2463`
- **HI-UI-3** 账号/通知 Popover 无点击外部关闭 / Esc 关闭 — `src/App.vue:2493-2525`
- **HI-UI-4** 投稿 UBB 工具栏用 `window.prompt`(阻塞) — `src/components/ContributionBox.vue:112-124`
- **HI-UI-5** 管理员拒绝原因用单行 input,500 字限制 UX 差 — `src/components/admin/AdminPage.vue:845`
- **HI-UI-6** CommentSection 编辑时 `replyTo` 状态不清 — `src/components/CommentSection.vue:34-37`
- **HI-UI-7** ProfilePage 编辑评论用 `window.prompt` — `src/App.vue:2117-2125`
- **HI-UI-8** 管理员编辑器用 `window.confirm` 卡住浏览器 — `src/components/admin/AdminPage.vue:276, 307, 336, 357, 388, 450, 461, 482, 501`
- **HI-UI-9** CommentSection 允许过短评论(< 2 字符) — `src/components/CommentSection.vue:101-109`

### 来源 2 — 新 round 综合(1 high)

- **HI-NEW-1** 演示账号切换在非 profile/admin 页面**完全不重置页面状态** — `src/App.vue:209-225 selectDemoIdentity`

### 来源 3 — 评论 + 通知(2 high)

- **HI-CMT-1** 通知"查看"无法跳到具体评论(commentId 链路缺失) — `src/App.vue:1752-1757`、`src/components/CommentSection.vue:55-96`
- **HI-CMT-2** demo `createComment` 不校验 `parent.contentId`(跨帖回复串台) — `src/services/demoAccountService.js:393-406`

### 来源 4 — 服务端安全(5 high)

- **HI-SEC-1** `readJsonBody` 没有大小上限 → 内存 DoS — `server/server.js:82-89`
- **HI-SEC-2** 头像 read-then-write 竞态 → 新头像被自己删 — `server/server.js:406-409`
- **HI-SEC-3** 完全信任 `X-Forwarded-For` → 限速绕过 — `server/server.js:115-122`
- **HI-SEC-4** 审核通过无事务 → 并发双发/双通知 — `server/content/submissionService.js:138-208`
- **HI-SEC-5** `bindOrRebindCc98` 事务不完整 → 身份替换后旧 session 仍可用 — `server/authService.js:278-285`

### 来源 5 — 资源平台(4 high)

- **HI-RES-1** 管理员 PATCH 改 externalUrl/cc98Url 不去重 — `server/content/contentService.js:113-129`
- **HI-RES-2** admin 能删但不能编辑同一评论(鉴权矩阵错位) — `server/content/contentHttpService.js:92-98`、`server/content/commentService.js:45-61`
- **HI-RES-3** 撤回/拒绝的投稿带 PDF 永远不删 — `server/profile/profileHttpService.js:246-266`、`server/content/contentHttpService.js:454-479`
- **HI-RES-4** 撤回的投稿永远没法"重新提交审核"(状态机死胡同) — `server/profile/profileHttpService.js:184-211`

### 来源 6 — 导航 + 路由(4 high)

- **HI-NAV-1** 任何 in-page 锚点都不滚 — `src/` 目录无 `scrollIntoView` 调用
- **HI-NAV-2** 真实账号登出后 URL 不回 `#home` — `src/App.vue:2282-2305 handleLogout`
- **HI-NAV-3** Admin 后台 4 个 tab 不写 URL,F5 全回默认 — `src/components/admin/AdminPage.vue:53, 275-290`
- **HI-NAV-4** Profile 页内 5 个 section 不写 URL,F5 总回"账号资料" — `src/components/profile/ProfilePage.vue:29`

### 来源 7 — 状态隔离(4 high)

- **HI-STATE-1** `selectDemoIdentity` 几乎不清理任何 in-memory 状态 — `src/App.vue:209-225`
- **HI-STATE-2** `finishAuthentication` 不清理 demo 残留 — `src/App.vue:2144-2157`
- **HI-STATE-3** 3 个 collection 错题 ref 切账号不重读 — `src/App.vue:250-256 vs 2299-2303`
- **HI-STATE-4** `setQuizAnonymousMode` module-level 单例 race — `src/services/quizApiClient.js:8-12`

### 来源 8 — 认证(2 high)

- **HI-AUTH-1** 邮件验证码请求泄露注册邮箱清单(枚举攻击) — `server/emailAuthService.js:99-104`
- **HI-AUTH-2** X-Forwarded-For / X-Forwarded-Proto 完全信任(部署隐患) — `server/server.js:115-131`

---

## 42 个 medium bug(应修)

### 来源 1 — 前端 UI(9 medium)

- **ME-UI-1** 加载文案不统一(中英 / 中标混用) — 多组件散布
- **ME-UI-2** 暗色主题下搜索栏 `.search-bar__code` 颜色对比度勉强 — `src/styles/search-bar.css:216-219`
- **ME-UI-3** AppSidebar 移动端无"侧栏开关"按钮 — `src/styles/layout.css:43-79`
- **ME-UI-4** 错题/生词"清空"按钮无二次确认 — `src/App.vue:1472-1482`
- **ME-UI-5** CourseDetailPage 加载失败时只显示一行文字,无重试 — `src/components/CourseDetailPage.vue:285-287, 376-378, 439-441`
- **ME-UI-6** 暗色主题下 HomePage 资源卡片图片没暗色背景 fallback — `src/components/HomePage.vue:159-166`
- **ME-UI-7** 图片缺失无 onerror fallback — `src/components/ActivityPage.vue:74-76`、`AdminPage.vue:794`、`HomePage.vue:160`
- **ME-UI-8** 通知无"删除"功能 — `src/components/account/NotificationsPage.vue:23-40`
- **ME-UI-9** 主页搜索框显示 `<kbd>Enter</kbd>`,但不是 form,按 Enter 不触发搜索 — `src/components/HomePage.vue:102-106`

### 来源 2 — 新 round 综合(4 medium)

- **ME-NEW-1** 真账号在 API fallback 静态课程的评论区永远空白 — `src/App.vue:1737`
- **ME-NEW-2** 通知页 `listNotifications` 限 50 + `unreadCount` 全局 — `server/authStore.js:502-514`
- **ME-NEW-3** 静态 item 仍渲染 `<CommentSection>`,可点但永远 404 — `src/components/CourseDetailPage.vue:265-274`
- **ME-NEW-4** 评论 reply 上"回复"按钮写死指向根评论(通知语义错) — `src/components/CommentSection.vue:86`

### 来源 3 — 评论 + 通知(5 medium)

- **ME-CMT-1** ProfilePage / NotificationsPage 不用 UBB 渲染 — `src/components/profile/ProfilePage.vue:207`、`NotificationsPage.vue:36`
- **ME-CMT-2** demo `listComments` 排序与 server 不一致 — `src/services/demoAccountService.js:386-391`
- **ME-CMT-3** demo 端 admin 不能管理他人评论 — `src/services/demoAccountService.js:389`
- **ME-CMT-4** demo `createComment` 不做长度 / 限流校验 — `src/services/demoAccountService.js:393-406`
- **ME-CMT-5** 评论树无 `id` 锚点 + 无 `scrollIntoView` — `src/components/CommentSection.vue:55,77`

### 来源 4 — 服务端安全(6 medium)

- **ME-SEC-1** 评论区 / 错题本 速率限制 TOCTOU — `server/content/commentService.js:27-32`
- **ME-SEC-2** 匿名 quiz session URL 泄露即被任意访问 — `server/quiz/quizSessionService.js:17-24`
- **ME-SEC-3** `findUserByNickname` 唯一性 TOCTOU — `server/authStore.js:166-183`
- **ME-SEC-4** 全局写接口几乎无 rate-limit — `server/server.js` 所有非登录 / 非邮件码端点
- **ME-SEC-5** 头像 / PDF sharp 处理无超时 → CPU DoS — `server/profile/avatarService.js:23-32`
- **ME-SEC-6** HTTP 安全头几乎全缺(无 CSP / X-Frame-Options / HSTS) — `server/server.js:104-110`

### 来源 5 — 资源平台(3 medium)

- **ME-RES-1** 课程代码不在 `courseCatalog` 校验 — `server/content/contentService.js:32-34`
- **ME-RES-2** like / comment 并发竞态 — `server/content/contentStore.js:645-654, 715-729`
- **ME-RES-3** 演示模式管理员收到的投稿通知完全无上下文 — `src/services/demoAccountService.js:330`

### 来源 6 — 导航 + 路由(6 medium)

- **ME-NAV-1** 刷题内部状态(课程/题集/题型/当前题号)不写入 URL — `src/App.vue:226-262`
- **ME-NAV-2** `setPage('overview')` 会清掉 OverviewPage 当前的 program/group 过滤器 — `src/App.vue:528-542`
- **ME-NAV-3** `ActivityPage` 接收了 `activeSlug` prop 但模板里完全不用 — `src/components/ActivityPage.vue:9-12`
- **ME-NAV-4** `getActivitySlugFromHash` 不识别 `#activity-program-<id>` 锚点格式 — `src/services/demoNavigationService.js:55-58`
- **ME-NAV-5** 未知 courseCode 渲染空 CourseDetailPage — `src/App.vue:1858-1900`
- **ME-NAV-6** `getProfileIdFromHash` / `getActivitySlugFromHash` 在 `%` 时抛 `URIError` — `src/services/demoNavigationService.js:57, 62, 71`

### 来源 7 — 状态隔离(5 medium)

- **ME-STATE-1** 切 demo 不重置 `activeCourseCode` / `activeCollectionSlug` / `quizView` / 3 个 collection page — `src/App.vue:209-225`
- **ME-STATE-2** `commentsByContentId` 切账号不清 — `src/App.vue:288`
- **ME-STATE-3** `profileView` / `activeProfilePublicId` / `profileNotice` 切账号不重置 — `src/App.vue:276-280`
- **ME-STATE-4** `courseImportPreview` 切账号不清 — `src/App.vue:283`
- **ME-STATE-5** 7 个 quiz localStorage key 没有 schemaVersion — `src/services/molecularQuizService.js:1-3`

### 来源 8 — 认证(4 medium)

- **ME-AUTH-1** 邮箱绑定后不释放其他登录会话 — `server/emailAuthService.js:190-207`
- **ME-AUTH-2** 几乎所有 state-changing 端点没有 CSRF 防御 — `server/server.js:222-815`
- **ME-AUTH-3** 公共用户搜索 / 学生主页申请无速率限制 — `server/profile/profileHttpService.js:40-45`
- **ME-AUTH-4** `study_visitor` 点赞 cookie 永远不设 `Secure` 标志 — `server/content/contentHttpService.js:255-257`

---

## 35 个 low bug(可后续清理)

### 来源 1 — 前端 UI(7 low)

- **LO-UI-1** 热门资源卡片 alt 写死 "植物茎切片显微图" — `src/components/HomePage.vue:160`
- **LO-UI-2** Unknown hash 路由没有 404 fallback — `src/services/demoNavigationService.js`、`App.vue:1804-1902`
- **LO-UI-3** 列表项 / 卡片缺少复制链接按钮 — `src/components/CourseDetailPage.vue:175-203`
- **LO-UI-4** 暗色主题下 `account-switcher__label select` 仍用 `background: #fff` — `src/styles/auth.css:511-519`
- **LO-UI-5** 移动端 (<760px) 主页搜索结果列表没 max-height — `src/components/HomePage.vue:108-115`
- **LO-UI-6** 课程详情页 favorite/点赞按钮无 `aria-label` — `src/components/CourseDetailPage.vue:249-256, 340-347`
- **LO-UI-7** 主页"快捷入口"对照说明(信息性) — `src/components/HomePage.vue:122-134`

### 来源 2 — 新 round 综合(3 low)

- **LO-NEW-1** 演示模式管理员收到的投稿通知完全无上下文 — `src/services/demoAccountService.js:330`(已与 ME-RES-3 重复,合并)
- **LO-NEW-2** 评论编辑空提交不阻止 — `src/components/CommentSection.vue:39-43`
- **LO-NEW-3** 收藏人数对真实账号永远显示 0(已知限制) — `src/App.vue:301-305`

### 来源 3 — 评论 + 通知(4 low)

- **LO-CMT-1** 通知"查看"对 content 归档/删除后 target 变 null — `server/account/accountHttpService.js:48-67`
- **LO-CMT-2** demo 通知 body 用弯引号 vs server 用方头括号 — `src/services/demoAccountService.js:330, 493`
- **LO-CMT-3** `commentsByContentId` 全局 map 不在登出/切账号时清空 — `src/App.vue:288,2294`
- **LO-CMT-4** UBB `[color]` 允许 `red;anything` 弱校验 — `src/utils/ubbParser.js:97-99`

### 来源 4 — 服务端安全(9 low)

- **LO-SEC-1** 过期 session 永不清扫,表无限增长 — `server/authStore.js:532-539`
- **LO-SEC-2** 登录锁仅在内存,重启即清零 — `server/loginGuard.js:1-6`
- **LO-SEC-3** `existingRevision` 查 + 插非原子 — `server/content/submissionService.js:105-110`
- **LO-SEC-4** activity `duplicateLink` 每次都全表扫 — `server/content/activityService.js:82-85`
- **LO-SEC-5** `isHttpsRequest` 信任 `X-Forwarded-Proto` — `server/server.js:126-131`
- **LO-SEC-6** 通知 / 评论 content_id 缺外键 — `server/content/contentStore.js:224-235`
- **LO-SEC-7** nick 验证仅限字符类,允许全角 / 同形 Unicode 绕 uniqueness — `server/authService.js:75-79`
- **LO-SEC-8** 公开 profile 搜索无鉴权可被全量爬取 — `server/authStore.js:245-253`
- **LO-SEC-9** SMTP 失败日志只记 purpose,缺 attempt count — `server/emailAuthService.js:128-131`

### 来源 6 — 导航 + 路由(5 low)

- **LO-NAV-1** `src/data/config/navigation.js` 定义了 5 个侧边栏入口但全项目无 import — `src/data/config/navigation.js:1-53`
- **LO-NAV-2** `src/components/AppSidebar.vue` 和 `src/components/ResourcePage.vue` 都是孤儿组件 — `src/components/`
- **LO-NAV-3** 主页快捷链接 hash 协议不统一(信息性) — `src/components/HomePage.vue:122-134`
- **LO-NAV-4** `selectDemoIdentity` 切到 admin 演示账号未跳到 `#admin` — `src/App.vue:209-225`
- **LO-NAV-5** Unknown hash 不会把 URL 修正成 `#home` — `src/services/demoNavigationService.js:26-52`

### 来源 7 — 状态隔离(3 low)

- **LO-STATE-1** `molecularLanguage` 是浏览器级,不是账号级 — `src/services/molecularQuizService.js:1`
- **LO-STATE-2** `message` / `contributionNotice` / `likeNotice` / `commentNotice` / `notificationNotice` 切账号不清 — `src/App.vue:266-290`
- **LO-STATE-3** `useQuiz.clearAll` / `resetDemoQuizState` 不存在 — 全局缺失

### 来源 8 — 认证(4 low)

- **LO-AUTH-1** 评论 PATCH/DELETE、profile 撤回、posts archive 等端点无 content-type 校验 — `server/content/contentHttpService.js:184-198`
- **LO-AUTH-2** 邮箱注册用户的 audit log actor 名称显示为"未绑定" — `server/content/submissionService.js:27-32`
- **LO-AUTH-3** `searchUsersByNickname` 在内部 SELECT 整个 `users` 行(包含 passwordHash) — `server/authStore.js:245-253`
- **LO-AUTH-4** 客户端没有 401 后端响应处理,服务端 session 失效后 UI 状态过期 — `src/App.vue`、`src/services/apiClient.js:84-90`

---

## 整体架构观察(贯穿多 agent 共识)

1. **App.vue 单文件 4500+ 行** — 8 个 agent 都提到这是审计/维护的最大阻碍,useProfile / useQuiz / useMicrobiologyReview / useMistakeRecords / useVocabulary 这 5 个 composable 切出去会大幅改善。
2. **demo vs 真实账号"双轨制"持续扩大** — 几乎每个 service / 端点都有 `isDemoAccount ? demoXxx : apiClient` 二选一,读取路径不是二选一导致串台。
3. **状态机有死胡同** — `pending → withdrawn` 无路可走;`content_items` 是 append-only 永远不能物理删除;`draft` / `archived` 转换覆盖不全。
4. **鉴权矩阵散落** — service / store / HTTP 三层鉴权检查不一致,同一类操作在同文件里不同(评论 update 拒绝 admin,delete 允许 admin)。
5. **测试盲区** — 大量"happy path"测试通过但端到端、并发、资源泄漏、跨账号串台都没测;`profileUi.test.js` 用 `readFileSync` 字符串匹配代替真实行为测试。
6. **CSRF / rate limit / trust proxy 部署期债务** — `loginGuard` 仅覆盖登录,其它写接口裸奔;`getClientIp` 完全信任 `X-Forwarded-For`;CSRF 防护仅靠 `SameSite=Lax`。
7. **hash 协议不统一** — 应用内 `#foo`、搜索后端 `#/foo`、sub-route `#foo/#bar` 三套并存。
8. **死代码** — `ActivityDetailPage` / `AppSidebar` / `ResourcePage` / `StudentHomepageListModal` / `studentHomepageApiClient` / `data/config/navigation.js` 全是孤儿。

---

**留档完成,准备开始 Phase 2:修 critical 15 个 bug。**
