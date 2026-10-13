# 393 用户MCP资源与公开Session附件证据

本批后台62项/351断言通过。scope04完成正常Global Chat首条、公开Session资源附件续聊、真实GPT-6.1 Sol流式答复、桌面人工复核、实际CSV下载及原owner收尾。前三次scope的失败或不足均独立保留；不能把它们累计包装成一次成功。

[完整规格与Recall](../../records/2026-10/2026-10-13-mcp-user-resource-input-393.md)记录两项根因：公开Session未绑定已验证项目，以及用户MCP资源错误排除空text/blob。生产修复4文件；UI、ACP、MCP App、raw Base64 decoder、公共schema和授权规则没有改动。

## 正式后台

| 阶段 | 原证据与结果 |
| --- | --- |
| 首轮红测 | [before.log.gz](backend/before.log.gz)，5 pass/8 fail/35断言，[exit1](backend/before-exit.txt)。包含新测试owner在活动Instance内部销毁导致的SuppressedError，原错误未丢弃。 |
| 修正测试owner后的确认红测 | [before-confirmed.log.gz](backend/before-confirmed.log.gz)，5 pass/9 fail/36断言，[exit1](backend/before-confirmed-exit.txt)。真实目标错误为项目绑定/空资源。 |
| 新公开输入绿测 | [after.log.gz](backend/after.log.gz)，14 pass/124断言，[exit0](backend/after-exit.txt)。真实SDK、公开Hono handler→SessionProcessor→受控流式Provider及实际存储，不能称为真实模型。 |
| 关联五文件 | [related.log.gz](backend/related.log.gz)，48 pass/227断言，[exit0](backend/related-exit.txt)。16/100物化、5/78投影、2/7provenance、12/21Provider边界、13/21公开请求身份。 |
| 检查与关闭 | [typecheck](backend/typecheck.log.gz)、[docs348/26](backend/docs-check.log.gz)、[格式检查](backend/format-check.log.gz)、[runner退出/清理](backend/runner-cleanup.json)。 |

三份生产原像为[materialize](source-preimage/materialize-before.ts.gz)、[parts](source-preimage/parts-before.ts.gz)、[session route](source-preimage/session-route-before.ts.gz)。正式代码与新测试由主提交保存；这里不复制共享索引前像。

## 四次真实scope的明确边界

| Scope | 实际结果 | 核心证据 |
| --- | --- | --- |
| 01 | 程序化裸Session后台通过，7次Sol流200/EOF；目标会话没有产品导航入口，页面只见preflight，不算目标UI或下载通过。首次缺MCP connect返回404，合法连接后同Session/messageID/body一次恢复成功。 | [原404](live-attempt-01/public-message-response.json)、[原failure](live-attempt-01/public-message-failure.json)、[连接事实](live-attempt-01/mcp-connect-receipt.json)、[第二次独立成功](live-attempt-01/public-message-response-attempt-02.json)、[checker](live-attempt-01/live-check.json)、[仅导航边界图](live-attempt-01/screenshots/ui-navigation-boundary.png) |
| 02 | 正常Global Chat首条完成，5次Sol流200/EOF；helper把项目GET/config误当Session effective Base而失败，续行在原180秒guard被拒，第二条附件消息未提交。仅导航图。 | [真实202](live-attempt-02/global-chat-start-response.json)、[真实首条](live-attempt-02/global-chat-first-completed.json)、[原sender失败](live-attempt-02/send.log.gz)、[预留guard](live-attempt-02/continue.log.gz)、[仅初始导航](live-attempt-02/screenshots/initial-chat-only.png) |
| 03 | preflight Provider overloaded失败；无业务/无页面。两请求虽HTTP200，但仅1 EOF，另1错误后清理aborted，**不算成功**；launcher exit1。 | [原failed.json](live-attempt-03/native/evidence/failed.json)、[原Provider audit](live-attempt-03/closure/final-provider-audit.json.gz)、[原sender日志](live-attempt-03/send.log.gz)、[最终清理](live-attempt-03/closure/physical-terminal-and-pair-cleanup.json) |
| 04 | 正常Global Chat首条及公开Session附件续聊成功；13有序Parts、2空text、3真实SDK读取、0/32/34字节、9次精确Sol流200/EOF，完成目标UI和实际下载。 | [真实202](live-attempt-04/global-chat-start-response.json)、[公开第二请求](live-attempt-04/public-message-request.json)、[真实回答回执](live-attempt-04/public-message-response.json)、[独立checker](live-attempt-04/live-check.json)、[最终Provider audit](live-attempt-04/closure/final-provider-audit.json.gz) |

