# 300 实时渲染生命周期完整观察

## Recall

持续目标是自主改善产品体验，用户最新明确只使用单agent。299提交1d596d276已推送，修复真实404摘要误显示markdown，实际历史/ui与输入/Details/来源跳转均复核，原进程和页面已结束；这是有效进展。本轮开始git干净，只有root工作，不委托协作agent。原用户所见子侧栏Rendering闪烁仍未知。

298真实gpt-6.1-sol任务正文生成期间，73次子正文投影没有记录退步，3个文本owner没有退休；但普通函数on(initial)反复触发相同content记录，500条诊断提前耗尽。主会话首次切入出现同一Part的77字符owner退休、14字符owner重建再到77字符。当前既不能证明共享错误，也不能据窗口内稳定宣称原问题修复。

已重读298/299 Recall、07-panel-reactivity单写入/子资源/组件身份契约、SubagentConversationPanel、TextPart/text-part-model、CardParts、message-part分组、events与tree-writer（projectedConversationPartSnapshot、完整视图提交、Part更新和delta）及先前审计结论。主树由tree-writer写入；已有正文结构化live/full snapshot路径不该用临时状态替换。子资源仍存在旧live覆盖较新base的代码风险，暂无真实倒退证据。来源、数据协议、Provider、调度与恢复本轮不修改；若观测到执行/恢复/终态异常则按共享机制审计。

## 诊断方案及影响面

修正临时诊断：先用createMemo固定布尔/流式状态，按真实状态变化记录，生命周期与投影采样各自计数、有界且显式报告触顶。每个文字owner的挂载、初始Rendering结束、流式终态与退休记录实际Part身份/长度/块数；同一Part实际文字退步记录前后正文。子base/display更新记录真实前缀差异。主树事件写入前记录有界上下文，完整视图提交记录真实已有Part与新文本差异，以区分首屏快照交汇和组件分组重排。

全部记录使用现有AppLog并untrack，不改变模型消息、数据、事件、状态、handler或展示内容，不注入UI夹具、伪事件或自动化断言。诊断本身会产生额外开销，任何生产修复必须先补齐根因与全部调用面，然后移除诊断、正常构建并真实复核。若未发现问题，保留范围与证据，不编造补丁。

## 真实路径与验收

沿用已授权Provider凭据和完整models配对资格；新隔离300/18260，先完成构建，再原生Task资格启动。gpt-6.1-sol实际流式，含preflight总请求预算20；准备600000ms、真实Task接受后900000ms、原生1500000ms固定，不因观察超时或新进展续期。产品中只一名只读研究成员读取三份指定官方资料并在可见消息生成十节约3000汉字；它是被测功能，代码工作仍root单人。正式CLI创建真实Task并以原接受时间/Task/Project/Session绑定checker，然后手动/ui打开成员和回看Sources。

至少观察来源形成、正文中途及流式完成到Task终态，实际截图人工复核；用持久化最终Part和生命周期核对诊断最后长度/流式完成，确认各采样计数是否触顶。未覆盖到的时间/表面明确写出。完成后关闭自己的页面、sole shutdown、原exec实际join、独立原生/端口/成对凭据清理，撤除临时源码并正常构建。同步spec索引、文档检查、范围提交、fetch/merge、完整待推送审阅后push。goal保持active。

## 实际完整观察

Task tsk_g00VXkEIMP00wBs43Mn0、Project prj_h7tzlqyxCnGT8E2fZ9XE、根Session ses_-zUSFlhWvzzIPbwf1dVz、实际控制Session ses_-zUSFlgjUzzD12um8ZiQ、研究员Session ses_hWmCpoeNEtfTx52exksW。epoch 1于2026-10-11T12:49:30.224Z完成，12次真实gpt-6.1-sol流式请求均正常闭合。

诊断构建51.60s/typecheck实际0，实际页面使用main-BCb0-OSB.js。三Sources可见，十节4228字符正文在人工截图中连续呈现。266条诊断包含23生命周期类与243投影类，均低于400/1000上限。242个子侧栏投影样本无前缀回退。介绍owner4保持87字符，正文owner5从2字符增长至4228字符，期间只有首次Rendering→streaming→content；二者直到操作者在12:50:34关闭Dock才retire，此时pending=false、块数1/34，长度与真实持久化Part相同。不是只采半程，也不把长度相同夸成逐字屏幕比对。

## 已确认的数据回退

12:47:08首次选择Task，完整视图先载入86字符的实际控制正文Part prt_g0VXkEKIY00joqqXVLcH。随后的同epoch live sequence 8是该Part历史空文本；主树真实之前86字符被该空文本覆盖，owner2在首次排版阶段退休，owner3以5字符挂载，随后回到86字符。诊断同时保留实际正文、同Part身份、live sequence/epoch和前后事件，而不是仅依据标题或模型描述。

其余两次incoming文本收缩均是正常末尾换行去除，与processor完成语义一致，不归类成同一缺陷。主会话86→空→5链路证明数据回退和组件重建；两个owner当时都还在初始排版，不能据此断言肉眼已经看到“正文→Rendering”的闪烁，也不能将用户原截图所有重复闪烁都归因于此。当前子侧栏本轮正文稳定是独立观察。

## 立即开展的共享边界审计

全仓搜索resetSelectedLiveCursor、selectedLiveReplayQuery、markSelectedLiveEventConsumed以及Task/Session事件入口。Task选择task.ts先重置live游标为0；conversation.ts初始hydrate只接收/保存durable lastSequence；orchestrator.ts的/task/:id/conversation当前响应没有live游标。随后sse.ts带after_live=0连接，后端Task事件路由按live缓存从头回放。此次实际收到sequence1至8与这条代码路径一致。

这不是某个专家团的局部问题。Task首次选择、跨项目返回、启动恢复、rewind-clear均涉及相同重置/重建路径。正常断连复用已消费live游标；live_replay_expired分支则刷新tail并以replayLive=false重开，存在不同边界，不能用本次初载结论代替其验证。Task子侧栏通过同一事件发布口接收实时事件，自身HTTP刷新只更新base，旧live overlay优先覆盖的风险仍需联合审计。

Session/Mission主会话及Side Chat走Session SSE：先订阅、读取canonical尾部、发送session.connected，再释放期间缓冲事件；Side Chat收到连接快照会重置live overlay。这排除了它们使用Task after_live=0的同一入口，但没有排除异步快照读取与缓冲事件重叠导致倒退的共享风险。所有实现方案必须核对读边界、Part发布时序、epoch/重启恢复、正常/终态、串并行、多项目及所有生产消费者，不能简单把游标设成读取结束时的最大值或保留最长文本。

本轮没有生产修复；正确快照/回放契约尚待完成设计及正向契约测试和真实前后验收。后续从这里继续，不能重复只观察文字是否闪烁。

## 收尾

自己的56号页已关闭；原生53672、Host73820正常结算，原exec6205真实exit0并确认12次Provider EOF（End of File，流读取结束）。独立检查原进程出生身份、端口和auth/models成对清理完成。五个Bun运行文件按本次出生时刻与精确路径归档。五处临时源码改动及诊断文件全部撤除，生产源恢复1d596d276；正常typecheck/build实际0，构建49.85s。原Rendering目标保持未完成，当前交付是确定下一步修复位置的真实证据。
