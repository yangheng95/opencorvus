# Venice 用量与共享后台停机证据

[Recall、修改前根因与方案、横向审计及当前状态](../../records/2026-10/2026-10-13-venice-stream-usage.md)。主agent亲自查看全部归档截图和关键原始输入/输出。无UI自动化；没有在线Venice凭据或请求，本地声明协议输入不是其推理或账单。

| 实际验收对象 | 修前证据 | 修后证据 |
| --- | --- | --- |
| 请求与共享账本 | [修前协议/SDK/HTTP](before-protocol-ledger.json)：2调用2504 Token、0.002549 USD；converter-only路径与严格wire探针分开声明 | [严格wire后态](after-protocol-ledger.json)：2调用2058 Token、0.002329 USD，输入1392/文本366/推理80/缓存读200写20 |
| 真实桌面 | [英文分量](before-composition-en.png)、[模型表](before-models-en.png) | [英文当天总览](after-overview-en.png)、[非零区间与完整分量](after-heatmap-en.png)、[模型表](after-models-en.png)、[中文分量](after-composition-zh.png)、[中文模型表](after-models-zh.png) |
| 真实外层关闭 | [单项目](background-before-1-observations.json)、[双项目](background-before-2-observations.json)：旧Server stop到gate后没有取消；仅测试外部释放完成安全清理 | [单项目](background-after-1-observations.json)、[双项目](background-after-2-observations.json)：正常stop由现有Instance owner取消并完成文件write/sync/close，各原exec exit0 |
| 正向功能checker | [旧wire失败](contracts-before.log)、[旧背景停机失败](background-contract-before.log)；[首轮checker生命周期错误](contracts-after.log)独立保留 | [Venice/依赖/归一化](contracts-combined-final.log)、[背景/Runtime/Task](background-contract-after.log)、[最后物理顺序4测试23断言](background-order-final.log)、[启动/调度/Mission恢复](shared-recovery-matrix.log)；11文件95测试430断言 |
| 类型与当前依赖 | [Bun正式补丁准备](patch-prepare.log)、[提交补丁](patch-commit.log) | [frozen install](frozen-install.log)、[backend typecheck](typecheck-final.log)、[AI runtime checker](ai-runtime-final.log) |
| 必要真实模型 | [Sol-01检查器入口失败](sol-1-failure.json)、[Sol-02尾斜杠404](sol-2-failure.json)、[Sol-03已结束的流](sol-3-failure.json)、[Sol-04错误200期望](sol-4-failure.json)；各原exit1和pair清理保留 | [Sol-05可用凭据/精确目标预检](sol-5-preflight-ready.json)、[活跃Memory真实字节](sol-5-memory-reading-before-stop.json)、[同一reader aborted与durable retry_wait](sol-5-sol-memory-stop-qualified.json)、[最终出站观察](sol-5-provider-audit.json)、[actualexit0/port释放/成对清理](sol-5-physical-exit-pair-cleanup.json) |

当前UI复用第五批已build私有前端，Usage源码本批未修改；生产后端使用本批唯一vendor补丁。截图来自真实 `/ui`、实际生产stream wrapper/账本/HTTP，不直接插入UI或数据库造图。原before/after页面scope分别PID71720/65328，原exec各exit0，[物理复核](owned-physical-receipt.json)列出自有PID及端口。测试、原生probe与真实Sol各自的owner/terminal/exit回执分别保留，空队列或score不代替物理事实。

Sol-05/PID66224的四个实际请求模型均gpt-6.1-sol且stream=true：预检Memory/Chat正常EOF，主Memory HTTP200且reader aborted；主Chat在收到Response之前取消、fetch_failed，HTTP与reader身份未知。不能把第四个请求算作成功响应或捏造reader证据。持久pending1/retry_wait证明保留当前输入，完整自动重试、线上多项目业务矩阵和发布包编译不在本次实际Sol证据内。父进程实际exit0后删除复制auth/models，source凭据未修改，内容未归档。

可复核独有运行器：[本地协议页面runtime](venice-page-runtime.ts.txt)、[修前native背景probe](background-before-probe.ts.txt)、[修后probe](background-after-probe.ts.txt)、[当前Sol checker](sol-memory-stop-checker.ts.txt)、[独有launcher](sol-launcher.ps1.txt)。它们是声明参与者与验收源码，均非UI自动化测试；凭据只通过成熟stageDiagnosticProvider与内存redactor。原native launcher路径错误见[独立失败](background-launcher-failure.log)，已修工具并在新v3重跑，不能把错误隐藏成成功。

此前分工的6测试30断言只覆盖旧input/output合同，不能证明total/cache/wire正确；published-converters/wire记录保存其发布包差异。第五批正常push/delivery回执保留前序身份，本批当前提交与正常push以原实际工具回执确认，不创建Release/tag/PR。