scope01的[checker隔离原错误](live-attempt-01/checker-isolation-first-failure.txt)是辅助脚本错误添加test-only HOME标记；修复撤掉该标记，沿原runtime。scope02的raw项目dynamic/Session overlay Base差异留独立395调查，393没有强写profile或修改metadata。helper纠正都针对实际协议前置/验证层次；没有为了模型通过而更改产品、host gate、消息身份或原预算。

## Scope04实际对象与内容证明

Chat/Session `ses_hy8M8XN2Rne4fRPQQSPD`，项目`prj_h4GNrUzySvBzLq1B98xi`，初始用户`msg_h1UwLBZv7i44OtOQAdB7`，附件续聊用户`msg_fb59ba41-541e-447c-9a6f-a60e4213a5fd`，最终assistant`msg_g0VXw9vmB00Mt2XDoLH3`。

正常Global Chat202分配独立项目；后续header与AttachmentStore使用其真实directory/projectID。首条只建立自然Chat，第二条明确经本批修复的公开`/session/:id/message`，没有Task/Mission包装、内部byteProject字段、持久化metadata补丁或合成完成消息。[配置事实](live-attempt-04/project-default-fact.json)分别记录项目raw与Session有效overlay，不把两者混为一谈。[MCP连接前置](live-attempt-04/mcp-connect-precondition.json)、[实际SDK reads](live-attempt-04/mcp-read-calls.jsonl)、[原资源内容](live-attempt-04/public-resources.json)形成输入证据。

[canonical持久化](live-attempt-04/live-canonical.json.gz)、[checker原日志](live-attempt-04/check.log.gz)和[可见完整回答](live-attempt-04/visible-answer.txt)保留两条用户输入、真实assistant与工具。实际答案给出MOSS-393-PUBLIC、Maple3/Iris4合计7、Notebook7/Pen5合计12，并区别“资源正文为空”与Host读取提示、空CSV0行且无表头/记录。模型复述不作为文件字节证明。

| 文件 | 原公开样本 | 实际AttachmentStore | 真实页面下载 |
| --- | --- | --- | --- |
| 空CSV 0 bytes | [sample](live-attempt-04/public-empty.csv) | [stored](live-attempt-04/actual-stored/public-empty.csv) | [download](live-attempt-04/downloaded/download-empty.csv) |
| 混合资源CSV 32 bytes | [sample gzip](live-attempt-04/public-mixed.csv.gz) | [stored gzip](live-attempt-04/actual-stored/public-mixed.csv.gz) | [download gzip](live-attempt-04/downloaded/download-mixed.csv.gz) |
| 普通上传CSV 34 bytes | [sample gzip](live-attempt-04/public-upload.csv.gz) | [stored gzip](live-attempt-04/actual-stored/public-upload.csv.gz) | 本scope未单独下载该文件 |

[root下载比较](live-attempt-04/download-byte-review.json)与[归档逐字节复查](allowlist-and-scan.json)分别证明真实下载及实际存储匹配；后者还复核scope01三份存储，共8组。gzip保留CSV的CRLF原字节，避免Git文本换行正规化。没有采用自行重算摘要代替行为验收。

## 桌面人工复核

root在真实tab35自然选择Global Chat，看到两条真实用户消息、三份CSV cards、完成中文答复和规范链接，点击空CSV与混合CSV下载后关闭页面。截图实际为Code模式中的Chat，Base与openai/gpt-6.1-sol可见；不是MCP输入选择器验收。[root视觉记录](live-attempt-04/visual-review.json)及[完整页面文本记录](live-attempt-04/page-ax.txt.gz)只作为截图辅助，不能代替视觉查看。

- [资源原文与三附件下载](live-attempt-04/screenshots/live-resource-cards-downloads.png)
- [答案表格与7/12合计](live-attempt-04/screenshots/live-answer-table.png)
- [空资源解释与引用](live-attempt-04/screenshots/live-resource-answer.png)

