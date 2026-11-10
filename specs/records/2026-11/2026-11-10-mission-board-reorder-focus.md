# 多步任务卡片重排时保留键盘焦点

## Recall

- 用户要求本人持续按批并行调查，先落盘根因、影响和方案，再实施、真实桌面交互、本人截图复核、聚焦正向功能验证、范围提交、合并上游和普通推送；不用子代理。上批 `c9cbdd902` 已推送，上游 0/0，原 177 条无关状态逐行保留。
- 已读 `MissionBoard`、`MissionDraftEditDialog`、共享 `Dialog`、`WorkLedger` 的共用刷新、`mission-board` 读投影、`main` 的编辑写入和刷新触发、`mission.editDraft`、`editMissionPendingPrompt`、会话时间戳和列表查询、实际安装的 SolidJS 卡片重排实现、[界面架构](../../current/architecture/07-panel.md)、[列表读恢复](2026-11-10-mission-board-read-recovery.md)、[卡片动作名称](2026-11-10-mission-draft-action-names.md)与[侧栏刷新焦点](2026-11-10-sidebar-item-pin-focus.md)。全仓核对 `reloadMissionBoard`、`missionSharedRefreshToken`、`mission.editDraft`、`returnFocusTarget`、`createComputed` 与保留焦点同义实现和服务契约检查；界面自动化未触及。
- 验收：真实桌面列表和列看板里，保存下方隔离草稿后依然按最近活动重排；焦点留在同卡的编辑按钮，按钮出现在实际可见区，Tab 可继续到该卡开始动作。延迟真实响应时，若先把焦点移到搜索，刷新后仍在搜索。核对中英文、持久身份、请求文本及未分发状态，不运行开始、删除、模型或凭据路径。

## 实施前证据、根因与影响

隔离基线 `39641/ui/` 经只转发真实请求的本地代理连接开发服务 `39640`，使用 `main-KD5lrZmM.js`。通过公开草稿接口创建了 `Meeting notes`、`Release checklist`、`Invoice overview`，其会话分别是 `ses_h5sEGq5WM2K6gjITLoqA`、`ses_h7mtgDfoDgxftaRoKvKV`、`ses_h1qDM3ONdoxOZq3Rhm3k`。列表原序为 Invoice、Release、Meeting。从第三卡用键盘打开编辑器、输入并保存，写入回执 `e37824e4-ea25-4ec6-838b-59d5d0128339` 为 200。代理保留真实 200 列表响应 `4243afef-3c6f-48c8-9494-5c6149a11eb0` 8.471 秒，其余请求照常。此间弹窗已关闭、焦点在 `Edit request Meeting notes`、旧卡仍在第三位。放行同一响应后，原卡和新文本出现在第一位，焦点落到网页主体。列看板用同样真实键盘动作保存第三卡 `Release checklist`，写入 `c3d0dc14-6e94-4abd-82fa-15cfe10fedf2` 和列表 `0460f6c7-0e7c-40ad-a75a-00c4d5b0c946` 均 200，焦点再次落到主体；卡片从第三移到第一，原滚动位置还把新第一卡留在可见区外。本人查看三张原图。直接核对项目、台账、草稿列表、三会话与各自消息和任务列表的十条正式 200，三条仍待规划、零任务、每会话零消息；隔离进程正常退出。

写入通过 `Session.mergeMetadataInTransaction` 修改草稿正文，表的 `Timestamps` 更新 `time_updated`，查询以该时间倒序。这解释了最新保存正常升到首位。关闭对话框已经正确用共享 `Dialog` 归还原控件；写入随后经 `missionSharedRefreshToken` 触发 `WorkLedger` 的共用看板读取。`reloadMissionBoard` 以 `sessionID` 协调保留同一对象，视图两种布局都通过同一 `<For>` 以对象身份渲染同列卡片。实际安装的 SolidJS `reconcileArrays` 对 `[Invoice, Release, Meeting]` → `[Meeting, Invoice, Release]` 用 `insertBefore` 把最后一张现存节点插到前面，浏览器会撤销被移动控件的焦点。稳定记录和保留挂载能维持身份，不能保证浏览器焦点；弹窗关闭和刷新错误修复都没有覆盖之后的重排。真实证据排除了编辑错目标、保存失败、草稿分发和刷新异常。

