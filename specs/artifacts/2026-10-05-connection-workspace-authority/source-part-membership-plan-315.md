# 315 子会话 Part 成员关系

## Recall

用户要求持续改善 Sources 和子侧栏 Rendering，最新明确只使用单 agent。314 已提交并推送 976541abf0e8393cf182fb6332928eeed11623a1，开始工作区干净；上轮属于 progress（有实际修复、路由证据和真实页面）。持续目标仍 active，旧目标中的 Astra 委托措辞不执行。

验收目标：当前权威会话读取明确撤回的已知 Part 不能被保留的实时内容再次插入；存活来源、尚未进入补全的新实时 Part、活动文字尾部和服务端明确恢复的 Part 仍使用真实数据。先取得真实持久化/路由失败证据，再实施；不通过隐藏 Rendering 或猜测文字新旧解决。

## 已读资料与全仓影响

已读 314/312 Recall 与记录、145 历史生命周期调查、当前07-panel、subagent-conversation 的 parse/merge/project/observe、SubagentConversationPanel 的资源合并与 target 清理、Side 的连接快照、CardParts 四层分组及 TextPart/model/worker。全仓搜索 SubagentTranscriptMessage/Transcript、merge/project 调用、Session.removePart 和全部生产调用点、PartRemoved/实时事件缓冲、现有成员和实际 Task 路由测试。

直接问题：merge 当前仅管理整条消息；返回的新消息有完整呈现 Part 集合，却不保留其中已知旧 Part 离开的事实。project 对活动消息遍历旧 live.parts 并追加缺席的 snapshot，能复活已撤回的文字或来源。313 的已完成助手规则只约束终态普通 Part；314 的消息记录只约束整个消息，均没有处理活动消息内部的成员关系。

生产移除入口为 Session.removePart，调用方包括公开 Part 删除接口、processor 重试撤回和交互 artifact 清理。Task 因果消息有原本不可变保护；一般活动消息可合法撤回。共享总线发布原始 PartRemoved，Task 消息桥接与 HTTP（Hypertext Transfer Protocol，超文本传输协议）变化消息读取已包含当前集合；错在漏接事件后的客户端补全叠加，不修改重试/调度/恢复策略。Task/Mission/Session 子会话共享同一投影；普通 Side 的有序连接快照清空 live。主会话 tree-writer 独立，不在本轮复制实现。

横向覆盖正常 Part 更新、显式撤回、重试产生新 Part、完成/失败规则、重复增量、完整快照、运行代次/游标重置、消息整体离开后再返回、target/Project/authority 隔离。队列、唤醒、执行轮次和多项目调度没有新异常证据；本轮不改这些机制。真实自然重试是否引起原截图中的闪烁仍未知。

## 设计

在现有 SubagentConversationTranscript 中保留一个按 messageID 分组的 removedPartIDs 记录，作为同一当前 target 的成员排除事实；不增加 store、服务器协议、持久化字段或配置。首次 parse/live 构造没有排除项。merge 比较已知旧消息 Part 与当前权威消息 Part，保留旧集合差项；明确返回的 Part 解除自身记录。消息整体移除或快照退出时，同时保留它已知 Part 的排除事实，保证同一消息以后恢复时旧缓存不会添加缺席 Part。不同 target 直接接管新对象，不带旧记录。

project 同时尊重当前 base Part 排除和实际 live 删除；尚未进入过 base 的新 Part 继续可见。不得依据 lastLiveSequence、请求开始时间或文字长度把活动文本当作已持久化。快照成员关系只代表当前呈现范围，不能推断数据库全局删除。记录仅随当前 target 存活；没有另一个数据真相来源。

## 实施与验证

先扩展 inspect-task-live-observation 的真实存储/Task HTTP 检查：通过原生产写入创建活动文字和来源，保留读取时的真实 Part，再用 Session.removePart 撤回来源，实际增量与快照经 parse/merge/project 应保留唯一当前文字及其来源集合。修复前记录失败，修复后通过。测试输入不是真实模型对话，不注入浏览器，不冒充 Provider 验收。

纯数据正向检查覆盖来源撤回、重复补全、消息整体撤回/恢复、新实时 Part、明确恢复、运行代次和目标隔离；原313/314契约和实际移动检查重跑。不新增/运行 UI 自动化测试。类型与构建后，重新验证305原件完整恢复资格，再以独立无凭据90表历史副本在 /ui18284 人工查看子侧栏三条 Sources、正文与往返，实际截图复核。记录历史页面不能代替自然漏帧重现。自己的页、原执行器及 Native/Host 按出生身份收尾，逐行复核保护表。

更新当前架构与索引，运行声明的文档检查，范围提交，fetch/merge 后核对全部待推送提交并正常 push。保留原始流式问题未完全验收的限制，goal 保持 active。

## 当前证据

实际生产写入/Part删除/Task消息桥接/Hono读取复现成功：服务端只返回当前正文，旧project却追加已撤回来源。修复前3项中1失败（退出码1）；修复后前端50项96断言、后端5项56断言通过（均实际退出码0）。后端包含两个原有真实消息移动检查。排除记录采用可选的稀疏字段，无已知排除项时不要求显式空表；不是旧协议兼容读取。所有权始终在现有当前transcript上。

自然Provider重试与浏览器丢帧仍未复现。仅出现在live、未进入过base而移除事件又丢失的Part，不能由本轮已知集合差推断；真正的新live Part必须继续可见。后续实际页面验收仅证明当前历史呈现与交互。

当前已完成真实/ui18284的四张截图人工复核，自己的页84和原history执行器6478已退出（实际exit0）；Native68312/Host62736独立回读结算，保护表内容相同。类型2132、构建60950实际exit0，文档/架构检查通过。完整证据见[source-part-membership-315/README.md](source-part-membership-315/README.md)；最终范围提交和远端同步随后完成。
