# 启动时重新选择同一个项目后加载已保存权限模式

## Recall

用户要求独立持续分批迭代，先用真实证据调查并把根因和影响写入规格，再实施、真实桌面和截图人工复核、聚焦正向测试、范围提交、合并上游和正常推送。上一批文件编辑器修复 `7599c11d6` 已推送，上下游 0/0，原有 177 条工作区状态保持。本批从复验时观察到的输入栏“未加载”入手。用本批所有的两个隔离项目与各自已知配置，不改现有项目权限，不运行模型。

已读[项目选择的按项目输入模式](2026-11-24-project-mode-persistence.md)、[项目入口与模式焦点](2026-11-01-ui-comprehension.md)、[当前界面架构](../../current/architecture/07-panel.md)和[实时投影架构](../../current/architecture/07-panel-reactivity.md)。全仓查 `permissions.mode_unavailable`、`currentPermissionMode`、`setPermissionMode`、`loadConfigInfo`、`beginConfigSnapshotRead`、`setConfigSnapshot`、`applyDirectory`、`loadInitialData`、`reconcileCapabilities`、`selectWorkLedgerProject`、`beginWorkspaceSelection`、`bumpWorkspaceEpoch`、`clearProjectScopeData` 与各入口及请求归属测试。

## 基线、根因和影响

- `41836/ui/` 使用 `main-CYlZS1nj.js`，专用进程 `25284`。真实公开 `GET /config` 分别返回 `branch-review` 的 `ask`、`control-review` 的 `full_access`。最先打开一页并确立 `branch-review` 为保存位置，输入栏显示 Ask me。随后两个新开的网页标签在侧栏按钮出现时立即重新选择 `branch-review`。两页浏览器日志分别于 `11:56:25.943Z` 和 `.963Z` 进入 `[applyDir] skipped (same)`，随后均一直显示 Not loaded。现有权限菜单中两个模式选项均呈禁用，项目页其余区域已经在线。[桌面基线取证](../../artifacts/2026-11-24-project-mode-read-on-reselect/README.md)
- 两页启动期间的实际 `/path`、`/vcs`、`/work-ledger` 和 `/chat/capability` 已成功。该批点击时段 `11:56:25.400Z` 到 `11:56:27.100Z` 没有配置读取。另一个没有立即重新选择项目的标签经启动读取 `258ec3af-47d5-4f75-93d3-345060cfde3f` 200，正常显示 Ask me。受影响页切换到另一个项目发出 `02b1cf7c-fb25-4ab5-a4e3-0f7d9b9d368e` 200 并显示 Full access。另一个受影响页通过 Grant and history 进入设置，点击只读 Reload permissions 后的 `a011eb51-9f6b-4af1-ab8f-0f73f9ea39d3` 200，原页返回时显示 Ask me。没有修改权限写入。
- 当前根因是已知配置为空时，点击同目录仍和“目录、已保存位置及界面投影全部准备好”的场景一起走无读的快路径。`requestWorkspaceSelection` 在 `applyDirectory` 前推进选择轮次，`selectWorkLedgerProject` 结束后推进工作区轮次。原启动链对这些状态保持正确的归属校验，旧准备在用户导航后可能退休，不能替新的选择完成读取。此路径没有继任配置读，`appStore.config` 为空。权限控件忠实地显示未加载，服务的配置读取和后续重试正确。
- 影响是同目录选择者可见的已接受配置，包括输入栏权限模式和通用设置复用的值，以及共享读者同时接受的项目频道目录。正常异目录选择、启动无打断、断线/重连和设置手动读各有当前入口。已核对启动任务列表与元数据实际读、普通项目导航、当前连接归属及只读恢复，本批没有执行任务、调度、队列或终态异常。权限公式、权限选择写入、任务提交、模型、公开路由和持久格式不改。其它独立扩展目录是否同时受启动退休影响需继续用各实际入口判断，本批不基于未测的页面扩大改动。

## 实施前方案和验收

- 在现 `applyDirectory` 的同目录分支完成原选择交接后，若当前已连接、目标确为当前项目且没有已接受配置，启动现有 `loadConfigInfo`。它复用同一配置、频道目录和预先存在的连接、目录、读取代次与选择轮次归属检查。只读完成独立发布，不等频道或其它能力完成才开放项目页面，也不用放宽启动阶段的归属撤销。保留已接受配置的正常快速路径、当前用户焦点以及既有异常诊断。没有新增读取端点、影子配置或权限默认值。
- 在服务测试通过正常同目录 `applyDirectory` 验证当前选择会发布准确 `permission_mode`、配置及频道归属，关注已退休读取无法替代后续当前选择的既有正向合同。用真实浏览器重开并立即选保存的同一个项目、切换另一项目、再返回原项目检查两个明确不同的值和对应读取；不修改测试权限。在真实截图复核输入栏与菜单，运行聚焦测试、文档检查、类型和真实界面构建后正常提交和推送。
