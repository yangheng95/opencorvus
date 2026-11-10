# 停止消息卡区分本地化说明和原始诊断

## Recall

用户要求持续分批迭代，独立完成、不使用子 agent。先调查根因及影响并落盘，后做改动、真实桌面交互和截图复核、聚焦验证、范围提交与上游普通推送。B163 `1bf743ee0` 已推送、上游 0/0，原 177 项未改。已读根 AGENTS、[B163 停止范围](2026-11-10-composer-stop-scope.md)、[B160 接受状态](2026-11-10-composer-delivery-uncertain-feedback.md)、[工作台](../../current/architecture/07-panel.md)和 [reactivity](../../current/architecture/07-panel-reactivity.md) 的消息终态/详情合同。全仓搜索 `AssistantMessageFailure`、`CardErrorReasonIndicator`、`MessageAbortedError`、`assistantMessageFailure`、`ExecutionCancellationOrigin`、`messageFailures`、`errorReason/errorDetails`、主会话/参与者/Side chat 及导出、搜索和复制的实际消费；已读生命周期终态 `projectSessionStatus`、消息投影 `assistantMessageSettlement`、Side chat `Feedback` 和现翻译键。无委托、外部凭据或真实 Provider 模型调用；复用隔离数据库中的真实交互记录，必要的新运行使用本机流式夹具。

## 现象、根因和影响

在 B163 真实中文工作台停止 Mission 后，卡片标题“已停止”，正文立即显示宿主英文 `Operator stopped the active Mission from the composer`，旁边仍有“详细信息”。英文 Task 停止卡默认出现宿主 activation、Task 和取消事件标识的长句。两处截图和真正 `MessageAbortedError`、Task 取消与 Mission close 证据已保存；Chat/Work 的原始诊断为 `session aborted`。见[实际基线](../../artifacts/2026-11-10-composer-stop-scope/README.md)。同一原始内容应可用于诊断、搜索与导出，但普通正文应先说明可读取详情，不能让中文界面直接用宿主错误当说明。

真实数据流：后端保留类型化取消与真实请求的 provenance；`assistantMessageFailure` 抽取原 reason 并把原取消 envelope 作为详情，实时消息、冷读和参与者历史都保留这些字段；`AssistantMessageFailure` 对一般错误已经使用本地化提示、原始原因放入诊断，而 cancelled 分支直接把 `props.reason` 渲染成正文。取消时详情开关当前仅在 `details` 有值时显示；仅有原 reason 的卡若移除正文会丢证据。共享复制控件即使已经标注“复制停止详情”，cancelled Tooltip 仍把原宿主文本展示在按 Tab 的提示里。应调整展示层的默认读法，并保留明确打开详情或复制后的所有原始字节信息。不要通过英文字符串、ID 或 actor 猜测特定原因，类型化 cancelled 分类和结果归属已正确。Side chat 顶部的独立 transient Feedback 已本地化主句并附自己的详情；其中真正的历史消息同样走 `ConversationCard`/`AssistantMessageFailure`。

影响为主消息、合并卡片的每条实际 Message、参与者/Side chat 历史、键盘、屏幕阅读器、英中文本和复制提示。保留现中性停止语义及 `role=status`；已生成的模型原文不变。持久 Message、transport、原始数据、搜索索引、Markdown/JSON 导出、Tool 错误、一般 Assistant 错误、日志和系统诊断不变。不触及任务取消、队列、重试、唤醒、权限、数据库、SDK 或发布；真实 B163 跨 Work/Task、Chat 和 Mission 的正向执行证明停止的原域已经正确。未证实新的共享调度异常。

## 实施与验收

1. `AssistantMessageFailure` 在 cancelled 的默认正文使用当前界面的通用短说明，把真实原因和附加诊断合为现 Details（详情）中仍可读的原始内容；只有原 reason 时也可展开。其它失败保留现 heading/提示/详情合同。取消的 Copy 按钮提示只说明可复制原诊断，继续复制完整原 reason 和 details，非取消的 tooltip 保留实际错误预览。复用现 Disclosure/Tooltip、消息边界与 i18n（internationalization，界面国际化）机制。
2. 实际开发页以已停止的 Mission、Task、独立 Chat/Work 历史做 cold hydration（冷读恢复），对比中文和英文正常/展开/复制的真实页面、按键和图片。至少复核一个真实新 Side chat 或主会话停止进入同一展示路径、一般失败对照和原文/消息归属；可用原 B162 真实失败数据做对照。按条件通过真实复制读取原取消字段，避免用截图文字或静态源码代替持久事实。纯界面改动不增加或运行 UI 自动化测试，完成工作台类型、构建、语言及文档/架构检查。

第一次候选桌面复核确认正文、原文和实际复制正确；停止 Copy 的 Tooltip 仍继承为一般错误诊断预留的宽度和红色标题，和中性停止卡不一致。最终停止 Copy 直接复用无额外错误样式的共享 Tooltip，只显示实际复制动作/反馈；一般错误仍保留现宽度、标题、原始预览。以重新构建后的真实截图确认。

## 实际验收

- SQLite 原 B163 隔离数据库备份到新 profile，Task、Mission、Chat 和 Work 四个历史 Assistant Message 及各自 Parts 与来源逐行一致。真实开发页中，英文 Work 及中文 Mission、Task、Chat 的停止卡默认显示本地化说明和详情入口；原用户文字、模型已输出内容、实际 Message 归属未改。Task 展开显示实际 activation 和取消事件；Mission 展开显示 `MessageAbortedError` 与 `mission.abort` 原因数据。
- 在该 Work 会话发送真实新输入，观察实际本机流开始和已有文本，然后从主输入区停止。记录 `msg_g0VaWaGRU005XNtQg1ln` 保留文本 `Isolated B163 streaming response.`、精确 `session.abort` 和 User 父消息；停止卡即时显示英文提示，在最终构建重启后可按同一原身份冷读。只测实际协议与交互，没有外部模型质量声明。
- 最终 `main-C3FmnzaH.js` 两个隔离实例实际提供该构建；Mission 折叠状态用键盘聚焦时显示紧凑中性 Copy 提示。真实指针激活获得已复制反馈，实际剪贴板原 reason 和完整 JSON（JavaScript Object Notation，对象数据格式）逐字段等于旧持久记录。第二实例用原 B162 真实普通失败作对照，保留未完成响应的原解释、错误详情和原消息。9 张实际 1280×720 截图已人工复核。详见[证据](../../artifacts/2026-11-10-stopped-message-diagnostic-disclosure/README.md)。
- 最终工作台类型、构建、renderer public surface、两种语言、文档和架构检查通过；未运行界面自动化测试。只操作自有隔离页面、开发服务和本机流。
