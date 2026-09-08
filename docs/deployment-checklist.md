# 公网部署检查清单

> 适用于 `https://bis.zju.edu.cn/zjubio/` 公网开放场景。按阶段推进，每项含
> 「为什么」与「怎么做/验收」。阶段 0 是仓库代码改动（无需服务器）；阶段 1–4
> 在课题组服务器上执行。

## 背景

- 域名：`bis.zju.edu.cn`（浙大官方域名，HTTPS 证书/备案由学校承担）。
- 服务器：Apache/2.4.41 (Ubuntu)，`/var/www/html/zjubio/` 提供静态前端。
- 后端：Node `server/server.js`（仅监听 127.0.0.1:5175）。2026-09-08 实查未运行，Supervisor 中也尚无 zjubio program。
- 数据：SQLite 三库（auth / quiz / content）+ PDF 上传 + 头像上传。
- 注册设计：可见前端仅接受数字学号 `@zju.edu.cn` 邮箱验证；CC98 接口只为后端兼容保留，不提供前端入口。
- 权限设计：游客只读与匿名刷题；点赞、收藏、评论、投稿、资料修改和账号同步要求学号认证；管理员另有服务端管理权限。

---

## 阶段 0 · 代码基线（已完成）

### 0.1 登录暴力破解防护 ✅

- **已完成**：同账号 5 次失败锁定 15 分钟，同 IP 执行失败频率限制；已覆盖锁定、恢复、账号隔离和 HTTP 端到端测试。

### 0.2 Secure cookie + 信任 HTTPS ✅

- **已完成**：会话 cookie 根据 `X-Forwarded-Proto` 增加 `Secure`，已测试 HTTPS 与直连 HTTP 两种情况。

### 0.3 X-Forwarded-For 信任 ✅

- **已完成**：验证码与登录限流使用 `X-Forwarded-For` 首个地址，缺失时回退 socket 地址；Node 服务部署时只监听 `127.0.0.1`。

### 0.4 健康检查端点 ✅

- **已完成**：`GET /api/health` 无需登录即返回 `{ "ok": true }`，HTTP 测试已覆盖。

---

## 阶段 1 · 服务器部署

### 1.1 同步静态产物

- **为什么**：线上 `dist/` 是旧版构建，需与当前代码一致。
- **怎么做/验收**：在 `/var/www/html/zjubio/` 执行 `npm run build`，
  Apache 通过 Alias 提供该目录下的 `dist/`；刷新页面验证首页为最新。

### 1.2 Supervisor 守护 Node 后端

- **为什么**：服务器重启或进程崩溃后服务自动恢复。
- **怎么做/验收**：
  - 使用 `deploy/supervisor-zjubio.ini`；当前容器的 Supervisor 主配置是
    `/etc/supervisor/conf.d/supervisord.conf`，需先增加一次 `*.ini` include。
  - 通过 `scripts/run-production-server.sh` 读取 `/etc/zjubio/zjubio.env`，避免把密钥写进 Supervisor 配置。
  - reread/update 后确认 `zjubio-node` 为 `RUNNING`；重启容器后服务自动恢复。

### 1.3 Apache 反代 `/api`

- **为什么**：前端与后端同源，避免 CORS；保留 HTTPS 一跳。
- **怎么做/验收**：
  - 使用 `deploy/apache-zjubio.conf`，将 `/zjubio/` 明确映射到 `dist/`，
    并把 `/api/` 反代到 `http://127.0.0.1:5175/api/`。
  - `apache2ctl configtest` 必须返回 `Syntax OK`，再 graceful reload；
    `curl /api/health` 返回 200。

### 1.4 环境变量注入

- **为什么**：密钥不进仓库、不进代码。
- **怎么做/验收**：
  - 按 `.env.example` 准备环境变量文件：
    `ADMIN_STUDENT_IDS`（管理员数字学号白名单）、
    `SMTP_*`（学号邮箱客户端密码）、各数据路径。
  - Supervisor 启动脚本读取该文件；确认无凭据出现在进程参数/日志。

### 1.5 数据目录落位与权限

- **为什么**：SQLite 与上传文件需要固定位置和正确属主。
- **怎么做/验收**：
  - 按 `AUTH_DB_FILE` / `QUIZ_DB_FILE` / `CONTENT_DB_FILE` /
    `STUDENT_HOMEPAGE_DB_FILE` / `CONTENT_UPLOAD_DIR` / `PROFILE_AVATAR_DIR` 建目录。
  - 确认运行用户对数据目录可读可写；首次启动自动完成迁移与导入。

### 1.6 首次启动验收

- **怎么做/验收**：访问 `https://bis.zju.edu.cn/zjubio/` 依次验证：
  注册收验证码邮件 → 登录 → 刷题 → 投稿 → 白名单学号登录 `#admin` 并完成一次管理 API 读取。

---

## 阶段 2 · 安全与数据

### 2.1 每日备份 + 恢复演练

- **为什么**：账号/刷题进度/内容/投稿数据丢失不可重建。
- **怎么做/验收**：
  - cron 每日 `sqlite3 .backup` 三个库 + rsync 上传/头像目录到异机或网盘。
  - 至少演练一次：从备份恢复到空库并确认数据完整。

### 2.2 安全响应头

- **为什么**：防点击劫持、MIME 类型混淆、信息泄露。
- **怎么做/验收**：
  - Apache 层加 `X-Frame-Options: SAMEORIGIN`、
    `X-Content-Type-Options: nosniff`、
    `Referrer-Policy: strict-origin-when-cross-origin`。
  - `curl -I` 验证响应头存在。

### 2.3 服务端日志 + 轮转

- **为什么**：排障与异常发现依赖日志。
- **怎么做/验收**：Node 输出进 journald（systemd 自带）；
  Apache error.log 确认轮转开启；上线后看一周日志无异常堆栈。

### 2.4 SMTP 发信监控

- **为什么**：验证码邮件发不出 = 新用户全部卡死。
- **怎么做/验收**：发信失败（`smtpMailer` 已有重试与日志）时
  增加失败计数落点；每周巡检确认成功率正常。

---

## 阶段 3 · 上线验证（发布当天）

- [ ] 注册：校外网络注册 → 收到验证码邮件 → 注册成功
- [ ] 登录/登出：学号邮箱登录、找回密码（校外网络实测）；页面无 CC98 登录入口
- [ ] 连续错密码 5 次 → 被锁定（验证 0.1）
- [ ] 刷题：三套题库练习、判分、错题本
- [ ] 内容：投稿 → 管理台审核 → 发布 → 评论/点赞
- [ ] 静态资源：图片、PDF 在 HTTPS 下正常加载
- [ ] `curl -I` 验证安全响应头（验证 2.2）
- [ ] 重启服务器一次 → 服务自动恢复（验证 1.2）
- [ ] 手机流量（非校园网）访问 → 功能可用（公网开放预期）

---

## 阶段 4 · 持续运维（每周约 10 分钟）

- [ ] 备份目录大小正常、昨日备份存在
- [ ] `journalctl -u zjubio` 无新增异常堆栈
- [ ] 验证码发信成功率正常
- [ ] 投稿审核队列处理完毕
- [ ] `npm audit` 无新增高危（或每月一次）

---

## 更新记录

- 2026-08-16 初稿：基于公网开放场景（bis.zju.edu.cn）整理。
