# 文件读取提示证据

对应[分析与方案](../../records/2026-11/2026-11-09-file-read-error-presentation.md)。本人独立操作隔离页面，实际系统/API错误和人工截图复核；零子agent、模型、凭据与UI自动化。

- 01/02：真实400具名错误仍用旧通用标题的基线。
- 03/04：英文新标题/建议，04为Retry完整呈现的稳定截图。
- 05/06：中文新标题/建议及同一400原Details/路径/请求编号。
- 07：同一自有alias指向缺失目标，实际404保留原缺失提示。
- 08/09：实际自循环系统ELOOP→500/UnknownError，原中文/英文通用提示保持。
- 10：同一alias恢复范围内目标后真实Retry读取原Unicode正文。
- physical-loop-error.json：实际Node.js realpath系统错误，非fixture错误注入。
- before-api-and-bytes.json/after-api-protocol-bytes.json：真实400/正常200、完整352操作路径/schema保持、36/38/47原字节和原链接恢复。

10张截图已逐张实际呈现并本人查看；类型/双语2925键/正常UI build54.22秒/文档为辅助，没有UI自动化。UI源码只派生titleKey/hintKey，后端/SDK保持；页面64/65关闭、服务64136/99465正常shutdown与原session退出0。模型授权未收到，高级来源/慢读取全部矩阵未验。
