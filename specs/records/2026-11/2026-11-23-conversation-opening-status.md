# 已选会话加载时显示真实等待状态

## Recall

用户要求本人独立持续分批迭代，先落盘根因和影响，再修复、实际桌面双语交互及人工截图、聚焦正向验证、范围提交、合并上游并正常推送。第 368 批已推送 `e7ef391ba`，上下游 0/0，起始工作区实际 177 条无关状态。仅操作本人隔离项目和浏览器页面。无模型、凭据、任务执行或发布。

已读 `openMissionWithUILifecycle`、`openMissionSession`、Chat 会话选择、Task 选择的共享加载状态、`BoardSource`、`activeTaskID`、`activeSessionID`、新建入口判定和全部使用处。追踪 `selectionRequest` 的生命周期、选中记录读取、权限当前性、`App` 加载条、`ChatComposer` 禁用原因，以及真实选择读取接口。全仓查 `conversationSubmitActive`、`missionSubmitActive`、`workspace.loading_conversation`、`chat.placeholder_disabled`、`selectionUnavailable` 和 `archivedComposerReason`。对照 [当前界面架构](../../current/architecture/07-panel.md)、[选中读恢复](2026-11-12-work-ledger-selection-reading-recovery.md)、[重试等待](2026-11-12-work-ledger-selection-read-retry-progress.md)。相关路径未发现界面自动化测试。

真实验收覆盖英语和简体中文，连接在线，从 Mission 列表和左侧项目导航打开不同项目的已保存 Mission 或 Work（工作对话），在等待期间看到现有加载名和恰当的记录类型，之后读到同一标题和确切原请求。切回真实新建界面仍可输入。精确接口核对各记录、项目、状态和空消息历史。运行当前选中读取与提交意图的正向契约、类型、双语、构建、文档和架构检查。

## 实施前证据与根因

2026-11-22 深夜，隔离服务 `40376/ui/` 提供 `main-Co1HDOCQ.js`。英文在 Mission 列表打开北区同名项目的 `North inventory review`，左栏已选中，连接仍为 Online，顶端显示进度条，标题却是 `New Work`，输入区提示 `Reconnect or open a chat to continue.`。同一路径正常载入原北区草稿。由该草稿点击南区 `South work conversation`，标题先用既有通用 Work，输入仍称需要恢复连接，随后读到实际南区空会话。简体中文由南区切至北区 Mission 再现「新建 Work」和「恢复连接或打开对话后即可继续」。在不改网络且不刷新页面的情况下全部正常载入。健康和各自精确选择接口真实 200。 [基线截图与接口回执](../../artifacts/2026-11-23-conversation-opening-status/README.md)

输入区已因精确选中记录未就绪被正确停用。问题是主界面只给输入区传实际读取错误与归档两类说明，未投影正常等待，通用禁用提示被误用。真实会话水合期间 `boardStore.taskSwitching` 拥有进度段，水合结束才启动同一来源的精确记录读取；后者的既有 `selection.loading` 拥有后续等待，二者已提供真实进度。连接健康并不意味着这次选中读取已经完成。旧的读取错误与重试修复只处理失败与重试，不给正常首读传入本地化原因。

`openMissionSession` 先发布确切 Mission 来源、清理旧视图并开启水合，随后切项目并同步 Mission 输入模式。`conversationSubmitActive` 此时用 `isConversationSource` 排除 Chat/Work 专属会话，却把已选 Mission 误认作新会话；还没同步的上一入口意图是 Chat，导致标题短暂显示新建。当前 Task 和已选工作对话本已挡住新建路径；来源类型只有 Task 和 Session。选择、精确加载、最终内容和原项目已通过实际复核，无调度、队列、唤醒、并发执行或终态异常。

## 方案和影响

新会话入口判定使用已经发布的无工作来源条件，只在 Chat 意图且无已选来源时生效，避免在已选 Mission 的暂态套用新建标题或新会话分支。完整检查现有标题、图标、输入例句、按钮标识和实际提交调用点。已选来源加载不可提交的契约仍由原 `selectionUnavailable`；新建时原请求按已有意图，选中时仍沿当前已有会话发送。Task 和已有 Chat/Work 的判断结果保持，Mission 的正常已加载内容仍取得原真实标题。

输入禁用原因在原读错误和归档原因之后，连接在线并且同一已选记录在水合或精确读取时复用进度条已有双语文本。继续由现资源发布错误、当前性和停用状态。保留当前标题、会话 / 项目导航、真正的断线与错误说明和执行权限。只修改界面的来源判断与原因投影，不改接口、HTTP、存储、会话水合、调度、队列、请求、提示词或模型。关注快速切换、首次读成功、新建模式与错误优先级；正常慢速读取用真实桌面截图复核。

## 首轮候选补充分析

`40378/ui/` 提供 `main-DZovbIy5.js`。直接交互已复核英文 Mission、英文 Work 和中文 Mission 的水合阶段，输入区显示现有在线加载文案、上方类型正确，完成后显示对应已保存记录。中文无项目首页可输入，实际清空未发送。单独的 `40380` 本地转发保留北区 `/work-ledger/selection/session/<id>` 的真实 200 响应；进度条结束后，输入区准确提示加载，但正文出现「此多步任务暂无对话记录」的通用结论。放行同一真实响应后才出现持久原请求。 [初版实际等待截图](../../artifacts/2026-11-23-conversation-opening-status/interim-en-empty-while-held.jpg)

`Conversation` 的 `emptyMissionSource` 已等待当前板水合完成。空内容块准入只检查是否已经读失败，在精确记录待定时把通用空态提前当成已知结果。`emptyMissionItem` 已经检查当前来源的 Session、目录、类型和正文是否为空，能区分实际有资格呈现的记录及暂时故障保留的同一记录。改由该访问器拥有空内容块的准入，保留存在实际记录时的标题、待启草稿原文、空状态、归档和已有读取故障提示。只有 `main` 挂载该组件，没有新增读取、状态或计时器。继续核对同一真实 200 在待交付和放行后的两张桌面图，并复跑普通构建和原检查。若无当前正式记录，使用现有会话加载提示。

## 最终验收

`40382/ui/` 提供 `main-DRV03wD2.js`。经独立 `40384` 转发端操作真实页面，英文 Mission 从列表打开时显示 `Mission` 和 `Loading conversation`。水合进度条结束后，转发端已收到但尚未交付北区确切记录的 200，正文区域保持等待，输入提示继续正确。手动交付同一个响应后出现确切原标题、待启草稿和原请求。跨项目打开南区 Work 时同一英语提示可见，记录和已就绪输入随实际读取返回。简体中文重复北区 Mission 与南区工作对话，等待阶段分别显示「多步任务」和「通用工作」，共同使用「正在加载对话」。真正的新对话可输入临时文字并已清空，未提交。人工复核六张基线、一张中间态和十张最终原图。 [桌面截图及真实回执](../../artifacts/2026-11-23-conversation-opening-status/README.md)

最终服务实际健康检查、两个目标的精确选择与空消息历史均返回 200。三套隔离数据库各有三条会话，消息、执行任务和模型活动均为零。三个开发服务和两个只转发真实响应的本地进程均关闭 200、退出 0，五个端口全部释放。最终 `work-ledger-selection-read.test.ts` 通过 3 项、6 个断言，`composer-intent.test.ts` 通过 5 项、5 个断言。类型、双语（2 种语言，3238 个键）、正常构建、渲染公开面、根文档和架构索引检查通过。此次桌面验证未人为造成断线或运行任务，错误与归档的原有优先级由现有选择读契约和代码检查核对。
