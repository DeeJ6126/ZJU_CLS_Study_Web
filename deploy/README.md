# zjubio 容器部署文件

这里的模板与 2026-09-08 通过 `tekg_ssh_v2` 读取到的真实容器结构对应：

- 项目：`/var/www/html/zjubio/`
- Apache vhost：`/etc/apache2/sites-available/zjubio.conf`
- Supervisor 主配置：`/etc/supervisor/conf.d/supervisord.conf`
- 独立 Node.js 22：`/opt/zjubio/node/bin/node`
- 后端仅监听：`127.0.0.1:5175`

## 部署顺序

1. 在项目目录安装锁定依赖并运行 `npm run build`，确认 `dist/index.html` 存在。
2. 从 `.env.example` 创建 `/etc/zjubio/zjubio.env`，至少填写
   `ADMIN_STUDENT_IDS`、`SMTP_USER`、`SMTP_PASSWORD`；权限设为仅服务管理员和
   `zjubio_run` 用户可读。不要把真实密钥提交到 Git。
3. 将 `deploy/supervisor-zjubio.ini` 安装为
   `/etc/supervisor/conf.d/zjubio.ini`。Supervisor 主配置必须包含：

   ```ini
   [include]
   files = /etc/supervisor/conf.d/*.ini
   ```

   Supervisor 直接运行独立 Node.js 22，并通过 Node 的
   `--env-file=/etc/zjubio/zjubio.env` 读取密钥，不经 shell 启动器。模板同时托管
   `zjubio-node` 和 `zjubio-backup`；两者日志均有大小与历史文件上限。

4. 创建 `/var/www/html/zjubio/log/` 并确保 `zjubio_run` 可写，再创建
   `/data/zjubio/backups/` 并确保同一用户可写。执行 Supervisor reread/update，确认
   `zjubio-node` 与 `zjubio-backup` 都为 `RUNNING`。备份进程默认每天 03:20 生成
   SQLite 一致性快照和上传/头像目录副本，并保留 14 天；可通过
   `ZJUBIO_BACKUP_HOUR`、`ZJUBIO_BACKUP_MINUTE`、
   `ZJUBIO_BACKUP_RETENTION_DAYS` 调整。
5. 将 `deploy/apache-zjubio.conf` 安装为现有
   `/etc/apache2/sites-available/zjubio.conf`。必须先执行 `apache2ctl configtest`
   并看到 `Syntax OK`，再 graceful reload。
6. 依次验证容器内：`/api/health` 返回 200、`/zjubio/` 返回构建后的页面、
   `#admin` 可通过管理员学号登录并读取管理接口。
7. 最后从公网验证 `https://bis.zju.edu.cn/zjubio/`。若容器内全部正常但公网
   404，应由宿主机/公网网关为 `/zjubio/` 增加 path route，不要继续改容器应用。

CC98 后端接口为兼容历史账号而保留，但前端没有入口；新的管理员账号由
`ADMIN_STUDENT_IDS` 白名单和对应浙大邮箱验证码共同确认。

## 当前上线边界（2026-09-15）

容器内 Node、Supervisor、Apache `/api/` 反代、SMTP 发信和首份数据库快照均已
验证。公网网关仍需把根路径 `/api/` 转发到与 `/zjubio/` 相同的容器并保留原始
路径；网关还应覆盖客户端传入的 `X-Forwarded-For`，写入真实客户端地址，并设置
`X-Forwarded-Proto: https`。完成后再从校外网络执行 `docs/deployment-checklist.md`
中的发布当天检查。
