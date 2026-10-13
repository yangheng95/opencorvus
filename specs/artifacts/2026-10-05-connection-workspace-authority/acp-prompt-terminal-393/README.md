# 393 ACP提示结果

[Recall、影响分析与方案](../acp-prompt-terminal-plan-393.md)。单agent开发，未委托。

ACP普通提示和注册命令原来无条件end_turn，修前规范基线2pass/8fail。现统一从真实返回Message判断正常、输出上限、拒绝、取消和错误，关联本次输入及最终Message；usage使用规范total。请求错误保留原公开诊断；unknown command返回invalidParams，compact验证实际维护结果。

真实取消还揭示公共HTTP请求提前变为500。修复使用现有prompt owner capture和exact-owner finish，物理收尾后返回同input的实际取消Message。init既有boolean按completed-reply投影false；不合成assistant、不改全局取消writer、不按错误文案猜取消。

39项独立backend检查通过：14项官方ACP双端连接→实际产品HTTP→生产Session/Provider→本地可控流式服务；12项结果转换；13项既有公开输入、并行、恢复与幂等合同。原基线、夹具缺陷、第一版未处理共享取消、类型错误和后续修正日志完整保留。测试析构问题已按原资源所有权修复。压缩用例的失败有真实SessionControl记录，根因为保留窗口无可压缩材料，不是Provider故障；boolean false另有聚焦合同。

[运行事实复核](runtime-review.json) · [完整脱敏日志清单](checks/archive-receipt.json)。文档348操作/26组、19份架构索引和类型检查通过；旧ACP README中不存在的入口、测试和非流式说明已替换为准确入口及根spec链接。

本轮没有UI改动、UI自动化或外部模型调用，不能称编辑器视觉验收。运行前取消、跨进程取消/完整Task与Mission恢复、所有流式通知竞态和原Research Studio长历史仍未全部完成。整体goal保持active。
