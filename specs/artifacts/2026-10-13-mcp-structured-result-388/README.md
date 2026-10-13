# 388 MCP structured result evidence

[方案、Recall及完整边界](../../records/2026-10/2026-10-13-mcp-structured-result-388.md)。本档案证明通用MCP结构化正文和合法空文本资源的共享物化修复，包含正式后台红绿、一次真实GPT-6.1 Sol Task、真实页面截图人工复核以及正常物理收尾。普通Chat、worker、Mission、重启恢复、MCP App页面不外推。

## 后台检查

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 首轮准备 | 保留测试ZodRecord输出schema准备错误；不能全部当作产品红测 | [原日志](backend/before.log.gz) |
| 正式红测 | 4 pass /11 fail /96断言，exit1；8个物化、2个真实MCP投影及1处旧期望准确失败 | [确认红测](backend/before-confirmed.log.gz) |
| 同环境正式绿测 | 15 pass /0 fail /130断言，Bun1.3.14，exit0 | [绿测](backend/after.log.gz) |
| 声明版本复验 | 同15项/130断言，Bun1.4.0，exit0 | [最终绿测](backend/after-bun140.log.gz) |
| 核心类型检查 | tsc --noEmit，exit0 | [类型检查](backend/typecheck.log.gz) |
| 文档检查 | 348 ops /26 groups，exit0 | [文档检查](backend/docs-check.log.gz) |
| 测试owner收尾 | 四轮精确运行目录由正式runner正常回收 | [清理回执](backend/runner-cleanup.json) |

新测试8项是真实官方SDK回环tools/call→生产物化→实际附件存储。扩展包装5项使用5个项目/Task、8个Session、16次producer执行和8个完整保存文件，检查真实MessageStore completed/output/metadata。普通文本行/字节预算与内置Browser/Computer身份合同继续通过。后台建立的消息仅为测试准备，不冒充自然模型交互。

## 真实 Attempt01

业务Task为 `tsk_g00VXvCmcH00E5YceOHj`，项目 `prj_hhKbA4lObfeHpAZb2F4f`，root Session `ses_-zUS4nDEezzn6QUvUul0`，scheduler Session `ses_-zUS4nCBizz8V6ef3AzS`。项目默认Base保留，正常CLI精确选 `structured-reports-388` 包；包同时投影default public-summary与package empty-note/report-archive能力。实际模型自然skill、搜索、调用三份报告、Read真实恢复文件、可见回答、manage_task complete_task。

- [真实用户请求](live-attempt-01/task-request.txt)、[CLI接受回执](live-attempt-01/task-accepted.json)、[正常包安装](live-attempt-01/package-import-receipt.json)、[项目默认与MCP配置](live-attempt-01/project-default-fact.json)。
- [独立checker结论](live-attempt-01/live-check.json)、[规范数据库读取结果](live-attempt-01/live-canonical.json.gz)、[checker源码](live-attempt-01/check-live.ts)。三工具为completed；结构化字段、混合原文和空资源顺序均正确。
- [公开报告样本](live-attempt-01/public-results.json.gz)、[预期完整存档](live-attempt-01/expected-archive-output.txt.gz)、[实际保存文件](live-attempt-01/actual-tool-output.txt.gz)。完整JSON为178967字节，checker逐字节核对及精确Task/Session路径；真实Read读取所需前部字段，不声称整份长单行进入模型。
- [实际Provider审计](live-attempt-01/live-provider-audit.json.gz)与[物理退出后最终审计](live-attempt-01/provider-live__mcp-structured-result-388-live-01-final-provider-audit.json.gz)均为12条目标GPT-6.1 Sol流式HTTP200/EOF请求。[预检](live-attempt-01/provider-run__evidence__preflight-ready.json)分别确认凭据可用、目录已投影和实际模型一致。

业务checker于2026-10-13 17:52:20.140 +08:00通过。原NativeService截止17:58:52.170、累计20请求和180秒实际无活动预算未延长。NativeService资格只证明物理/Provider服务；实际Task结论来自独立规范数据checker及页面。

## 真实桌面证据

