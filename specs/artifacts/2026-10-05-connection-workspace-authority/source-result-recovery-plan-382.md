# 382 工具结果与来源的中断恢复调查

## Recall

用户持续要求自主体验、修复 Sources 与功能，最新仅单 agent。381 已提交推送 ff7b2ebb1，上一轮是 progress（真实去重修复、后台与实页证据）。381 的同一步双调用真实验收耗尽原固定12请求，原launcher exit1，未改写为通过。本轮不复活旧的多 agent 指令，不改写或重启381运行。

开始时工作区有他人的 webfetch、usage、UI、测试、索引和 bun pile 改动，均保留。已重读381 Recall，读取当前 source persistence、processor、Session writer、PermissionAuthority、SessionLoop 恢复、任务工具调用包装、tool-part-fact-storage 和 security-permission/02-data/07-panel。全仓检索生产 completeRecoveredToolPart 只被权限恢复调用；工具结果与模型来源均由统一 processor 持久化。

## 已有代码证据与风险

1. PermissionAuthority.completeExecution 先在同一事务保存真实结果和 execution_succeeded。Full access 同时退役 continuation；Ask me 后续仍可重放原结果。故不能假设所有成功结果都会被权限启动扫描再次处理。
2. processor.completeToolPart 先 await Session.updatePart 写 completed outcome，删除本地 toolcall，再逐个写 display 和 Sources。Source 写入失败时，工具 outcome 已不可变。重复 completeRecoveredToolPart 对一般已完成工具返回 Open ToolPart not found。
3. resumePermissionContinuation 看到 completed Tool 且 assistant 已完成会直接 resumed；未完成 assistant 也走 completed Tool 的结束分支。此路径不会重建 Sources/display。
4. terminalizeRecoveredIncompleteAssistant 和 processor.convergeOpenToolParts 对普通 open Tool 收敛为 error；前者有专用调度、协调、panel 恢复，但没有通用 permission result 投影。直接将 Tool/source 改成事务可能导致已成功外部操作在 companion 写入失败时被显示成 error，因此不能在未验证此契约前落地局部事务补丁。
5. canonical writer 允许已接受 Tool 的 outcome 在 assistant 完成后结算；新 Source/display 禁止在终态追加。此不对称由 tool-part-fact-storage 正向合同明确保留。不能放开所有终态 Part 写入，或只针对某个专家团绕过。

## 本轮执行方案

先进行真实数据库故障边界调查，而不修改上述生产契约。通过正式后台 runner、实际 ReadTool、withTaskToolInvocation 和 PermissionAuthority 完成项目外文件读取，得到实际 durable receipt/Source；在 Source writer 的明确边界注入一次持久化错误，记录工具结果、来源、重试、Full access 启动恢复与 Session 中断收敛后的状态。Ask me 使用真实 Asked/reply API，只批准本轮隔离文件读取。保存规范数据、错误和完整日志；不是 UI 自动化、真实 Provider、OS进程崩溃或全链端到端验收。

调查覆盖两种授权模式、正常成功与指定中断、同一调用重试和独立项目/Session；Task/Mission occurrence、真正进程重启与多工具恢复并发尚需后续共享机制验证。先验证这些差异，再决定一次性结果发布/恢复的契约和实现；不增加 fallback、影子 Sources、独立恢复队列或新状态机。

同时纠正381新增后台测试的一个类型使用：completeRecoveredToolPart 的 toolInput 是必传参数，原测试运行时利用 undefined 取已有 input，但应显式传入当前规范输入。该改动不改变产品行为。

所有 probe 输入为本轮临时普通文本；无 Provider 凭据和外部网络请求。使用项目既有测试预载、管理目录与进程 runner，单用例60000ms/runner inactivity360000ms，完成后由现有测试生命周期清理。真实测试失败不得包装为通过。完成调查记录、索引、文档检查、范围提交与正常上游同步/push；恢复能力未验证完整前不宣布问题解决。

## 首个边界结果与追加调查

正式 runner 313e55 exit1，2个来源正向合同均失败。两种模式下 ReadTool 实际执行各1次，Permission receipt 均包含完整 source-file；故障后Tool为completed、Sources为空，重试均Open ToolPart not found。真实 Session 中断收敛后，Full access恢复返回0，Ask me恢复返回1并退役请求，二者Sources仍为空。原始阶段数据保留。最初probe的workspace bare-module解析失败已改为准确相对源码导入，原工具故障日志保留且原验收已重跑。

继续使用相同真实Read/permission输入，调查更早的“receipt已提交、processor尚未完成Tool”边界：保留running Tool与真实成功receipt，直接调用既有Session中断恢复和权限恢复，记录其明确结果。该阶段不制造Source写入异常，亦不实际杀进程；仅验证确切已持久化状态进入生产恢复函数后的行为。若工具被投影为error，则已证明不能先提交局部Tool/Source事务修改而忽略共同的成功结果恢复。

## 第二个边界与共享入口证据

79409 原runner exit1，两个receipt-cut正向合同均失败：实际读取仍各1次、execution_succeeded及结果Source完整，但terminalizeRecoveredIncompleteAssistant将running Tool写成error/process-execution-interrupted；Ask me后续恢复直接把已有Tool错误退役，Full access原本已退役。与Source丢失窗口一起构成当前共性恢复缺口，不能以atomic-bundle局部修改收尾。

已检索并读取全部生产terminalizeRecoveredIncompleteAssistant调用：Task-root过期activation收敛（task-root-ingress-delivery约1045）、遗失dispatch worker（约1680）、Mission process-recovery约343、普通Session loop约2984，以及loop底部prompt lifecycle adapter。Task-root activation writer的allowAcceptedActivitySettlement仍核对原parent/ingress/project，并要求原Provider/Tool均有exact outcome；该条件不能被新Source写入简单跳过。普通Tool outcome在已有request下允许晚到结算，Source/display的新写入不具备同一已接受活动凭据，这是下一步完整提交契约必须解决的范围。

当前只保存调查证据与测试参数正确性修订，不改变生产行为，也不把4个失败合同标成通过。后续须复用既有canonical writer/permission receipt建立完整结果提交与恢复投影，并同时验证各公开入口、真实重启、串并行及多项目。没有阻塞于用户授权，持续goal继续active。

381原聚焦合同补全必传参数后29306 exit0，7测试15断言。四份完整阶段数据、两份实际probe源与三份失败/工具故障日志均按精确完整字节gzip归档，原始文件私有保留。文档与架构检查通过；生产修复仍未达成。
