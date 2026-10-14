# 408 本批实现、真实页面与原检查证据

[本批 Recall 与根因方案](../../../records/2026-10/2026-10-14-grant-decision-recovery-408.md)。`manifest.json` 记录每个原来源、存储位置和字节数；文本以 gzip 保存，桌面 JPG 保持原格式便于直接查看。存储回读只核对证据身份，不代替功能验收。

后端以唯一权限图 reader、真正决定 slot 和赢家 outbox 收敛批准复用；版本2追加中性历史索引，保留原授权及执行身份。现有旧连接的物理 WAL 保护有正式测试和独立进程证据。`backend/implementation/review/HANDOFF.md.gz`、`HUMAN-AUDIT.md.gz` 给出聚焦 103 tests / 540 expects 的去重范围与完整限制，原失败及修正前后来源都保留。

真实开发 `/ui` 页面经直接交互和人工截图复核：旧真实 producer 的原9行权限与2份结果完整保留，实际版本1备份90表可重新读取；冷打开原已完成会话不再产生幽灵批准。新 Main 两轮读取保留完整 CSV 与最终回复，第二次拥有自己的决定 slot；项目 Memory 实际 revision1→2且待处理数0。独立真实 Task 的待批准标题、已回应历史和中英文往返、中文设置时间线与原始原因详情均人工复核。

Task 读取项目目录外文件受到实际 `TaskProcessBoundaryError` 拒绝，controlled Provider 未提交完整任务报告；这组页面证明批准投影/渲染和错误事实，不证明模型任务完成。首次 `current-after02` 保留 phase 渲染错误和到原 close reserve 的 exit1；修复后 `current-visual03` 真实新批准转换、页面关闭、自身 Task 取消、正常 service exit0及全部 joins 已完成。旧 Memory retry_wait 记录未追写或伪称修复。

后端正向契约、实际 HTTP/OS 进程与 UI 人工复核是不同证据。没有新增或运行 UI 自动测试。没有本批 GPT-6.1 Sol、真实凭据或外部 ACP/Channel 客户端视觉验收；自动 provenance/晚到 Asked 路径以后台合同为证，不合成 UI 交互。文件 alias/custom VFS、旧 compiled Bun 与真实提交后解锁失败未覆盖。

证据排除 DB/WAL/SHM、auth、models目录、实际运行配置、完整 Provider 消息、私有 UI 构建 bundle。只保留受控公开 CSV、实际运行原日志/回执、源码及截图；运行时数据仍在自有测试目录中，未整体导入仓库。

可直接查看的关键截图：

- [旧会话原执行及实际索引时间](desktop/d1/legacy-after01/screenshots/06-operation-and-index-en.jpg)
- [新会话第二次完整输出及最终回复](desktop/d1/current-after02/screenshots/04-second-full-final.jpg)
- [实际新 Task 的中文批准转换](desktop/d1/current-visual03/screenshots/05-fresh-resolved-zh.jpg)
- [中文时间线](desktop/d1/current-visual03/screenshots/06-audit-timeline-zh.jpg)
- [中文标签下的完整原原因](desktop/d1/current-visual03/screenshots/07-raw-reason-details-zh.jpg)
