# 292 Task Sources 与阅读返回

[Recall与实施前根因/影响分析](../task-return-plan-292.md)。起点4be01abb0，开始工作区干净，全程root单agent，没有新Task、成员、Provider请求或凭据移交。三个正常开发/ui实例都复制原153完整闭合历史，未生成浏览器夹具或改写原消息。

## 原用户数据重新核对

[original-current.json](original-current.json)为2026-10-11T08:52:39.492Z原生产DB的readonly BEGIN/ROLLBACK。原ResearchStudio Task tsk_g00VXMejke00KwIb9xRv仍存在，当前持久投影failed epoch1；研究员仍719消息/209URL来源。当前schema checker仍返回unexpected schema object index:engine_dispatch_lineage_initial_workflow_node_idx。未bootstrap、删index、迁移或重置该DB，未操作用户18107窗口/进程。以下当前真实Task资格不替代这个原Task或新live全帧Rendering资格。

## 两个真实根因与当前实现

工具外层卡片已有展示状态，但ToolPayload的Raw/展开及递归JSON节点open/limit仍为挂载局部Signal。history-01 [04输入展开](history-01/04-input-expanded.png)显示原url/format/timeout三字段；[05阅读](history-01/05-reading.png)top1292/height577/total3582。经过原tester返回，[07](history-01/07-researcher-return.png)Input变回Expand、total3416，实际段落前移166px，即使top仍1292也失败。

现格式、展开及JSON节点选择由同一个conversation-ui record的有界toolPayloadDisplays持有，key为真实Session/Message/Part、input/metadata/output及JSON字段路径。局部重复Signal删除，完整value/解析/copy合同保持。首次Input默认收起属于既有合同，不把只有操作栏的初态误报输入丢失；剪贴板反馈继续只属于当前操作。

history-01 [08跨Task返回](history-01/08-task-return.png)又回到末尾。history-02临时诊断先证明工具修复后[成员返回](history-02/02-member-return.png)保留1292/3582，但[跨Task返回](history-02/03-task-return.png)仍top3006/follow=true。

[真实reader日志](history-02/03-reader-log.json)显示面板只创建一次，成员返回有initial1292/following=false；跨普通Session再回Task时，目标source增加上个Session的sessionKind:conversation和experience:chat，authority revision仍0，initial缺席。Solid store普通对象setter浅合并，Task只覆盖kind/id/directory，未移除上一变体字段，破坏完整目标身份。诊断源码差异见[临时记录](diagnostic-instrumentation.patch)，四条console日志已从最终代码删除。

当前Board的唯一setSelectedSource使用reconcile(...,{merge:false})写入完整联合值；Task/普通Session/Mission和退役入口统一使用，沿原同步batch及epoch/authority校验。Subagent完整target key和32项读位Map保持原合同，未通过过滤身份或增加fallback缓存隐藏根因。后台调度、权限、模型与数据协议不改。

## 最终实际页面

最终history-03正常18246，自建实际tab37，实际bundle main-QoHGvBJ8.js。root本人操作并查看所有图片：

- [01稳定阅读](history-03/01-reading.png)位于WAI介绍中的同一段落，top1292/height577/total3582/follow=false，Input保持展开。
- [02成员返回](history-03/02-member-return.png)经原tester返回，仍为同一段落及相同几何；Input继续Collapse状态。
- [03另一项目](history-03/03-other-project.png)显示原Reply with OK./OK；[04回到Task并重开成员](history-03/04-task-return.png)恢复同段落、1292/3582/follow=false，修复此前直接落末尾。
- [05整Dock关闭重开](history-03/05-dock-return.png)保持同一阅读位置和输入展开。
- [06 Raw输入](history-03/06-raw-input.png)切到真实原始JSON，经成员往返，[07](history-03/07-raw-return.png)仍为Raw并展开；[08改回Readable](history-03/08-tree-retained.png)保留原先折叠的三字段根节点。

history-01 [02](history-01/02-source-focus.png)亦实际显示三条真实来源可读标题/域名与聚焦完整Tooltip。来源身份/内容由原数据保管；无snippet的来源不伪造摘录。已验当前完成态Task、原researcher/tester、普通会话往返、工具根节点及整Dock；更深JSON/加载更多、大容量驱逐、Mission独立页、全部主题/平台和新live全帧仍未验。没有UI自动化、DOM/组件/源码文案断言或截图基线。

## 运行和工具边界

原153 Task tsk_g00VXRkMRi00ID2TqzPU、Project prj_honTzv1SylD1sTwgEqBC、root ses_-zUSYFdRdzzk2frR62zX、request 0f315e79-0af3-438e-b26e-d312f2f3e65e。各阶段fresh核对精确原Host/Native出生已死、原parent30224 actual0收据、端口/pair及当前schema/config/全部恢复前沿，再完整90表逐行等值复制。Task completed epoch1，派发候选空、15 assistant完成、8权限执行/结果、2checkpoint和3ingress闭合，两ProjectMemory idle/pending0，唯一未过期runtime lease出生已死。

|阶段|端口/页面|原前台实际结果|Native / Host出生|收敛UTC|原固定预算剩余|
|---|---|---|---|---|---|
|history-01|18244/34|82010 exit0|52656/639273056252414441；76888/639273056245010728|08:59:08.922|575540ms|
|history-02|18245/35|98241 exit0|28996/639273064737669114；1296/639273064730110745|09:12:13.484|639453ms|
|history-03|18246/37|56098 exit0|8136/639273071106056391；75840/639273071059470466|09:22:37.579|648225ms|

三个sole shutdown、原前台join、独立physical/output/request/port/pair closure均actual0；19受保护表（5Session/22Message/59Part/14工具请求及结果/17Provider请求及结果等）及47执行生命周期完整值相等，runtime配置直接字节相等。两原Project只有Vcs观察造成的.git目录时间变化，完整差异留存，不把文件元数据当全文身份。全部checker结束后各自5自产物按出生和限定路径保管，900000ms预算未延期。

诊断版types2033/build65493 actual0、52.11s；最终types96306/build82235 actual0、52.17s。after guard首次生成错误地把旧272收据路径改为after-readiness，启动前拒绝；恢复实际原路径、重跑所有当前资格后通过，旧收据不变。

最终服务第一次页面打开早于HTTP就绪，自己的36页得到ERR_CONNECTION_REFUSED；Native并未终止或重启，随后原startup receipt存在。该浏览器生成的data错误页被工具URL策略拒绝绑定，连清理绑定也被拒；没有绕过策略读取或修改该页。新37页在同一原服务/预算内成功进入真实产品。一次失败JS赋值未保留变量，随后以已知37重新绑定；未重复启动服务。34/35/37明确关闭，36未标记保留，依工具临时页回收规则处理，不声称手工关闭成功。

docs:check actual0（345 ops、25 groups）；check:architecture-index actual0（18 current documents，全部链接有效）。48份本轮脚本、清单和日志已归档；公开文本只清理行尾/末尾空白，原件在本轮私有raw-public-text保管，JSON和截图未改。原授权凭据仅用于内存精确扫描，141份公开文本credentialMatches0，见[scan.log](scan.log)；没有复制凭据内容。Model configuration unavailable是无凭据历史读取状态，不宣称原用户OpenAI授权丢失。范围commit/上游merge/普通push后继续，goal active。
