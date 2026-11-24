# 启用文件监视的工作区在重开已有会话后恢复 Git 实时状态

## Recall

- 用户要求本人持续独立调查实际使用流程，先记录根因、影响和实施方案，随后真实桌面、截图和聚焦正向检查，范围提交、上游合并、正常推送。上一批 `02be161b0` 已核对远端，0/0，177 条工作区状态保留。本批只使用拥有的 `git-reopen-review`、已保存的空白会话及实际重启的隔离进程。该服务打开已有文件监视选项，原配置文件 `.gitignore` 在建立真实项目后设为只读，作为被动读取的对照。
- 已读[原生文件更新 Git](2026-11-25-git-refreshes-after-watched-worktree-edits.md)、[原生分支通知](2026-11-24-project-git-branch-peer-refresh.md)、[被动项目目录隔离](2026-11-24-passive-expert-catalog-project-bootstrap.md)、[项目目录实例归属](../../current/architecture/task-runtime-directory.md)、[工作记录实时投影](../../current/architecture/07-panel-reactivity.md)。全仓搜索 `projectRouteContextKind`、`GET /vcs`、`Vcs.info`、`Vcs.init`、`FileWatcher.init`、`persistentCallbackRunner`、`InstanceLifecycleContext.reenter`、`tryProvideActive`、`InstanceBootstrap`、上一批已实现的原生文件事件和分支消费者。已核对监听失败和清理、原路由的只读权限、现有回调和冷工作区路由测试。

## 可观察事实、根因和影响

- 隔离实例 27652 使用真实创建路由保存原会话 `ses_hmukY0F4XnovIMV5snyW` 后正常关停。第二代进程 18408 从同一隔离库重新打开此会话，`41790/ui/` 提供 `main-EXy72qO_.js`。原项目 `prj_hg1OSrLKAzRXwQsHWrZ8`、会话、Git HEAD 和 `.gitignore` 原字节及只读属性留存。真实环境栏和公开 `/vcs` 成功读取干净 `main`。
- 两个公开观察流返回 200。PowerShell 给跟踪文件新增一行，随后在该一次性仓库通过真实 Git 切到同提交 `branch-observer`。直接 `/vcs` `90f75390-65a6-43f2-a18f-a36518ec07d2` 回读新分支与 `modified:1`，UI（User Interface，用户界面）仍显示原 `main`，没有原生文件事件或 Git 刷新通知。此次进程的实际日志未启动 `file-watcher.init`。手动刷新 `7398bb4c-f3e9-465a-95a7-df8263a591d3` 才显示两项真值。[真实截图与端点记录](../../artifacts/2026-11-25-git-watch-starts-on-reopened-workspace/README.md)
- `GET /vcs` 和重开已存聊天、多步任务或任务的被动读取故意使用项目身份权限。可读会话和 Git 元数据并不要求执行权限。`FileWatcher.init` 和原 VCS（Version Control System，版本控制系统）分支观察者分别在完整项目运行准备中启动，而现行被动读只调用 `Vcs.info`。同时 `persistentCallbackRunner` 使用默认运行权限重新进入缓存，未完整启动的身份所有者也不能处理已接纳的文件回调。因此需要使可选的文件与分支观察能力使用现有项目身份归属，不能只从被动读启动一个随后无法投递的监视器，也不能把这些读取换成会执行项目写入、插件、供应商和任务准备的完整启动。上一批已修复监视器已运行时的投影，本批现象发生在任何源事件之前。
- `FileWatcher` 和 `Vcs` 目前各有同项目的单一实例状态和关闭路径。现阶段异常属于宿主文件状态的被动观察，未观察到 Task（任务）、Mission（多步任务）、Session（会话）执行、调度、唤醒、并发或终态不收敛。生产能力范围为开启可选文件监视且存在 Git 工作树的规范状态读取，保存已有项目、分支、会话、文件和原 `GET /vcs` 响应。默认选项、执行所有权、控制平面初始化及项目配置和 Git 写权限沿原契约。

## 实施与验收

- 在已启用的 Git 状态读取路径中加入现有 VCS 分支观察和原生文件监视的初始化，同一项目状态复用完整运行初始化所用的所有者。按现有全局监视禁用标志和工作树选项执行。原生通知使用已成立的项目身份重新进入与原关闭边界，从持久化事实读取的 Git 状态不被监视错误取代。监视诊断用现有日志和错误事实，部署无需额外路由、携带凭据、独立缓存、手动引导或启动任务执行。
- 聚焦验证真实调用线程在只完成项目身份发现时发布原文件事件并保持项目与回调生命周期；已有被动 Git 项目、分支观察及工作记录匹配检查继续通过。候选真实重启后重开同一保存会话，保持只读 `.gitignore`，外部保存原文件和切换到同提交的另一个现有分支，保持环境栏一直打开并验证两项自动更新。通过实际源事件、公开目录投影、读取回执、本地 Git 和两份实际截图证明结果。检查没有完整项目初始化或模型请求，原会话身份与 `.gitignore` 精确字节、只读属性仍一致。运行类型、构建或原合适的开发资源确认、文档与架构检查后再送交。