范围只包括多步任务共用卡片列表重排中仍挂载的原控件；显式筛选、归档或切列后已经退场的控件不重新选择。新焦点、隐藏页面、失效请求权限范围、不可操作的控件均不可重新夺焦。没有改变搜索、排序、布局、数据库结构、公开接口、当前读投影、写入或调度、队列、唤醒、恢复和终态机制。风险是捕获时机落在节点移位之后、另一个真实焦点被夺走，以及板列滚动造成焦点不可见。

## 实施方案

在现有 `visibleMissions` 响应式呈现边界，于卡片提交前记下当前卡片内的真实活动控件。使用仓库现有的 SolidJS `createComputed` 方式同步捕获，与侧栏同样在提交结束的微任务内检查：同一当前请求权限范围，同一看板区域内的原控件仍在、可见且可操作，活动元素确实已回到文档主体。满足时只聚焦同一控件，允许浏览器把移位按钮滚回视口；无定时延迟、长寿命焦点历史、按标题查找或平行卡片列表。参考 [SolidJS 同步响应式计算](https://docs.solidjs.com/reference/secondary-primitives/create-computed) 和 [W3C 键盘焦点顺序](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)。

候选用同一隔离项目在英文列表、简体中文列看板真实从下方编辑并保存，验证焦点、Tab 方向、可见按钮以及新文案顺序；另一真实列表读取扣留时手动移焦到搜索再放行。检查取消后归还原动作、真实接口身份与请求，保留已查看截图。运行聚焦草稿/台账契约与看板权限范围读取测试、前端类型和构建、文档检查；不增加界面自动化。

## 候选实证

- `39643/ui/` 经代理加载开发服务 `39642` 的 `main-BOR77o3X.js`。英文列表中，第三张 `Invoice overview` 保存后仍按最新活动移到首位，焦点是可见的 `Edit request Invoice overview`，真实 Tab 继续到 `Start Invoice overview`。写入 `4ccd1fc8-5d4d-43dc-bae0-4acae0e15d8a`、列表 `a22cd6fb-5fdc-4f33-869d-ebdf5eda3f11` 均 200。
- 简体中文列看板从第三张保存 `Meeting notes`，焦点仍在原「编辑请求」，首卡和该按钮已滚回可见区，Tab 到同卡「开始执行」。写入 `11b5b701-53a0-43af-bce3-655d93d10a63`、列表 `deb941c7-4cbb-4964-9d6e-2f087c829609` 均 200。随后打开 `Invoice overview` 核对刚写入的原文，Escape 归还对应编辑按钮。
- 简体中文列表保存第三张 `Release checklist`。写入 `adf6c3b4-94a3-4de5-b08a-4cf59c128b70` 200 后对话框先归还原编辑按钮，保持列表 `52045304-dceb-4b09-afa7-1af548b5d08a` 的真实 200 响应 9.013 秒。期间实际移焦至搜索；放行后 `Release checklist` 与新正文移到第一，搜索仍持焦。本人逐张复核七张真实基线与候选原图及裁切；[截图](../../artifacts/2026-11-10-mission-board-reorder-focus/README.md)。
- 基线结束和候选前后各十条符合公开接口契约的 200 正式读取；候选结束 `mission.list` 为 `719991aa-085a-4b3a-8093-665d73b321c8`，`workLedger.list` 为 `fd7fe9ed-38c7-4b49-a254-287c5e3dfcb0`。三条正文准确、项目及各多步任务和会话身份不变，均待规划，零子任务、各会话零消息。自有两组服务与代理均正常退出，四个监听关闭。
- 后端草稿和台账检查通过（2 项、51 断言），前端请求权限范围与看板读投影检查通过（21 项、70 断言），类型、构建、渲染公开面、文档和架构检查通过。实页只聚焦开始按钮，不分发任何任务，不使用模型或凭据；未验收安装版原生窗口。
