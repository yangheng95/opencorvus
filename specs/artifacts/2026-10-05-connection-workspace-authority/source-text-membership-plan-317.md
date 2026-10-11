# 317 补正空正文的传输成员契约

## Recall

用户持续要求单agent修复Sources与Rendering。316已推送9208d72ff4d4b767219d2a2cc72d1c73955cba8b，工作区干净，上一步是有修复/测试/真实截图的progress。继续同一目标，不新增agent，不暂停goal。

## 当前证据和待核实项

316末尾进一步阅读完整conversation/transport发现：projectConversationTransportPart只省略reasoning，普通text包括空字符串均原样传输。此前“空text与reasoning可能共同省略”的假设过宽，纯数据用例构造的空text缺席场景没有证明当前生产契约，必须修正，不能因测试通过继续保留。Session.updatePartImpl先持久化并发布Part，再由processor发完整字段；文字字段自身仍未按token持久化，不能因此清理全部字段。

已读MessageStore、Task子会话完整/增量路由、transport、Session Part写入/删除/Delta、316reconcile/资源观察原件、现有真实路由和纯数据测试。实际空text在Task HTTP载荷中是否保留，先以真实生产写入/读取确认；源代码目前支持保留。活动消息中一个已知为text的Part在后续读取中缺席，与空正文是不同事实。若保留旧text snapshot或字段，会把已撤回的文字带回，影响正文和来源之间的布局。

范围为同一共享reconcile，Task/Mission/Session子会话使用同一逻辑，Side的连接快照与事件规则不改。reasoning的传输省略和pending工具的真实未持久化契约继续保留；请求期间新事件按原对象引用保留。原正常流式、重试撤回、终态、目标隔离、整消息退出以及未知/未观察新事件均按316边界复核。未发现新的Host调度或执行轮次异常，不修改这些机制。

## 实施与验收

先在实际Hono Task子会话检查中确认空text保留，并使其收到真实未落盘delta后仍投影完整文字。再通过真实删除、保留旧Part事件及其字段、首次读取证明旧text被错误恢复。数据契约用例使用明确当前正文/来源输出，删除错误的“空text会省略”夹具，保留reasoning原契约。

确认后收窄reconcile的缺席例外：未出现在读取中且已知text的旧值应退休；已存在的Part仍保留未持久化字段。把316/current07的过宽说明明确更正并保留历史失败/纠正证据。聚焦检查、类型/构建和真实/ui18286截图人工复核，使用新资格检查后的全量305无凭据历史副本；不新建模型任务或成员，不使用UI自动化。当前文档检查、范围提交、fetch/merge和普通push后继续goal。

## 已取得直接证据

实际Session写入空text后，Task HTTP完整保留该Part；真实PartDelta经Bus观察但不落盘时，后续读取仍返回空text，投影保留接受的完整文字。删除同一Part且漏掉移除观察后，316reconcile错误带回旧文字。修复前实际8项中7通过/1失败，原执行器9147实际exit1。字段单独存在却没有类型snapshot的情况继续保守保留，不猜测其kind；它不能在没有基底Part时自己构造正文。

修复后64项服务数据/113断言与10项生产路由/78断言通过，后者原执行器12027实际exit0。类型59452、构建93607实际exit0。/ui18286四图已人工复核；自己的页86及原执行器21489结束（实际exit0），Native70420/Host75916独立结算与保护表回读通过。文档/架构检查通过。[完整证据和限制](source-text-membership-317/README.md)。范围提交与上游同步在最终交付前完成，goal继续active。
