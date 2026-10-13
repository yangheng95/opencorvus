# 390 MCP内容边界证据

本批已完成共享物化修复、正式后台红绿、真实 GPT-6.1 Sol Task、桌面人工复核、实际下载和原 owner 正常关闭。范围是 Task 内 default MCP 的资源引用与 package MCP 的空 CSV/音频结果；不代表模型听取音频、链接内容读取、worker、普通 Chat、MCP App 或 prompt-parts 输入路径已验收。

[完整规格与历史](../../records/2026-10/2026-10-13-mcp-content-boundaries-390.md)记录根因、所有调用点、公开协议及精确映射。生产仅改共享 `materialize.ts`，保留实际原content、失败语义、附件归属和既有 Provider 传输限制。

## 正式后台

- [改前红测](backend/before.log.gz)：22 pass /6 fail /95断言，exit1；失败为真实未物化内容和应有解码错误合同。
- [改后绿测](backend/after.log.gz)：35 pass /206断言，四指定文件全部exit0；包含真实官方SDK回环、实际附件存储、投影结果与Provider边界。
- [核心typecheck](backend/typecheck.log.gz)、[文档检查](backend/docs-check-after.log.gz)均exit0；[runner关闭](backend/runner-cleanup.json)独立记录隔离根回收。
- [初始协议探针观察](backend/probe-observation.json)、[探针日志](backend/probe.log.gz)、[短期owner关闭](backend/closure.json)保留原缺陷与已有通路对照；探针通过不是修复或端到端成功的替代。

## 真实运行与内容证明

scope `mcp-content-boundaries-390-live-01-ce6b34bf-2656-48b0-a06a-70e9eaea3990`；Task `tsk_g00VXvSRD400ocgErO7w`，项目 `prj_h4Io1mTN9eWK4wixcEIn`，root `ses_-zUS4XYfizzTsgqUuZu6`，scheduler `ses_-zUS4XXq0zzrQF2DPDnp`。项目默认Base，正式CLI显式安装包 `qa/content-boundaries-390`。

| 证据 | 能证明的事实 |
| --- | --- |
| [真实用户请求](live-attempt-01/task-request.txt)、[CLI接受](live-attempt-01/task-accepted.json)、[包安装](live-attempt-01/package-import-receipt.json)、[Base配置](live-attempt-01/project-default-fact.json) | 正常配置与正式Task入口；没有Host gate或假工具消息 |
| [预检](live-attempt-01/provider-run__evidence__preflight-ready.json)、[配对stage元数据](live-attempt-01/provider-run__evidence__provider-pair-staging.json) | 凭据usable、完整catalog projected、实际Sol/stream一致；无凭据正文 |
| [公开输入](live-attempt-01/public-results.json)、[SDK真实调用](live-attempt-01/mcp-calls.jsonl) | 三个MCP各恰好调用一次，公开输入与服务实际返回 |
| [独立checker](live-attempt-01/check-live.ts)、[通过回执](live-attempt-01/live-check.json)、[canonical](live-attempt-01/live-canonical.json.gz) | Task completed/inactive、真实complete_task、durable原content精确一致、正文及规范附件归属正确、实际存储0/60字节 |
| [最终Provider审计](live-attempt-01/provider-live__mcp-content-boundaries-390-live-01-final-provider-audit.json.gz) | 累计11请求，全部gpt-6.1-sol、streaming、HTTP200、settled/EOF |
| [可见回答](live-attempt-01/visible-answer.txt) | 原文、records0、0/60字节和所有链接字段，以及明确的audio/wav传输限制 |
| [root下载检查](live-attempt-01/download-check.json)、[独立逐字节检查](live-attempt-01/download-bytes-check.json) | 页面真实下载文件与公开样本精确相等；文件字节结论不是模型自述 |

公开0字节CSV的[预期样本](live-attempt-01/expected-empty.csv)、[实际AttachmentStore文件](live-attempt-01/actual-stored-empty.csv)、[页面下载](live-attempt-01/downloaded-empty.csv)分别保留；60字节静音WAV的[预期样本](live-attempt-01/expected-silent.wav)、[实际存储](live-attempt-01/actual-stored-audio.wav)、[页面下载](live-attempt-01/downloaded-audio.wav)同样分别保留完整字节。它们仅证明文件交付，不表示模型听取或音频typed transport已启用。

## 页面人工复核

root在真实tab27展开结果、点击两次下载、阅读完成答案，已逐张人工查看以下四图。页面于2026-10-13T10:56:30.087Z正常关闭，无UI自动化测试。

- [空CSV结果](live-attempt-01/empty-csv-result.png)：成功原文、records0和实际下载入口。
- [音频结果](live-attempt-01/audio-attachment-result.png)：成功原文与音频附件下载入口。
- [资源引用字段](live-attempt-01/resource-link-fields.png)：URI/name/title/description/mimeType/size0保留。
- [完成答案](live-attempt-01/completed-answer.png)：Completed与真实字段/字节/音频传输限制。

## 原owner关闭与安全边界

原native物理截止11:00:35.929Z，MCP固定截止11:00:06.173Z，均未延长。root发PageClosed后，MCP在10:56:55.661Z关闭，42个SDK server全部fulfilled；native在10:56:58.343Z正常exit0，output drain与request cleanup齐全，10:57:01.471Z精确删除复制auth/models。三个实际exec句柄正常join exit0。

[MCP关闭](live-attempt-01/mcp-closed.json)、[native物理与配对清理](live-attempt-01/provider-live__mcp-content-boundaries-390-live-01-physical-terminal-and-pair-cleanup.json)、[原句柄join](live-attempt-01/owner-handle-joins.json)、[独立进程/端口/复制路径观察](live-attempt-01/independent-closure.json)共同记录完整收尾。[NativeService资格回执](live-attempt-01/provider-live__mcp-content-boundaries-390-live-01-qualified-surface-completion.json)只证明native/provider资格，实际业务Task由独立checker证明。

[明确allowlist与凭据扫描清单](credential-scan.json)记录80项证据；加本README及清单共82文件。文本大文件和日志以gzip保存，四张root人工复核PNG独立保留，只包含公开0/60字节数据。没有复制runtime、SQLite、models目录、auth或其他任务文件；CredentialRedactor逐项扫描已知源凭据为0命中，源配对元数据与stage时一致。归档辅助脚本首次误将root下载checker定位在live子目录，实际在scope父目录；修正精确路径并仅对已有同字节归档做一致性确认后重跑exit0，没有覆盖真实运行事实。
