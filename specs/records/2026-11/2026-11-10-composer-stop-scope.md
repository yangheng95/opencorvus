# 主输入区说明当前停止操作的范围

## Recall

用户要求持续按批迭代，由本人独立工作，先记录证据、根因与影响，再修改、真实桌面交互和截图复核、聚焦验证、范围提交、同步和普通推送。上批 `8bc791bbc` 已推送、上游 0/0、原 177 项保留。已读根 AGENTS、[活动 Task 模型](2026-11-10-task-operator-model-and-active-turn.md)、[提交状态](2026-11-10-composer-delivery-uncertain-feedback.md)、[工作台活动与终态](../../current/architecture/07-panel.md)和 Task 控制面相关契约。全仓搜索 `ChatComposer` 的唯一实例、`chat.stop_label`/`chat.stop_title` 两个按钮、`isTaskInterruptable`、`workLedgerSessionInterruptible`、`stopChatRequest`、`cancelTask`、`abortMission`、`stopConversationSession`，以及具体 Task/Mission/Session 写入、导航投影和既有 Tooltip primitive。无委托或外部模型凭据；隔离流只证明停止路由与用户体验。

## 现象、根因和影响

真实工作台 39407 中，Task `tsk_g00VaWVoEo00B6ZAtGRY` 与独立 Work Session `ses_hrEt1IibLwYopI19D78C` 同时通过本机模型流输出。Task 与独立 Work 的主输入区 Stop 都使用相同无障碍名 `Stop` 与提示 `Stop generation and halt task execution.`。在 Work 点击，只有 Work 的真实流 4 关闭；持久 Assistant `msg_g0VaWVuJV00Y32gLlcLR` 记录 `MessageAbortedError`、`source=session.abort` 及自身 `targetSessionID`。用户原文和流式部分仍可见，Work 回到 Idle，Task 仍为原 epoch 1 的 active。截图见[证据](../../artifacts/2026-11-10-composer-stop-scope/README.md)。这证实 Work 停止提示描述了不同的对象。组件源码表明 Chat 和 Mission 共用同一提示，旧主按钮和有草稿时并排的 Stop 也重复使用同一 copy，键盘只有通用 Stop 的无障碍名。

根因是主输入只接收 `busy` 布尔值，展示层丢失了已有 `messageStore.chatRequest.target` 或当前 Task/Mission/Session 的停止对象。主工作台又在 `onStop` 分别重新判定领域，文字无从跟随实际分支。复用一个全局名、或用 UI（用户界面）的 `Running`/`Idle` 猜测停止范围都不足：真实 Work Ledger 把活动 Session 和 Task 生命周期分开，打开且暂时空闲的 Task 仍可取消当前轮次。B162 看到的 `Idle` 与 Stop 并存因此是合法状态。局部跟进后的本地请求可以被导航清理；各正常导航入口会同步清理本地请求观察并切换选区，未证实跨选区执行错误。此次只更改 Stop 的表示及表示/执行的共同目标投影，不改变导航或取消权限。

影响覆盖主输入的单 Stop、有草稿时 Stop + Send、键盘/屏幕阅读器、英中文本、原有请求优先权和四类工作入口。Task 沿现公开取消；Mission 沿现关闭；独立 Chat/Work 沿 Session abort。现已接受的 Message、Task/Mission/Session 状态、选择和提交语义不改。侧栏的确认规则、Side chat（侧边对话）、其它停止入口、持久数据、接口、SDK（软件开发工具包）和发布不适用。没有发现需要改变队列、租约、终态或恢复的共同调度问题；有独立进行的 Work 和 Task 的运行、原归属与持久取消证明。若候选发现错误停止其它选区或真实活动清理异常，先做共享执行边界审计再扩大范围。

## 实施与验收

1. 主工作台从现请求、Task 及 Work Ledger Session 行求出同一停止动作描述（领域和实际现有操作），按原优先级作为主输入可停止状态和点击操作的共同来源。保留停止中的单次保护、原有异常处理和选区，不新增公共字段或取消路径。四种名称收敛为 Task、Mission、独立会话三种实际影响；不从标签或用户文案推导权限。
2. 主输入的两个 Stop 位置共享领域本地化名称及简短影响说明。优先复用现 Tooltip（提示气泡）组件，使键盘焦点和指针可读取同一提示；保留按钮尺寸、草稿 Send 的原相邻操作、表单语义和键盘焦点。移除无用的旧一体化提示，不另建文本来源。中文和英文的范围表述一致。
3. 真实开发页在 Chat/Work、Task 和可构造的 Mission 状态下交互，核对空草稿和有草稿的按钮/焦点、实际停止后同一作用域收敛、原输入保留、另一活动对象继续。复核英中桌面截图和可访问名称，结合本机流的实际关闭和持久事件说明证据。纯界面改动不新增或运行界面自动化测试；用工作台类型、构建、语言与文档检查辅助交付。真实 GPT-6.1 Sol 的语义表现不影响该停止动作分支。

## 实际验收

- 真实候选开发服务 39409 提供 `main-D5yUyp3i.js`。英文 Work 开始实际流后，Tab 聚焦空草稿的停止按钮并看到专用名称、解释；输入未发送草稿后，同样解释出现在并列 Stop，Send 保持原状态。键盘回车停止精确 Work Session，真实流关闭，消息和草稿保留，Send 恢复，同时独立 Task 仍持续运行。切入该 Task，其停止名称和提示说明取消轮次；回车使同一 epoch 1 从 active 收敛到 `cancelled`，持久原因和流关闭匹配。
- 从真实外观设置切换简体中文；独立 Chat 显示“停止对话活动”，多步任务显示“停止多步任务”，键盘焦点显示各自中文说明。实际回车分别结束对应响应，Chat 的真实取消来源为 `session.abort`，Mission 的来源是 `mission.abort` 并形成真正的 `mission.execution.closed` 和后续 `inactive`。原用户消息及已有部分流式内容仍可见。图片和运行数据见[证据](../../artifacts/2026-11-10-composer-stop-scope/README.md)。
- 工作台类型、构建、renderer public surface、双语键、文档与架构检查通过。没有 UI 自动化；四类正向功能通过实际页面、网络流与持久事实核对。基线与候选均只操作自有隔离页面和进程。另有可独立调查的问题：中文的停止卡片下方仍直接呈现宿主英文诊断，Task 同位置也呈现 activation 和取消事件 ID；它是结果卡片的解释问题，本批控制说明没有把它算作已解决。
