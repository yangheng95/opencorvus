# 314 子会话删除与快照成员关系

## Recall

用户持续要求改善Sources和子侧栏Rendering，最新单agent。313已实际提交/推送70ddd17fd97288e05eb3ad1b416eb5bb5174862b，起始干净；完成正文与终态工具旧值覆盖已修复，36项数据测试与真实历史子侧栏通过，属于progress。313明确留下漏接删除时旧Live消息可能复活的问题，本轮继续，不执行旧goal的委托措辞。

## 根因、范围与约束

已读subagent-conversation的parse/merge/project/observe、SubagentConversationPanel资源刷新与target key、Side连接快照清空live的路径、Task子会话实际路由；查全部merge/project调用、现有服务测试和Mission真实message.moved/HTTP路由检查，当前07-panel/task-control-plane。没有UI自动化测试。

直接触发：Task补全返回removedMessageIDs，merge删掉base消息后立即将该字段清空；project只看live.removedMessageIDs，保留的live.messageInfos会把已确认离开当前会话的消息重新加入。完整快照重置也会失去“之前已确认存在、现在不属于此快照”的成员关系。313的完成内容优先规则只处理仍在base内的消息，不能修复成员关系。

采用现有removedMessageIDs作为同一target的排除记录，不增加第二个store或协议：增量保留前次标记及本次显式删除；完整快照、epoch变化或游标回退时，以当前base已知成员与新快照的差集标记退休；服务端重新返回的消息解除自身标记。投影同时服从base与live的实际删除。新target直接接管其自己的数据，不携带旧Project/authority的标记。未进入过base的新实时消息仍可显示，不能把快照暂未覆盖的活动数据当作删除。

横向检查Task、Mission/Chat同一子会话投影、普通Side的连接快照、正常更新/删除/move、重复补全、重启epoch和跨Project/authority。后端已有message.moved路由会对原Session返回removedMessageIDs，对新Session返回当前真实内容；Host调度和写入规则不改。删除事实来自原API或当前快照成员关系，不按文案、长度或时间推断。历史尾部窗口的已知成员退出被视为离开该快照范围，不宣称数据库全局删除。

## 验证与交付

先扩展现有真实Mission消息移动检查：通过实际DB写入、原消息移动、生产Hono路由和HTTP payload，持有移动前的真实完整Info/Part，再用移动后的增量和完整快照执行当前merge/project，验证唯一当前所有者及退休标记。该检查是有测试输入的生产数据链契约，不冒充Provider或浏览器端到端。记录修复前失败后再改生产逻辑。

正向数据测试覆盖显式删除后仍有幸存者、空增量后标记保留、快照替换/epoch/游标回退、新实时消息、重新返回以及target隔离；旧“清空标记”断言改成当前契约。禁止以空结果或不存在为核心断言。前后生产路由和35项既有投影/终态服务契约重跑，类型/build及文档检查。

UI只实际页面、截图和人工复核。沿313重新核实305原件当前schema、完整恢复前沿、物理退出与配置后，复制全部runtime/90表到独立source-removal-314-history-01，/ui18283，不带auth/models，不创建Task/成员，不修改原消息。新构建下真实子侧栏来源、正文和列表往返复核；静态页面不能冒充实际网络漏帧。实际原执行器join、独立进程/端口/凭据检查、受保护数据逐行回读后归档。索引同步、范围提交、fetch/merge和普通push；goal保持active。

## 已完成与边界

按上述方案实施。真实路由复现从失败变为通过，合计44项数据/路由检查106个断言；类型79033与构建74924实际退出码0。自己的history页83和原执行器63323均结束，后者实际退出码0；四张真实页面截图已人工查看。详见[本轮证据](source-removal-314/README.md)。文档检查、提交与上游同步在最终交付时执行。

未进入过base的新live消息不能仅因快照缺席被判删除；本轮只保留服务端明确删除和已知旧成员离开快照范围的事实。活动Part漏接删除、精确持久化先后及原始全部Rendering仍是后续调查范围。没有新增开发子agent。
