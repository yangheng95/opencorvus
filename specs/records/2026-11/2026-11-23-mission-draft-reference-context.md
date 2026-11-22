# 在会话上下文预览待开始草稿的引用

## Recall

用户要求本人独立持续按批迭代，先完成根因和影响分析并落盘，再实施、真实桌面双语交互和人工截图复核、聚焦正向检查、范围提交、合并上游及正常推送。第 372 批远端 `d0d1bc303`，上下游 0/0，实际工作区 177 条此前已有的状态。本轮只操作隔离服务、项目和草稿。预览验收无需真实模型、凭据或执行草稿。

已读 `main` 现有 `composerLaunchReferences` 及当前身份读与保留结果，`ChatComposer` 和 `ComposerReferenceSelector` 的唯一生产挂载、选项和本地化文案。核对公开 `pendingPromptText` 投影、`createMissionDraft`、保存请求持久化和正式派发接受该请求的来源、`conversationLaunchReferences` 的首条消息投影、共享 `visibleComposerReferences` 词法、Mission Skill（多步任务技能）目录和现有正向测试。全仓查 `launchReferences`、`referenceOrigin`、`pendingPromptText`、`chat.references.none_selected`、`conversationLaunchReferences` 和 `visibleComposerReferences`。参考 [已归档多步任务的原请求阅读](2026-11-02-archived-mission-context.md)、[已选工具栏的来源](2026-11-23-composer-selected-context.md) 与 07-panel。触及路径未发现界面自动化测试。

真实桌面验收在项目开发模式 `/ui/`。英文和简体中文选择有引用、无引用的草稿，查看来源标签、原技能名称及空状态。保存更新后需反映同一草稿中修改后的请求。用另一项目草稿和实际归档读验证当前身份及只读行为，必要时复查普通会话与新建输入。运行现有引用解析、工作记录请求的聚焦正向检查，以及类型、双语、构建、文档和架构索引。

## 修改前证据与影响

隔离真实 `40404/ui/` 提供 `main-C9siSPP-.js`。北区 `North receiving review` 正式保存 `Review the north receiving checklist with @mission("general").`，南区 `South receiving review` 正式保存无引用的原请求。普通选中读取核对各自项目、会话和 `pendingPromptText`，同一会话的公开消息读取各返回 200 和空列表。北区实际项目与会话绑定的技能目录返回 200，含 `general`。在英文和简体中文打开北区已保存请求，从工具栏打开上下文，正文原文可见，浮层却声称首条消息没有显式技能或专家团引用。切到南区，空结果按同一首条消息解释。 [真实截图和接口回执](../../artifacts/2026-11-23-mission-draft-reference-context/README.md)

根因是当前工作记录的草稿正文只驱动会话正文显示。`composerLaunchReferences` 对已选会话只读会话板的 `composerReferences`，后者由服务器按第一条真实用户消息解析。草稿请求在派发前只作为 `pendingPrompt` 持久化，首条消息确实还不存在。`ChatComposer` 对非独立 Task（任务）一律选择首条消息文案，导致菜单对已有有效引用给出空结果，也让无引用的草稿显示错误来源。此前实现正确覆盖已发送会话的首条消息与独立任务的原始请求。已有草稿正文和归档预览的实现没有改变这个独立浮层的投影。

影响限当前携带保存请求的 Mission（多步任务）在只读会话上下文内的来源、显式引用和空态。当前项目和选择身份、原请求文字、词法识别、默认和已冻结的专家团分配、普通会话的首条消息、独立任务原请求、目录权限、执行和持久数据属于现有合同。本轮没有实际派发，因此没有观察到 Task、Mission 或 Session（会话）执行轮次的调度、队列、唤醒、恢复、并发或终态异常。界面能确认原文中的显式引用。其执行适用性由当前派发合同决定。

## 方案

把已选工具栏引用的来源及内容按一个投影传给现有选择浮层。当前精确或同身份可保留的 Mission 工作记录有已存请求时，使用同一个规范 `pendingPromptText` 调用 `visibleComposerReferences`，来源文案指向已保存草稿。该条件随当前记录变化，无草稿请求的会话继续投影实际首条消息。独立任务已接受记录仍提供其原始请求来源和现有冻结包显示。浮层使用各自来源的已本地化提示、显式引用标题和真实空态，技术标识及用户文字保持原样。沿用有目录匹配时的真实名称和无目录项时的原标识。无新读取、持久字段、执行或消息修改。更新 07-panel 的已选引用阅读合同。

只读标题内旧的可编辑提示由同一个 `Show` 条件排除，`chat.references.selection_hint` 全仓仅被该不可达分支引用。同步移除该提示键与分支。新建对象的实际指导文案由可编辑浮层显示。

## 实施与验收

真实候选 `40406/ui/` 加载 `main-PwFUbjDs.js`。英文北区浮层显示 `general`，标明引用来自已保存请求。切到南区后，浮层明确说明该已保存请求没有显式引用。简体中文复查同一北区草稿显示 `general`、本地化技能说明和已保存请求来源。实际在多步任务页面编辑南区原请求，加上 `@mission("general")` 后保存。从「草稿已保存」回执打开同一南区会话，浮层显示新增 `general`。再从会话操作归档，从正式归档列表打开仍显示新原文与同一只读引用。另在新建工作打开可编辑模式、引用与指导文案。本人复核三张基线和八张候选原图。 [截图、实际目录和读取回执](../../artifacts/2026-11-23-mission-draft-reference-context/README.md)

保存和归档后按精确会话、任务、目录和标题查到南区的实际新正文及归档状态。北区原请求和身份经回执核对。两份消息历史返回 200 与空列表。两套隔离数据库各两条会话，消息、执行任务和模型活动均为零。服务关闭返回 200，进程退出 0，端口已释放。`visible-composer-references.test.ts` 与 `work-ledger-mission-request.test.ts` 通过 9 项、46 个断言。类型、双语（3240 个键）、正常构建、渲染公开面、文档和架构索引通过。普通已发送对话与独立任务的引用路径按现有代码及词法合同核对。此次没有发送消息或派发任务。
