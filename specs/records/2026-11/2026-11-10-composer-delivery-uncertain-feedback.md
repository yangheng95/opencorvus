# 主输入区区分消息接收未确认与发送前失败

## Recall

用户要求持续分批迭代，最新明确由本人独立工作，不使用子 agent。每批先做根因与影响并落盘，再实施、桌面真实操作、本人截图复核、按范围提交、拉取合并并普通推送。B159 提交为 `068e64fd4`，已发起普通 push 并等待钩子与远端确认；B160 开始时本地有原 177 项无关 Git 状态。已读根 AGENTS、B159 [接受事实与模型目录](2026-11-10-mission-accepted-wake-catalog-replay.md)、[主输入的接受与草稿归属](2026-11-01-composer-send-acceptance.md)、当前 07-panel 的作者输入合同、03-control 及 Task follow-up 合同。全仓搜索失败提示、本地化字典、`onDispatch`、`onAccepted`、Chat/Mission/Task 公共写入、接受事实、scope/Stop、ApiError、HTTP response body 与 Feedback；读取前端提交组件、工作区绑定、API transport、普通 Session SSE（Server-Sent Events，服务端事件）、Mission 和 Task 提交以及公共路由。无委托、凭据或外部模型；本批为工作台界面反馈。

## 现象、根因、影响

B159 的真实桌面将用户实际显式提交的 Mission 交给正常开发服务。上游 200，真实 User Message 已入库，左栏已有该条 Mission；本地故障代理截断已接受响应体，页面却以红色 “Send failed / Your message could not be sent” 断言未发送。本人重发取得同一接受回执，截图和服务证据见[旧提示](../../artifacts/2026-11-10-mission-accepted-wake-catalog-replay/03-desktop-lost-receipt.jpg)、[实际请求](../../artifacts/2026-11-10-mission-accepted-wake-catalog-replay/desktop-acceptance.json)。这里仍然需要显示未确认与原诊断，作者正文保留正确。

ChatComposer 的单一提交入口已有 `dispatched` 和 `accepted`：真正请求开始前会执行 `onDispatch`，实际接受的服务回执或确切 Session 用户消息才执行 `onAccepted`。在 catch 存展示信息时只保留 accepted 布尔值，因此把发送前校验失败和已交给网络但尚无接受证明的失败归为一类。真实 HTTP（超文本传输协议）transport 在读取被截断的 200 body 时会保留原错误并抛出，没有构造虚假回执；这是反馈丢弃现有阶段的错误。已有的草稿保留、稳定请求键和 B159 重放修复了数据行为，不能替代准确的提示。普通 Session 可以在等待模型答复前先通过其真实消息流确认接受；Mission 和 Task follow-up 目前等待各自真正的成功接受响应。后者没有可重用的业务消息键，不能向用户许诺重发安全。完整的非成功 HTTP 响应也可能来自已经接受输入之后的执行或投影阶段，通用界面不能由状态码或报错文字推断未接受；原服务诊断应保留供用户判断。明确 Stop（停止）、scope/连接失效和本地命令边界维持现语义。

影响只在主输入区三种现有执行入口共用的内联反馈、两种界面语言、详情与无障碍公告。无需改变 API（Application Programming Interface，应用程序接口）、SDK（Software Development Kit，软件开发工具包）、消息/文件或持久数据、原草稿清理、执行身份、队列和重启恢复。不改独立的侧聊/看板创建表单，不增加第二套提交记录，不自动重发。现象无共享调度/轮次故障：B159 的真实请求、真实 Message/轮次、串并行、终态及重启已经核对；此批不把 UI（User Interface，用户界面）警示当作执行事实。若发现实质执行异常，再按共享机制扩展审计。

## 实施及验收

1. 在唯一 catch 投影当前已知阶段：已被接收；交给服务但接收未确认；发送之前失败。保持原错误对象、引用诊断、Dismiss、Stop 和 scope；继续依据真实成功回执/真实 User Message 清作者草稿，不通过错误码或标题推断。接收未确认用警示与中英文具体文案，建议先查看对话，再决定是否重发；明确已接受仍沿原文案说明响应未确认，发送前仍显示原失败解释。
2. 真实开发服务 `/ui`，独立临时 Git 项目及关闭本机端口的模型目录。由本人在普通桌面英文和简体中文实际发送，截断真实 Mission 成功回执，保留原正文与可操作反馈，再手动按同一业务键取得原目标、截图对照。用真正本地引用校验或合法准备故障对照发送前失败；用普通 Session 的真正 User Message 到达后截断后续 HTTP 响应对照已接受状态。只使用能确认真实 accepted identity 的证据；失败的模型诊断不视为模型验收。保存截图和公开回执/持久事实。变更仅为界面投影和两种本地化，不写或运行 UI 自动化；运行工作台构建、类型和语言完整性、文档检查。

## 实际验收

- B159 `068e64fd4` 普通推送已成功，上游 0/0。B160 真实开发服务 39380 与本地验收代理 39382，工作台入口 `main-w7io9TjC.js` 返回 200。全程由本人操作后台 1280×720 桌面并人工复核截图。
- 先用真实未加双引号的 Squad 引用触发发送前检查：红色失败、可理解的修正说明和原稿都可见。普通 Work Chat 上游成功响应被截断，独立事件流实际先显示精确用户消息，原稿随真实接受清空，警示标题为 “Message received”，原诊断保留。
- 在登记项目明确选择隔离模型，以英文与简体中文各真实发送一条新的 Mission。首次上游均 200，代理只截断回执，产品显示对应语言的接收未确认、保留原文、可展开原始传输诊断。逐次手动发送，均打开对应原 Mission 与原文。每种语言各两次实际请求，正文、模型、业务键相同，HTTP 跟踪标识不同，上游回执 Mission/Session 相同，SQLite 各仅一条原 User Message、一个 opened 和一个已结束的助手诊断。
- 只读 SQLite 验证版本 12、完整、无外键问题、3 条验收 Session、2 个项目和 0 Task/Automation/Provider 用量。曾在全局 New Chat 切换后误从匿名入口试送，隔离项目之外没有验收模型，因此只保留其正常临时项目分配，无 Session；不作为两语言回执证据。未调用真实模型或使用凭据。
- 工作台构建、公共渲染表面、类型检查、双语一致性（2 语言/3034 键）、文档及架构索引均通过；本批仅界面与文案，未新增或运行界面自动化。服务与代理返回 200 关停，独立标签页关闭，验证进程与监听全部退出。[截图与请求证据](../../artifacts/2026-11-10-composer-delivery-uncertain-feedback/README.md)。