root已人工查看三图；归档agent也实际读取三张PNG人工复查内容及公开数据边界。没有运行UI自动化测试。

## 原owner关闭与凭据边界

四scope都使用独立600000ms原生物理owner、20累计请求、180000ms inactivity，未延长原截止。每次MCP独立600000ms/idle0，原stop-file与terminal均保存。scope04 native在13:46:30.299Z正常exited/0，physical/outputDrain/requestCleanup均true；13:46:34.413Z复制的auth与完整models均删除，端口释放。MCP也是owned-stop-file/全部close成功/exit0。

- scope01：[native+pair](live-attempt-01/closure/physical-terminal-and-pair-cleanup.json)、[MCP](live-attempt-01/mcp-terminal.json)、[原handles](live-attempt-01/handle-joins.json)。
- scope02：[native+pair](live-attempt-02/closure/physical-terminal-and-pair-cleanup.json)、[MCP](live-attempt-02/mcp-terminal.json)、[原handles与两个失败发送器](live-attempt-02/handle-joins.json)。
- scope03：[native+pair](live-attempt-03/closure/physical-terminal-and-pair-cleanup.json)、[MCP](live-attempt-03/mcp-terminal.json)。原failed.json当时的cleanup未验证描述保留，后续最终回执单独证明清理。
- scope04：[native+pair](live-attempt-04/closure/physical-terminal-and-pair-cleanup.json)、[MCP](live-attempt-04/mcp-terminal.json)、[NativeService资格](live-attempt-04/closure/qualified-surface-completion.json)。

[root报告的03/04句柄结算](root-reported-handle-outcomes.json)明确标注来源；它不是归档agent独立观察进程的记录。NativeService资格只证明物理/Provider流，业务和页面分别由checker与实际UI证明。

## 归档范围与可外推限制

[显式allowlist/扫描/完整源→档案映射](allowlist-and-scan.json)收录247个复制证据条目。所有文本日志、较大JSON、源码原像和非空CSV已gzip；五张独立PNG含三张正式04图及两张明确标注未达成的历史导航图。它不包含auth/models正文、数据库/WAL、整个runtime、native/UI二进制、node_modules或无关共享文档前像。

原Provider audits由成熟runner的CredentialRedactor在运行时生成。归档阶段只做高信号token/私钥/JWT/Bearer和凭据字段模式检查，0命中；**没有读取任何真实凭据，不冒称再次按已知secret值扫描**。gzip逐份解压后与原公开证据精确比较。原owner/pair元数据的路径与大小是清理证明，不是凭据正文。

源码证据在[收尾后收集helper](helper-collected-after-close/LIVE-HELPERS.md.gz)以及各scope snapshot文件夹。`scripts-final-used`保留root采集目录原名，其中部分共享helper采集时已演进；不能把整个文件夹当作首次失败时启动原像。01另有当时[关闭后快照](live-attempt-01/helper-snapshot-after-close/send-session.mjs.gz)，原缺connect、原错误isolation和02错误Base断言源码分别独立保留。所有脚本只是证据，不能从归档目录直接当新验收runner执行。

本真实验收范围仅用户MCP资源输入与普通canonical附件的公开Session链，以及正常Chat显示/下载。data URL、file://二进制、重放/跨项目错误由正式后台测试覆盖；不外推为这些输入的真实模型/GUI验收，也不覆盖ACP、MCP App、媒体transport、Task/Mission/worker或完整资源选择UI。395配置层问题单独调查，393没有改变配置/授权策略。

[最终归档校验与逐文件清单](archive-verification.json)：共251文件，其中247份来自显式源allowlist、91份gzip全部解压并逐字节匹配原公开证据；本README与393spec的本地链接均逐项存在。全归档文本及解压文本的相同高信号凭据模式扫描0命中，未读取真实凭据。此检查不代替已单独记录的后台、模型、UI和物理owner验收。

Root交付前另用已有CredentialRedactor对全部文本（含gzip解压正文）进行真实已知凭据值/JSON/URL编码复扫，0命中；只在内存读取本任务原授权凭据，未复制或记录值。见 [Root安全复核](known-credential-scan.json)。原pattern扫描与归档manifest继续保留其自己的权限和采集边界。
