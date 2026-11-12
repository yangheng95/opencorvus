# 定时任务绑定会话的可见身份

## Recall

- 用户要求持续迭代，按批分析和落盘，独立实施、真实桌面操作和本人复核、聚焦正向检查、上游同步及普通推送。本批目标是在定时列表、搜索、详情和删除确认核对真实会话目标。两个隔离项目各有一个空会话和一条 2099 年计划。
- 已读 `AGENTS.md`、`07-panel.md` 和 `02-data.md` 定时契约、[定时草稿与绑定会话](2026-11-10-scheduled-authoring-draft-navigation.md)、[项目目标辨认](2026-11-12-scheduled-project-target-identity.md)、[删除回执](2026-11-12-automation-delete-receipt.md)。全仓核对 `AutomationTarget/AutomationView`、`targetForRevision`、`executionTargets`、`AutomationService.list/update`、`Session.get/readLiveInTransaction`、`workLedgerSessionExecution`、定时列表/详情/表单/确认及生成的软件开发工具包（SDK）。

## 根因与影响

1. 真实 `39818/ui` 连接 `39817`，使用 `main-3gz_0idi.js` 和 WebSocket 101。两个同名计划均显示 `Conversation`，详情和删除确认没有绑定会话。实际打开第一条编辑，工作列表恰好已加载该会话，显示原标题和标识。按第二会话的真实标题搜索，没有结果。确认和编辑均取消。[真实桌面和运行接口证据](../../artifacts/2026-11-12-scheduled-conversation-target-identity/README.md)
2. 正式列表 `96e4b719-852b-44ea-a46e-9ec5e2d0afbb` 包含各自不可变定时版本的 `target.sessionId`，正式会话读 `64f310ee-7697-461d-b6e2-4896ff976f13` 和 `d57ed6bf-bec7-4ede-9d66-7b6a5eb5b283` 有原标题、实际不同项目路径和标识。列表和详情只消费通用范围，确认只有任务标题。编辑标题来自工作列表当前加载的投影，该分页和可见性由另一屏负责，不能确认所有计划绑定的会话。正式定时读模型有准确版本身份，缺少对绑定会话的活跃读取投影。
3. `Session.get` 已使用 `Session.readLiveInTransaction`，其结果排除删除中的会话。定时执行按原目标调用同一 Session（会话）事实，缺失时由现有 `target_deleted` 结算。两条基线各一个未来 Fire（计划触发记录），零运行、零尝试，未见调度、重试、唤醒、轮次或终态异常。本批是投影和用户辨认，读取缺失时保留原绑定标识和现有调度行为。
4. 影响是公开列表和更新回执的显示投影、SDK、双语接口参考及界面。使用已有 Session 数据，不新增持久格式或迁移，不修改执行、取消或归档路径。Tool（工具）写入与既有不可变定义回执保持原契约。

## 实施与验收

- 在现有公开 `AutomationView` 增加可空的绑定会话投影 `targetSession`，包含原标识、实时标题和路径。用定时版本的真实目标和同一读取上下文调用 `Session.readLiveInTransaction`；确切缺失返回空，其他错误保留。列表及更新状态回执使用同一投影，保留不可变 `target` 和调度行为。非会话范围无绑定会话。生成当前接口文档及 SDK。
- 列表显示真实会话标题，目标标题冲突时保留确切标识。搜索标题、路径和标识。详情及删除确认呈现原标题、标识及真实路径；缺失时呈现明确状态和原绑定标识。现有编辑使用其打开定义的会话投影，新建草稿继续使用明确打开会话的当前标题。所有产品文案接入中英文。
- 用真实中英文桌面核对两条同名任务、搜索、详情、原项目和取消删除。真实会话改名和计划重新读取展示新标题但保留原绑定版本。聚焦正式路由测试涵盖不同项目、目标更换、名称更新、缺失目标，以及原版本与历史。实际隔离证据核对零运行和模型活动，并重跑构建、类型、双语、生成接口和文档检查。
