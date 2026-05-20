# Architecture Rules

## 依赖方向

- `src/components/` 可以依赖 `src/data/`、`src/services/`、`src/utils/`。
- `src/services/` 不依赖 Vue 组件。
- `src/data/` 存结构化配置和课程模型，不写 DOM 交互。
- `public/` 是内容源，不 import `src/`。
- `harness/` 可以读取项目源码和 public 数据，但不应成为业务运行依赖。

## 组件边界

组件负责展示和事件：

- 接收 props
- 发出事件
- 管理局部 UI 状态

组件不负责：

- 判断用户是否认证
- 生成权限策略
- 解析课程 CSV
- 保存长文本资料
- 决定资源 URL 规则

## 服务边界

服务层负责可测试规则：

- 权限判断：`src/services/authService.js`
- 收藏逻辑：`src/services/favoriteService.js`
- 课程总览字段：`src/services/courseOverviewService.js`
- CC98 前端原型验证码匹配：`src/services/cc98VerificationService.js`
- 本地账号认证覆盖状态合并：`src/services/accountStateService.js`

新增共享规则时，先放服务层并补测试。

## 数据边界

- 课程代码是课程唯一标识。
- 课程目录来自 `public/resource/summary/introduction.csv`。
- 课程详情页面共用同一框架，不为单门课复制组件。
- 用户内容放 `public/`，通过代码读取。

## Harness 机械检查

当前由这些脚本执行架构约束：

- `harness/scripts/check-architecture.mjs`
- `harness/scripts/check-content-location.mjs`
- `harness/scripts/check-routes.mjs`
- `harness/scripts/check-themes.mjs`
