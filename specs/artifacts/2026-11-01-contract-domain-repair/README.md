# 输入语义边界：根因、共享修复与真实多任务复验

用户要求追清旧归档误拒和通用验证漏检，从通用层修复并继续不同任务实测。本轮原根`D:/opencorvus-benchmark-runs/contract-domain-repair-e2e-20261101`，原R01–R05和旧错误程序保留，十题心跳仍暂停。

阅读[根因分析](ROOT-CAUSE.md)、[逐次故障清单](FAULTS.md)和[实施Recall](../../records/2026-11/2026-11-01-contract-domain-repair.md)。三次新执行已自然结束并消费原交付；准备witness不作为模型成果。

当前修复包括共享模型验证规则、公开完成说明、归档消费者的合法本机源路径维度，以及执行终态与固定输入相符的分离。没有手工修改旧归档程序，没有host业务gate或工具/模型路由旁路。

三次新真实执行：归档Task（原公开合同/原型/prompt）、HTTP文档下载Task、温度校准报告Coding Session。原三项归档消费者通过不回改；修后消费者保留原项并加入本机Path派生表示。每次真实Tool/Provider/CLI/数据都单独记录。

| 次序 | 入口与任务 | 最终原程序实际消费 | 过程故障 |
| --- | --- | --- | --- |
| R06 | Task归档，tsk_g00VZjH6bI00LSmU24SV | 四项相符，包括合法Windows本机source；最终布尔类型修复后仍四项相符 | 一次TaskProcessBoundaryError，后改项目内路径恢复；作者自测仍未直接覆盖本机source正向表示 |
| R07 | Task HTTP下载，tsk_g00VZjJNJk00aPMKO3pr | 三项相符；实际GET、保存字节、原ID/输出文本及receipt均相符 | 一次apply_patch旧上下文失配，读实际源码后恢复 |
| R08 | Coding温度报告，ses_-zUQGfYK9zzL1TFMvcI2 | 四项相符，包含正确native2/BELOW_ABSOLUTE_ZERO错误合同 | 21次工具均completed，无观察到的运行错误 |

原始Provider共101次gpt-6.1-sol请求，均streaming/HTTP200；94次canonical工具请求/结果均终态（92completed、2failed）。原执行器native0，21:49:14至22:06:17（Asia/Shanghai）；这不是活动小时或速度/费用基准。正常dispose及成对凭据副本清理成功，源凭据字节保留，未用完预算退休，无进一步模型调用。

主方检查器也修了两个实际漏洞：模型前唯一JSON数值helper误拒合法boolean，模型后workflow直接用Python相等又误收false/0错类型。两份完整错误programme在冻结初版消费者原先全过，统一到现有typed helper后分别检出；R06封存原件再消费仍全相符。初次模型消费、后验检查器修复/等价复验分开保留，不回填事前公平或改旧R04/R05结果。

最终复核把容差显式传入同一helper：归档/库存数字保持原精确比较，温度/预测保原1e-8；没有以共用比较器放宽另一字段合同。`precision-recheck/`保当前最终消费者一次复验：原R06四项相符，两份错boolean programme及另一个bytes多1e-9完整programme均被检出。前次模型后复验原件也保，没有第二次模型执行。

`runs/R06..R08/source/`为可读原源、原pyz和交接；`initial-consumer/`保真实输入、输出、argv、exit和独立预期；R06的`bundle-final-consumer/`在目录根保后验类型修复复验。`canonical-tools.json`来自关闭后生产SQLite的tool_part_request/outcome，`original-traces.zip`保完整原观察。`frozen/`是候选前公开材料/私有预期/实现；`final-consumer-implementation/`是模型后唯一当前消费者。`actual-provider-and-runtime-receipt.json`保脱敏请求投影/HTTP/清理事实，未保存凭据内容。

仓库为约2.7MB证据投影，不是完整workspace。三份完整先封项目及原生产DB在外部原根保，归档位置和真实大小见各run的`complete-project-location.json`及`export-receipt.json`。资源哈希只核真实不可变发布资源身份，业务正确性依据实际最终程序消费。

本轮证明旧误拒能被检查器检出，新自然归档交付与两个不同工作流在已测输入相符。没有手工补旧候选，没有第二次模型试验，没有总体故障率/提示唯一因果、任意输入安全性、统计成熟或彻底根治结论。50项聚焦后端测试、6项Python真实消费者测试及core类型检查通过；UI不在本轮范围。
