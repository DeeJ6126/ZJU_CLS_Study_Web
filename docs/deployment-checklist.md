# 公网部署检查清单

> 适用于 `https://bis.zju.edu.cn/zjubio/` 公网开放场景。按阶段推进，每项含
> 「为什么」与「怎么做/验收」。阶段 0 是仓库代码改动（无需服务器）；阶段 1–4
> 在课题组服务器上执行。

## 背景

- 域名：`bis.zju.edu.cn`（浙大官方域名，HTTPS 证书/备案由学校承担）。
- 服务器：Apache/2.4.41 (Ubuntu)，`/var/www/html/zjubio/` 提供静态前端。
- 后端：Node `server/server.js`（默认 5175 端口），尚未部署。
- 数据：SQLite 三库（auth / quiz / content）+ PDF 上传 + 头像上传。
- 注册设计：仅接受数字学号 `@zju.edu.cn` 邮箱验证 + CC98 一次性码，
  公网用户无法自行注册 —— 这是天然的第一道注册闸。

---

## 阶段 0 · 代码改动（仓库内完成，与服务器无关）

### 0.1 登录暴力破解防护

- **为什么**：公网第一攻击面。学号/CC98 用户名半公开（同学之间），
  密码登录目前无任何尝试限制，可被低成本爆破。
- **怎么做/验收**：
  - `server/authService.js` 与 `server/emailAuthService.js` 的登录路径加
    尝试计数：同账号连续失败 N 次（如 5 次）锁定 15 分钟；同 IP 失败频率限速。
  - 补测试：连续错密后被拒绝、锁定到期后恢复、不同账号互不影响。

### 0.2 Secure cookie + 信任 HTTPS

- **为什么**：会话 cookie 目前无 `Secure` 标志，HTTPS 站点下仍可被
  明文 HTTP 请求携带，存在被嗅探的风险。
- **怎么做/验收**：
  - `server/server.js` 的 cookie 生成处读取 `X-Forwarded-Proto`，
    仅当 Apache 声明 https 时输出 `Secure`（避免反代后误判为 http）。
  - 补测试：模拟 X-Forwarded-Proto https 时 cookie 含 Secure，http 时不含。

### 0.3 X-Forwarded-For 信任

- **为什么**：Apache 反代后 `request.socket.remoteAddress` 恒为
  127.0.0.1，验证码/评论的 IP 级限流全部失效，退化为服务级限制。
- **怎么做/验收**：
  - 提取 `X-Forwarded-For` 的第一个外部 IP 作为客户端地址，
    只信任反代注入（服务仅从反代访问时安全）。
  - 验证码限流（`server/server.js` 约 210 行）与评论限流共用此函数。
  - 补测试：反代头存在时取正确 IP，缺失时回退 socket 地址。

### 0.4 健康检查端点

- **为什么**：进程守护、监控、负载均衡需要"存活"信号。
- **怎么做/验收**：
  - Node 增加 `GET /api/health` 返回 `{ "ok": true }`（不查库或只读）。
  - 补测试：未登录也可访问，返回 200。

---

## 阶段 1 · 服务器部署

### 1.1 同步静态产物

- **为什么**：线上 `dist/` 是旧版构建，需与当前代码一致。
- **怎么做/验收**：`npm run build` → 同步 `dist/` 内容到
  `/var/www/html/zjubio/`；刷新页面验证首页为最新。

### 1.2 systemd 守护 Node 后端

- **为什么**：服务器重启或进程崩溃后服务自动恢复。
- **怎么做/验收**：
  - 写 `/etc/systemd/system/zjubio.service`：
    `ExecStart=node /var/www/html/zjubio/server/server.js`，
    `Restart=always`，`EnvironmentFile=` 指向环境变量文件。
  - `systemctl enable --now zjubio`；重启服务器后服务自动恢复。

### 1.3 Apache 反代 `/api`

- **为什么**：前端与后端同源，避免 CORS；保留 HTTPS 一跳。
- **怎么做/验收**：
  - zjubio 的 vhost 增加：
    `ProxyPass /api http://127.0.0.1:5175/` + `ProxyPassReverse`，
    并透传 `X-Forwarded-For` / `X-Forwarded-Proto`。
  - `apachectl configtest` 通过后重启；`curl -I /api/health` 返回 200。

### 1.4 环境变量注入

- **为什么**：密钥不进仓库、不进代码。
- **怎么做/验收**：
  - 按 `.env.example` 准备环境变量文件：
    `ADMIN_CC98_NAMES`（管理员名单）、`ADMIN_INVITE_TOKEN`（受控管理员注册口令）、
    `SMTP_*`（学号邮箱客户端密码）、各数据路径。
  - systemd `EnvironmentFile` 读取；确认无凭据出现在进程参数/日志。

### 1.5 数据目录落位与权限

- **为什么**：SQLite 与上传文件需要固定位置和正确属主。
- **怎么做/验收**：
  - 按 `AUTH_DB_FILE` / `QUIZ_DB_FILE` / `CONTENT_DB_FILE` /
    `STUDENT_HOMEPAGE_DB_FILE` / `CONTENT_UPLOAD_DIR` / `PROFILE_AVATAR_DIR` 建目录。
  - 确认运行用户对数据目录可读可写；首次启动自动完成迁移与导入。

### 1.6 首次启动验收

- **怎么做/验收**：访问 `https://bis.zju.edu.cn/zjubio/` 依次验证：
  注册收验证码邮件 → 登录 → 刷题 → 投稿 → `#admin` 管理台可用。

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
- [ ] 登录/登出：CC98 登录、邮箱登录、找回密码（校外网络实测）
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
