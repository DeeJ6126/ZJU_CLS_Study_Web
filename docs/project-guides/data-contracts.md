# Data Contracts

## 课程 CSV

核心数据源：

```txt
public/resource/summary/introduction.csv
```

约定：

- 课程代码唯一。
- 课程代码是 URL、详情页查找、收藏 key 的稳定身份。
- 不要用课程中文名或英文名做路由。
- 课程总览字段应由代码从 CSV 模型生成。
- 网站课程目录（包括首页搜索、概览、资源中心、管理平台与后端课程搜索）仅显示 `BIO` 开头课程及 `CAB2001F`。原始 CSV 仍保留培养方案引用的跨院课程，供数据核对；用户可见目录统一经 `filterSiteCourses` 过滤。

## 路由契约

资源中心：

```txt
#resources
```

课程详情：

```txt
#resources/#BIO2110F
```

课程详情子页：

```txt
#resources/#BIO2110F/#experiences
#resources/#BIO2110F/#materials
#resources/#BIO2110F/#papers
```

子项详情：

```txt
#resources/#BIO2110F/#materials/#1
```

所有路由生成和解析集中在：

```txt
src/data/courses/resourcePaths.js
```

## 内容位置

长内容、用户投稿、学习心得、复习资料和试卷正文不写进 Vue 组件。应放在：

```txt
public/resource/courses/
public/showcase/
public/lab/
public/navigator/
public/peer/
```

已发布的课程心得、复习资料和历年试卷也可以来自后端内容库：

```txt
server/data/content.sqlite
server/data/content-uploads/
```

后端启动时会幂等导入 `public/resource/courses/` 中的现有 Markdown。前台优先读取
`api/content/courses/:courseCode`；只有接口不可访问时才回退到静态 Markdown。接口成功返回空列表时不得回退。

管理端记录使用内部内容 ID，面向学生的详情路由继续使用 `routeId`，从而保留现有数字子项路由。

账号的 `grade` 是入学年份，`majorId` 使用培养方案的五个专业 ID。游客对应数据存放在以 `zjubio:local-workspace:v1:` 开头的浏览器键中。首页按上海时区和秋冬/春夏/短学期计算培养方案建议课程；没有对应年级方案时明确显示未收录。最近练习仅保存会话标识，继续练习时仍由题库服务校验并返回当前题目。

首页资料搜索使用 `/api/search/resources`，只索引已发布内容，按课程、类型、老师、学年筛选并分页。搜索结果只返回公开摘要字段，链接由课程代码、栏目和 `routeId` 生成，不能用内部内容 ID 拼详情地址。历史 `BIO2009F`“微生物学及实验（甲）”资料可随新拆分的 `BIO2110F`“微生物学（甲）”和 `BIO2113F`“微生物学实验”搜索到，但资料仍保留原课程代码与路由。

学习心得和复习资料可附带选填的 `cc98Url` 与 `gpa`。公开内容同时返回
`likeCount` 与当前匿名浏览器的 `viewerLiked` 状态；绩点是否展开只属于前端显示状态。

所有课程内容和投稿支持 `sourcePlatform`（`cc98 / duoduo / other`）及选填的
HTTP(S) `sourceUrl`。CC98 来源镜像 `cc98Url`；其他来源不冒用 CC98 图标，旧记录
仍可由 `cc98Url` 读取。人工录入的 `author` 是原作者或整理者，录入管理员留在
操作日志中，不会成为原作者的公开主页归属。

管理员连续录入通过 `requestId` 防止创建请求重试产生重复记录，通过
`expectedUpdatedAt` 检查编辑冲突。本机未完成草稿按真实/演示身份及稳定用户 ID
隔离，键前缀为 `zjubio:admin-drafts:v1:`；仅保存表单字段及文件元数据，上传中的
PDF 在刷新后需要重新选择。发布并录入下一条保留专业、课程、类型和来源平台，
清空原作者、标题、正文及附件等本条内容。

投稿先进入 `content_submissions`，管理员通过后转换为共享 `content_items` 记录并立即发布。
审核、内容发布、编辑、下架和文件变更写入 `audit_logs`。

## 账号身份

账号数据位于 `server/data/auth.sqlite`。`users` 保存密码哈希、昵称和角色，
`user_identities` 保存 `cc98` 或 `email` 身份。一个用户最多拥有每种身份各一个，
每个规范化身份只能属于一个用户。邮箱只接受精确的 `@zju.edu.cn`，公开用户对象
只返回脱敏邮箱；验证码表不保存明文验证码。

## GitHub Pages 路径

引用 `public/` 资源时需要考虑 Vite base，优先使用：

```txt
src/utils/publicPath.js
```

## 项目检查

- `npm run check:routes`：检查课程路由契约。
- `npm run check:content`：检查长内容是否误入组件。

## Public Notices

Public notices use `/api/notices` and `#notices/:id`; private account messages retain `/api/account/notifications` and `#notifications`. `category` is `awards`, `scholarships`, `aid`, `academic`, or `general`. Empty `majorIds`/`cohortYears` means unrestricted, not hidden. `publishedDate` is a date-only string; `deadline` is an optional timezone-qualified timestamp displayed in Asia/Shanghai. List APIs paginate after sorting pinned notices first and publication dates descending. Drafts and archived notices are only visible to administrators, including attachment downloads. No real notices are seeded from invented data.

## User Profiles

- Email identities use `${studentId}@zju.edu.cn`, where `studentId` is digits only.
- `users.public_id` is the only user identifier exposed in public profile routes.
- Nicknames are 2–20 Chinese/letter/digit/underscore/hyphen characters and unique
  after case normalization.
- Public content may include an `owner` object with `publicId`, `nickname`, and
  `avatarUrl`; static imported content keeps `owner: null`.
- `content_items.owner_id` links an approved submission to its author.
- A published-post edit creates a `content_submissions` row with
  `submission_kind = revision` and `target_content_id`; approval updates the target
  record instead of creating a duplicate.

## Account Learning Data

My Courses and course favorites are independent. Guests keep `myCourses` plus `coursesInitialized` in their existing browser workspace. Verified accounts use `user_courses` and a `user_course_workspace` initialization marker in auth SQLite. An uninitialized empty list with a supported major/cohort is seeded from current-term professional/foundation sections; existing imports are retained. Manual deletion to an empty list remains empty across reloads/devices. `POST /api/account/courses/preset` explicitly replaces the list after UI confirmation; unsupported curricula leave it unchanged. The full CSV is used only by the course picker/preset, while public resource discovery and course routes retain the BIO/CAB site restriction.

- `auth.sqlite` stores private courses, favorites, notifications, and account-linked quiz ownership.
- `content.sqlite` stores identified comments keyed by immutable content and user IDs. Replies use one level and deletion is soft.
- Signed-in quiz data is keyed by user ID, collection ID, and a stable source-question or vocabulary key. Successful first-login merge clears the corresponding local browser records.
- Timetable import accepts only XLSX up to 5 MB, scans the first 30 rows of every sheet for the six required Chinese headers, previews without writing, and replaces only after confirmation.
- Timetable storage keeps course code, name, teacher, term, time, location, and import time. Unknown course codes are retained and marked as unmatched.
- Notifications expose only public actor identity and course-code route targets, never email or internal user IDs.
