# 文件保存后更新已打开的 Git 工作树状态

## Recall

用户要求本人独立持续迭代，先复现和落盘根因、影响，再实现、实际桌面和截图复核、聚焦正向检查、范围提交、同步上游并正常推送。上批 `6fbc6859e` 已核对在 `origin/main`，0/0，177 项原工作区状态保留。此批只操作隔离 Git 项目的真实文件编辑器、环境栏和提交对话框。隔离配置仅用来忽略服务生成的本地文件，工具操作通过正式界面和接口。

已读[同文件保存通知](2026-11-24-open-file-live-save.md)、[分支通知到环境栏](2026-11-24-project-git-branch-peer-refresh.md)、[同范围在途读取](2026-11-25-environment-joins-pending-git-metadata.md)、[Git 动作分支确认](2026-11-24-git-action-confirmed-branch.md)与[面板架构](../../current/architecture/07-panel.md)。全仓追踪 `File.Event.Edited`、`notifyEdited`、`work-ledger.file-changed`、`subscribeWorkLedgerChanges`、`loadMeta`、`gitMetadataFresh`、`runtimePanelOpen`、`gitActionOpen`、`commitChanges`、`Vcs.info`、`nothing_to_commit`，核对原始 CRUD（创建、读取、更新、删除）写者、编辑器和 Explorer 消费者、目录和会话所有权、同项目公共事件及真实文件接口和 Git 测试。

## 实施前证据与影响

- `41964/ui/` 以 `main-BrKThypd.js` 运行两个真实桌面标签页。初始 `main` 工作树干净，一页持续打开环境栏。另一页在原编辑器中保存跟踪文件 `notes/checklist.txt`，`306dba3f-9841-4397-af95-916df7ef6764` 返回 200。磁盘正文有新增一行，Git 状态确认为 `M notes/checklist.txt`，实际 `GET /vcs` `b0a31d7e-efae-4579-ad21-dccffbc7ff7f` 返回 `dirty:true, modified:1`。原环境栏仍缺少修改计数。从原菜单打开提交框，显示“Nothing to commit.”。关闭并重开环境栏后，实际 `83e3c7ed-f4cb-40fb-ba3b-0c74d2cf8ba5` 刷新才显示 `1 modified`。
- 在该提交框手写 `Preserve this manual commit draft`。另一页真实保存恢复原文，`902119a5-4f62-450a-825a-0f7385ddcf5e` 返回 200，磁盘恢复原字节，独立 `08d1a521-b6a3-41b9-8fd0-d499956356d5` 返回 `clean:true, modified:0`。原提交按钮仍可用，实际快捷键请求 `078fab19-8511-4908-8a0b-4984f4435700` 返回 412 `VcsPrerequisiteError/nothing_to_commit`，说明原样保留。随后用真实文件路由校验两次写入和恢复，`dbaf1bc4-430a-4d9c-872f-8c46b50dfffa`、`b174791e-e59d-4b6a-9f9d-aeed931bbdcf` 各自的公开工作记录通知均包含正确目录、文件与资源身份。[截图及实际结果](../../artifacts/2026-11-25-git-working-tree-state-after-file-save/README.md)
- 根因是项目相同的已提交文件通知只让文件编辑器或 Explorer 复查磁盘。环境栏和提交框一直使用同一个旧的 `boardStore.vcs`。分支通知、人工刷新和展开面板可以重新请求真实 Git 状态，但文件保存本身不改变分支，也不会再展开正在显示的控件。提交快捷键只检查元数据新鲜度与提交说明；即使读到干净工作树，保留的说明仍能触发旧快捷键。后端的实际 `nothing_to_commit` 正确保护磁盘，用户仍经历多余失败。
- 范围为已开启的 Git 展示（环境栏和提交框）与同一活动目录的真实文件变更。保留分支确认、手写草稿、输入焦点、只读项目和其他目录的作用域，以及原错误、真实空状态、不完整工作树和接受回执。通知已具备现有精确目录语义，不增加事件、接口或持久化。此批没有发现 Task（任务）、Mission（多步任务）或 Session（会话）执行轮次的调度、队列、唤醒或终态异常。外部终端直接写文件而未进入现成文件通知的路径、本地 Git 独立锁和工作树数据管理不改。

## 实施前方案与验收

- 当环境栏或提交框可见时，以现有共享工作记录订阅接收同一活动项目的文件写入回执。以当前选择、目录、连接守住刷新作用域，使用原 `loadMeta` 重读权威 Git 状态。已有读或写进行时只保留一次必要的后续重读，关闭或换范围退休待办。保留主动刷新、分支事件、重连、项目和写后既有结算规则。界面既有写可用性和键盘提交共用当前真实工作树条件，已写说明仍由原输入持有。
- 验收按桌面实际操作完成干净 → 修改 → 干净 → 再修改，始终在另一页实际保存，观察环境栏计数、提交框空状态、原输入、快捷键与能提交的状态。额外核对多个已提交文件事件与不同项目隔离，使用真实公开通知与路由聚焦检查；已有元数据、读取所有权、Git 动作和类型/构建/文档检查覆盖共用路径。无真实 Provider 或模型请求。

## 候选验收

- `41964/ui/` 经桌面浏览器加载候选 `main-Bm1p5EU0.js`。旁观页保持展开的环境栏，另一页实际保存 `aff09c17-b4df-4a73-85ab-f591ee473f8e` 返回 200，旁观页 `4d5c7ab7-690c-4038-8f2c-f92085626374` 读取后自动显示 `1 modified`，原提交框允许输入真实说明。手写 `Keep this Git draft across file saves` 后，另一页保存恢复原文 `1c45cce3-5d8e-40b2-b2d4-ae615f062823` 返回 200，原框自动显示“Nothing to commit.”，原文与输入焦点保留。此时实际按 `Ctrl+Enter`，界面和磁盘保持已确认的干净状态。
- 独立 `control-repo` 文件保存 `012ebe7e-a924-4d66-af0a-0368cdfc3177` 返回 200，该页实际 `8c4c3419-973e-4b10-9b11-cae97f1c2282` 获取新的 `control` 状态，显示自己的 `1 modified`。主项目原提交框继续显示干净和原说明。
- 在主项目三次实际保存 `adea1d39-f456-47e5-a86d-2c043c242892`、`1bf13258-b1a8-4c4f-859f-e7579a884965` 和 `802f7815-df89-479b-b515-2e1893dba76f` 均返回 200。转发保留第一份真实 Git 响应 `1f84ed7e-533f-4815-bb7b-062e4722c815`，在此期间完成后两次保存。首份响应由客户端等待期限结束，之后只启动一组后续读取；放行 Git 请求 `ef3e3226-1798-45c0-b144-0f13d21f7cf5`，原输入和提交动作可用。真实快捷键提交 `5365bde1-8bdf-4533-92f3-0ee0ba016627` 返回 200，实际 `main` 的 `18415e00840d7267a85aa8d0ed59d33b908ab992` 含预期主题和最后保存的文件完整正文。对照文件保持其保存的字节。[人工截图](../../artifacts/2026-11-25-git-working-tree-state-after-file-save/README.md)
- 35 项覆盖层元数据、Git 动作和通知检查（95 个断言），5 项真实文件、冲突及公开通知检查（45 个断言）。覆盖层类型、构建、文档和架构检查通过。两条空白会话，消息、任务、模型请求为零。隔离标签、服务与转发正常结束。
