# 原营销专家团分页反馈验收

[方案与Recall](../../records/2026-10/2026-10-25-expert-word-feedback-recovery.md)。延续已关闭的真实营销Task，在同一个隔离项目和数据库中通过正式消息测试完成后修订；原310次加本轮最多50次，保持gpt-6.1-sol流式请求。

原Task实际追加轮次失败，未完成分页修订；[真实失败页面](01-feedback-budget-terminal.png)、[最终Task及文件核对](original-task/verification.json)、[原read错误](original-task/tool-failures.json)和[真实参与者与工具时序](original-task/message-tool-timeline.json)保留了完整因果证据。更早阻塞是项目外renderer读取违反Task精确根目录，随后用完原310次之外的50次。当前MD与DOCX仍是原字节，只有生成器发生中间修改；[原始差异](original-task/partial-generator.patch)不代表新版Word已经生成或发布。

[原启动前状态](original-task/task-before.json)与[本轮失败状态](original-task/task-after.json)保留同库CLI重启、epoch1完成及epoch2失败。全部新请求均为gpt-6.1-sol流式，见[真实请求与reader](original-task/provider.json)；[原生结算](original-task/native-host-settled.json)、[launcher原退出](original-task/launcher-child-exit.json)、[凭据目录退休](original-task/retirement.json)确认服务完整关闭且源保持。

修正验收准备后新增的[全新Base文档修订用例](base-case/README.md)已在92/360次完成。正式两个资源与当前文件完整字节相同，全文81块/44表格行相同，五页真实渲染经独立审阅及主agent逐页复核；五份实际artifact_read图片回执也已核对。服务正常关闭且临时authority已退休，不能用本用例覆盖原失败。

[02-reading-document.png](02-reading-document.png)是实际同正文阅读版，[03-base-task-completed.png](03-base-task-completed.png)是本轮完成页面，[04-final-delivery-files.png](04-final-delivery-files.png)是Completed状态下恰好两个正式文件卡片。[checker/](checker/README.md)冻结实际运行与导出源码，包含准备和导出工具修正。

旧规范内容、已知分页问题及原始交付证据见[上一轮真实记录](../2026-10-24-expert-steering-recovery-cases/README.md)。本轮未修改生产机制；平台通用Word能力与原营销Task同Session修订成功仍不能由本次Base实例推导。
