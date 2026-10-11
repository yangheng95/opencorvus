# 301 最新完整快照回放

## Recall

用户要求持续单agent改善产品、修复Sources/Rendering；只有root工作。300是有效进展：2547e1b1c已推送，本轮开始git干净。真实Task初载86字正文被live sequence8历史空Part覆盖，owner重建；本轮子侧栏完整4228字生成稳定，原截图全部闪烁尚未归因。已读300完整Recall、当前07-panel/07-panel-reactivity、ProtocolStore、Bus、Session Part writer、Task/Session事件路由、Task根消息转移、前端hydrate/SSE/recovery/Side/子侧栏入口和相关backend测试。

## 完整根因与决定

after_live=0是新订阅者请求当前保留实时状态的既有契约，不能简单改成读取结束时游标：这样会漏掉尚未落盘的流式delta。直接触发来自缓存保存旧的完整Part快照；当前pruneClosedLiveDeltas只合并pending工具输入，文本完成仅清delta，却保留空文本及全部旧前缀。初始数据库快照再接收这些旧完整快照就会倒退。消息metadata同样保留多个旧完整版本。

应保留最新完整状态以及它之后的delta。复用已有完整工具输入快照的归并原则，统一实现对消息、Part、删除、转移的有序状态归并。完整Part快照吸收此前同一Part的完整快照和delta；后续delta保留原序列和epoch。不同Task/Session/Message/Part互不覆盖。消息updated只替换同一消息旧metadata，不误删其Part。删除保留当前删除事实；Task-root移交携带完整Message/Parts，移交前原Session中的旧状态由该真实移交覆盖，目标Session后续更新仍按原顺序。生产移交只能从Task根Session到已绑定orchestrator Session，重复向同一目标是幂等，其他源/目标受到真实行约束。

这属于重建实时投影的状态归并，原Message、工具结果、Source和持久化协议事件不删除；正常已连接流仍收到每个实时事件。不是延迟Markdown、最长文本或隐藏消息的UI补丁。原缓存和会话启动缓冲使用同一当前实现，删除被替代的旧prune代码。

## 共享机制审计

Task初载/切回/启动恢复/rewind-clear都使用同一保留缓存；正常重连带已消费live游标，仍能取得最新完整快照和其后delta。终态退休已有单调游标、epoch与重新打开规则维持不变；进程重启由原epoch失效契约处理。缓存Task分桶及精确消息/Part身份保证多项目与并行任务隔离。

普通Session、Mission、Side Chat使用Session SSE，先订阅再读取canonical快照。对其读期间缓冲应用同一完整状态归并。ProtocolStore当前订阅是串行异步tail；增加该订阅自身已排队投递的drain能力，读取结束后等待当时已入队的回调完成，再发送快照及归并后的缓冲，避免canonical读取已经包含的新Part更新仍在队列中而先释放旧Part。新到达的后续事件仍由同一订阅按序处理。drain只等待调用时已接受的队列，不等待未来事件或延长Task运行期限。

Task子侧栏接收同一全局事件流，其bootstrap由缓存修复覆盖；独立HTTP base/live旧overlay风险尚无真实倒退证据，本轮不另造字段或最长字符串路径。所有调度/Task执行/Provider行为不改变。当前证据属于投影回放，300真实生命周期已正常闭合，无执行调度异常证据。

## 契约与验证

消息/Part完整快照由当前schema及writer提供。普通Part写入后Bus.publish的exact/wildcard callback同步开始，message bridge在首个await前分配live序列并写入缓存；流式前缀保存和最终settle仍使用现有writer。订阅drain覆盖snapshot读取结束时已接收事件。公开HTTP字段不变，不增加版本兼容层或双配置。

修改前全仓搜索缓存键、prune、subscribeEvents调用及Session缓冲；修改后执行聚焦正向backend测试：当前完整正文+后续delta、最终重写（可短于旧文）、消息metadata、删除/移交、不同Part/Session/Task隔离、正常游标重连、终态三分支/重开/epoch；Session真实HTTP SSE边界及drain有序完成。现存搜索到的相关测试均为backend API/数据测试，不是DOM/组件/截图自动化，不以其替代视觉。

再正常构建并使用授权gpt-6.1-sol/完整模型目录开启隔离真实Task，人工在正文已有内容后首次选中任务/打开子侧栏，并按必要的最小诊断记录比较300的同Part回退链路。使用真实/ui截图复核后撤除所有诊断，再正常构建和必要复验。原生固定时限、预算及成对清理沿用当前成熟启动器，不碰用户进程。完成类型/文档/架构检查、范围提交、fetch/merge和全部待推送审阅后push。未通过的范围如实记录，goal不标完成。

本轮实现未加入前端或运行服务诊断。复验使用正式HTTP hydrate+SSE的只读观察器，保留真实快照与task.connected之前实际返回的回放帧；其查询与前端首次选择相同，不发送新消息，也不是浏览器/DOM自动化。真实页面人工查看与该后端数据证据分开记录。前端由正常构建产物启动，无须为了诊断再改浏览器源码或重建运行中的冻结UI资源。

## 实施与验收结果

实现见 ProtocolStore、conversation-live-buffer 和 Session 事件路由；旧特殊 prune 实现已删除，普通 token delta 入队保持 O(1)。聚焦 8 项 Task 回放、11 项 Session SSE、2 项 Mission/Task 根消息移交均通过；后端类型和正式前端构建通过。验证命令为 packages/opencorvus 的 `bun run test test/task-live-replay-retention.test.ts test/server/session-event-connection-snapshot.test.ts`、`bun run test test/orchestrator-mission-root-message-read.test.ts`、`bun run typecheck`，以及 packages/overlay 的 `bun run build`。具体原日志保存在 [本轮证据](replay-snapshot-301/README.md)。

真实首次回放在正文出现 7.672 秒后收到与 HTTP 一致的 603 字符完整值；研究员最终 4397 字符，13 次实际 gpt-6.1-sol 流式请求完成。真实页面复核生成、完成后跨项目返回及 Sources 三条标题/域名与 W3C 跳转。无前端诊断；观察器只读正式后端路由。原 exec 76451 实际 join exit 0，自有 Native 74656、Host 57032 与两个页面已关闭。原截图所有闪烁的归因未完成，后续继续查证。
