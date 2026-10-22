# 已结算 Worker 生命周期证据

见[Recall、根因、实施与边界](../../records/2026-10/2026-10-22-settled-worker-lifecycle.md)及[evidence.json](evidence.json)。单开发agent，两个原已完成Task、四旧input恢复真实Error、六后续原completed事实保留。修复未来结算与历史分页恢复，并按canonical轮次顺序选择最新成员。

7张精选截图均实际呈现查看：旧Error与原Source/中断详情、All agents旧资源错误、新资源两个Task最新Completed、原来源复制。05/07私有原图虽命名含completed，内容为旧资源Error；归档before-latest-errors只作before，不冒充after通过。新资源由独立服务在原总请求上限和截止内捕获，页面实际模块身份已核对。

实际read_agent_message：四个原中断正文返回TaskEvidenceSourceError/TASK_EVIDENCE_SOURCE_INVALID，六份真实final按精确Message/Session/完成时间读取成功。两Task原输入/消息/Part全字段保持；已覆盖的pending memory退休有DocumentEnvelope revision12→13与真实occurrence依据。

5次实际Sol请求均原EOF；第一资源正常exit0，第二资源继承截止后deadline_exceeded/exit1，完整scope资格失败，未伪造public shutdown或正常退出。物理/output/request/精确出生及8份auth/models配对退休完成。schema3及完整源数据保持。

本轮不覆盖活跃新增Source时的连续owner/Rendering验收，该项继续。未新增/运行UI自动化测试，删除检索到的三项旧UI投影测试。