root在独立tab24实际交互、展开工具组并逐张人工检查，随后明确关闭自有页；执行agent也复看以下4张原图。没有UI自动化、DOM断言或像素分数。

| 截图 | 直接证明 |
| --- | --- |
| [Completed答案](live-attempt-01/task-completed-answer.png) | 可见答案包含LILY-388-SUMMARY/7、原文Public note: available.及note、IRIS-388-ARCHIVE/2400；Task Completed |
| [Default结构化摘要](live-attempt-01/default-structured-summary.png) | 真实default MCP结果正确呈现两个结构化字段 |
| [空资源与结构化note](live-attempt-01/empty-resource-and-structured-note.png) | 原文本和JSON同时可见，合法空资源未将调用变为错误 |
| [恢复路径与Read首部](live-attempt-01/structured-output-recovery-head.png) | 完整输出恢复路径、真实Read及IRIS/2400前部字段清楚可见 |

`structured-output-recovery.png`是未滚到头部的中段样本，未选作关键截图，不能替代最后一张。

## 原owner与凭据配对收尾

scope为 `mcp-structured-result-388-live-01-e3b42b40-3b3b-45c6-a224-da6b4b24b7d9`，应用18506，Host42824/Target78344；独立MCP18507/PID84740。root PageClosed后按原owner正常shutdown，没有kill用户或其他进程。

- [Native物理退出/请求清理/配对删除](live-attempt-01/provider-live__mcp-structured-result-388-live-01-physical-terminal-and-pair-cleanup.json)：17:56:45.736物理exit0并排空输出、清理请求；17:56:49.275完成复制auth/models成对移除。
- [MCP正常关闭](live-attempt-01/mcp-closed.json)：17:56:33.399关闭46个SDK server，全部fulfilled。
- [三个实际owner句柄join](live-attempt-01/owner-handle-joins.json)：Native launcher30513、shutdown12511、MCP81613均exit0；[独立关闭观察](live-attempt-01/independent-closure.json)确认18506/18507已释放、MCP原进程退出、复制凭据对已移除。
- [NativeService资格回执](live-attempt-01/provider-live__mcp-structured-result-388-live-01-qualified-surface-completion.json)确认12条EOF请求与正常物理完成。

## 后续辅助服务修复，非第二次模型运行

原 [MCP服务日志](live-attempt-01/mcp-service.log.gz)保留Bun默认10秒空闲警告；没有请求ID，不能反推原警告具体属于哪个HTTP请求。真实三次tools/call、规范结果、模型EOF及owner join仍按各自原始事实通过。

官方SDK为GET创建可保持空闲的独立SSE通知流。经root授权，先保存 [实际模型运行的MCP源码](live-attempt-01/mcp-service-live.ts)，再对自有辅助服务增加明确idleTimeout:0；[修复后的源码](post-live-helper/mcp-service-fixed.ts)仍保留固定600秒owner寿命，不是原scope使用的版本。

[后续短期协议探针](post-live-helper/mcp-idle-probe.ts)、[结果](post-live-helper/mcp-idle-probe.json)和[日志](post-live-helper/mcp-idle-probe.log.gz)单独证明：10秒配置下12.5秒出现socket-closed错误；0配置下仍等待，并在正常SDK close/http.stop后得到HTTP200/EOF，owner全部fulfilled、exit0。这不是模型复验。回执port在stop后读取为0，表示已停Bun服务属性，不用于断言实际绑定端口。未改变产品或共享runner。

## 归档安全与范围

[明确清单与凭据扫描](credential-scan.json)列出73个允许文件；加本README与扫描回执共75文件。已用CredentialRedactor对全部文字（压缩前）及图像字节扫描，已知凭据零命中，并核对当前源凭据文件metadata仍与本次stage源一致。只保存公开样本、派生证据、选定日志和4张人工复核PNG，不保存auth/models内容、运行数据库、完整runtime树或运行二进制。大文字和日志gzip压缩，源码只读参考。

唯一生产修复仍是共享MCP物化函数；本档案不声明重新发布版本，也不代替主agent的范围提交、推送和共享索引更新。
