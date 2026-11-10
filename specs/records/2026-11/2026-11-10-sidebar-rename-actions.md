# 从侧栏改名后继续当前会话

## Recall

- 用户要求本人独立按批次持续调查、先写规格后实施、本人操作真实桌面并复核截图，验证后范围提交、合并上游并正常推送，明确叫停前继续；不用子代理。第 216 批 `fdfa4e3fb` 已推送，分支与上游为 0/0，原有 177 条工作区状态逐行一致。
- 已读 `WorkLedgerRowView`、项目/最近/任务子行复用、`useTaskRowActionsKeyboard`、主界面三种 `renameWorkLedger*`、`App` 已选会话头部、`AppDialogHost`/`Dialog` 的焦点生命周期、当前 `07-panel`、[文件改名焦点](2026-11-08-file-rename-focus.md)、[侧栏展开](2026-11-10-sidebar-project-expand-keyboard.md)和[同名会话](2026-11-10-sidebar-duplicate-conversation-labels.md)。全仓查 `onRenameChat/Mission/Task`、`renameActiveWorkLedgerItem`、`rename_*` 文案、`returnFocusTarget`、Mission 草稿和 Task 创建路由、相关工作记录和会话检查。未触及界面自动化检查，不新增或运行。
- 验收：使用键盘在仍读观察会话时，从项目/最近的另一个会话或未提交的多步任务打开改名，焦点进入原输入，取消/保存后归还到发起的同一个侧栏行；实际记录标题、身份、草稿和当前路由可核验。复核英语和中文，保留原双击及已选会话菜单。

## 修改前证据、根因与影响

隔离开发服务 `39626/ui/` 创建两个空 Chat（会话）及一个 backlog Mission（多步任务）草稿。`Rename observer` 为 `ses_hM7rsyKpeVLlNvnAEJ9S`，`Rename target` 为 `ses_h8GN8cvsl9tsf2HxK50J`。正式 `mission.createDraft` 返回 200 `ba1a80e2-2be0-406e-a994-f062828eef99`，`draft-53574c0273f1fe6777d0022facdff472`、`ses_hMJ5eSHj05WsAttYBsBX`，草稿文本为 `Isolated unsubmitted mission request.`。入口契约明确草稿在操作员分发前不会调用模型。

本人用方向右键、回车打开未选中 `Rename target` 的项目行菜单，当前仍为 `Rename observer`，只有停止后台活动、置顶和归档。双击目标确实打开已有改名输入，但主区和路由先切至 `ses_h8GN8cvsl9tsf2HxK50J`；退出没有改动标题。当前目标的头部菜单已有改名，但只能在它成为当前会话后使用。对未选中 Mission 草稿的真实侧栏菜单也只有下载、置顶和归档，当前仍为 `Rename observer`。四张基线原图由本人复核。

直接触发点是 `WorkLedgerRowView` 的主按钮仅在 `onDblClick` 分发已有改名，键盘只进入 `DropdownMenu`；菜单未挂上该操作。普通点击先向主路由选择该行，所以旧双击无法保留另一段当前会话。另一个已选标题的头部菜单只绑定已选记录，无法作用于未选中目标。现有 `renameWorkLedgerChat` 和 `renameWorkLedgerMission` 已绑定真实记录、权威和写入接口，缺的是可发现入口和菜单被卸载后的焦点所有者。历史的菜单键盘接续与同名标题投影都没有增加这个入口。

范围为侧栏 `chat` 和 `mission` 行，包括项目、最近、单列表和置顶等复用处。Task（任务）行及 Mission 内 Task 子行虽共享渲染，现有创建请求无不执行选项并进入正常执行路径，未获得可用于本批的真实独立 Task 样本；不改变其菜单、双击或持久写入，记录为后续调查边界。没有观察到 Task/Mission/Session（会话）执行轮次的调度、队列、唤醒、恢复或终态异常。公开接口、数据格式、权限、路由选择、排序、标题本体、文件、原生窗口、发布与版本均不演进。风险是菜单卸载导致焦点回到页面、同一行的最近副本被误聚焦、过期连接用旧目标打开弹窗，以及修改键盘菜单误触行选择。

## 实施与验收（修改前）

复用 `DropdownMenu.Item`、已有图标及中英文改名标签，在置顶和归档之间放置操作。现有双击和新动作从同一个行函数分发，新菜单无需选择行。Chat/Mission 复用现有同一确认、写入和刷新链，通过已有弹窗参数传入连接和真实行身份的打开保护及本行主按钮的动态归还目标；不把菜单的临时项当作焦点所有者。现有 `Dialog` 负责处理按钮是否可见、仍连接和用户是否已主动移走焦点。原头部仍调用现有写入函数，原 Task 分发不变。若实页焦点有问题，先记录发生阶段并更新本方案再修正，不加等待或全局恢复。

以同一个关闭后复用的隔离数据目录、候选开发端口，从项目 Chat 行键盘实际保存、最近副本取消并核对焦点归还，另用中文实际改名 Mission 草稿且不执行。用真实公开接口读取两条会话、草稿、工作记录、消息和任务列表核对 ID（身份标识）、标题、当前路由、草稿内容和空执行；用聚焦工作记录与草稿的正向服务检查、类型、本地化、构建、文档和架构索引补充。没有使用模型或凭据的必要。

## 候选验收

候选 `39627/ui/` 实际服务提供 `main-BkJT1LQp.js`。从英文项目行按右方向、回车、下方向到改名，输入已选中的原名。真实保存 `Rename target checked` 后，项目及最近更新，实际焦点回到项目行；再从最近副本输入临时标题并用 Escape 取消，焦点回到最近行，标题仍是已保存值。两次的主区路由均是 `ses_hM7rsyKpeVLlNvnAEJ9S`。切中文后从「重命名多步任务」保存 `侧栏命名草稿`，两处更新且焦点回项目草稿行，同一主区路由仍在。另复查中文 Chat 行菜单、原双击打开实际目标、头部菜单打开原对话框；后两个原入口均取消并各自归还焦点。[十张归档画面](../../artifacts/2026-11-10-sidebar-rename-actions/README.md)源自本人逐张查看的四张基线、九张候选原图；菜单未压住目标表头，输入框、主要按钮与焦点均可辨认。

候选改名前、改名后各做九次真实只读请求，并用实际服务声明的响应结构检查。`workLedger.list` 200 由 `1e03fe0c-83cf-4740-8f6b-ccbfe0909a4f` 到 `7ebf74b1-ad0e-4239-ac08-d026b0917a4a`，两条会话与草稿的真实标识、所属项目、创建时间不变；目标和草稿的真实新标题与侧栏一致。改名后 `mission.list` 200 `bf980388-2b93-4191-8821-019b56c7d24d` 同一草稿仍保留原待提交文本，三个 `session.messages` 皆为 0 条，`task.list` 200 `51e30377-c832-45b2-a416-b460370ac463` 有 0 个任务。两个自有服务均通过自己的启动回执核对后正常关闭，无运行中的验收监听器。

`bun test test/work-ledger-search.test.ts test/work-ledger-mission-request.test.ts test/server/mission-draft-edit.test.ts`（在 `packages/opencorvus`）9 项、97 个断言通过。Overlay 类型、本地化（2 种语言、3122 键）、样式令牌、构建和渲染器公开面通过；仓库 `docs:check`（353 操作、26 组）与 `check:architecture-index`（20 篇）通过。验收范围是开发模式桌面网页的 Chat 和未提交 Mission，不包括单独 Task 或已安装原生窗口，无 GPT‑6.1 Sol 请求。
