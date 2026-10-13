# 385 能力搜索请求 metadata 保留

后台修复 **通过**，真实模型功能复验 **未达成**。

生产只在reveal-owner事务内完成ToolPart时增加 `metadata: current.metadata`，保留刚刚验证的不可变请求事实。没有放宽immutable request规则或修改并行Session/Permission代码。

- [检查汇总与凭据扫描](verification.json)：新增2项/35断言、关联8项/39断言、核心typecheck及范围检查全部exit0，已知凭据匹配0。
- [正式红测](before.log.gz)：0 pass / 2 fail，均实际进入CAS并报已有metadata被丢弃的冲突。
- [正式绿测](after.log.gz)：完成结果、当前projection、原call重放、跨进程重建及双项目并行归属。
- [关联检查](related.log.gz)：同进程/双进程CAS与Processor重放。
- [类型检查](typecheck.log.gz)与[范围差异](final-review.log.gz)。

真实模型证据与383公开报告任务共用，保留于[383档案](../2026-10-13-projected-output-authority-383/README.md)：attempt01为修复前真实共享metadata失败；attempt02为本地预检15秒超时；attempt03预检成功后因真实Provider返回服务器overloaded而在工具执行前结束。第三轮真实失败页已截图并人工查看，不能计作目标功能通过。三次owner均有独立正常物理收尾和凭据配对清理事实；后续需要新的正常模型运行验证大结果与read接续。

完整Recall、所有入口/occurrence/重试恢复/多项目横审与边界见[385方案](../../records/2026-10/2026-10-13-capability-request-metadata-385.md)。
