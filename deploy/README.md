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
   `/etc/supervisor/conf.d/zjubio.ini`。当前 Supervisor 主配置尚无 include，需在
   `/etc/supervisor/conf.d/supervisord.conf` 末尾一次性加入：

   ```ini
   [include]
   files = /etc/supervisor/conf.d/*.ini
   ```

4. 创建 `/var/www/html/zjubio/log/` 并确保 `zjubio_run` 可写，然后执行 Supervisor
   reread/update，确认 `zjubio-node` 为 `RUNNING`。
5. 将 `deploy/apache-zjubio.conf` 安装为现有
   `/etc/apache2/sites-available/zjubio.conf`。必须先执行 `apache2ctl configtest`
   并看到 `Syntax OK`，再 graceful reload。
6. 依次验证容器内：`/api/health` 返回 200、`/zjubio/` 返回构建后的页面、
   `#admin` 可通过管理员学号登录并读取管理接口。
7. 最后从公网验证 `https://bis.zju.edu.cn/zjubio/`。若容器内全部正常但公网
   404，应由宿主机/公网网关为 `/zjubio/` 增加 path route，不要继续改容器应用。

CC98 后端接口为兼容历史账号而保留，但前端没有入口；新的管理员账号由
`ADMIN_STUDENT_IDS` 白名单和对应浙大邮箱验证码共同确认。
