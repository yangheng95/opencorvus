# 382 网页读取的语义空白保真证据

依据 [Recall、根因与实施记录](../../records/2026-10/2026-10-13-webfetch-text-fidelity-382.md)。本批只修复 `webfetch` 的统一输出边界：保留成熟转换器的格式和原生文本空白，继续使用原附件提取、输出预算、字符编码、HTTP（Hypertext Transfer Protocol，超文本传输协议）取消与来源合同。

## 功能与真实模型验收

- 正式隔离 runner 改前新增17例全部失败；修后17例、52断言通过。相邻输出、链接、编码、HTTP body及标题合同一共6文件、55用例、241断言已分别通过。
- 首次六文件复验 exit1，只因链接测试的一项旧期望仍裁掉转换器尾换行；按当前合同修正后，该文件14例、45断言复验exit0。原失败保留于压缩包的 `after.log.gz`，不把首次命令改称整体通过。
- 真实 Chat 为 `ses_h9hSZADKVzpohRVKZuw2`，可见用户输入经正常 `/global/chat/start` 接受。GPT-6.1 Sol 实际以 `format=markdown` 读取两个本轮公开资源，产生两个真实工具结果和来源，最后以 `finish=stop` 完成。
- [精确检查结果](live-check.json)及其[实际退出码](live-check.exit.txt)证明：通过只读 SQLite 事务和生产 `completedToolOutcomeOutput` 解析真实 Permission result，HTML正文86字节、原生Markdown正文143字节均逐字符合[预先声明的资源及输出](resource-documents.json)，元数据及同消息来源准确。[规范持久化事实](live-canonical.json)保留真实输入、结果、来源和最终回复。
- [实际执行的检查器源码](check-live.ts)是原 `.tmp-webfetch-text-fidelity-382` 中的执行版本，保留其原相对依赖与输入目录；它作为执行证据归档，不声明可在本归档目录独立运行。检查结果不是从模型自述推导。
- 全部6次真实模型请求均为 `gpt-6.1-sol`、流式HTTP200、正常EOF（End Of File，流正常结束），含实际凭据/模型目录预检，位于原600000ms/12累计请求预算内。完整请求审计在压缩包的 `live-provider-audit.json` 和最终 `provider-live/*-final-provider-audit.json`。

## 真实桌面人工复核

主 agent 在自己的 `http://127.0.0.1:18496/ui` 页面完成实际Chat、两个工具展开、Expand Output和键盘阅读，逐张人工查看截图后关闭页面。归档 agent 随后也查看了以下三张关键图片。没有创建或运行UI（User Interface，用户界面）自动化测试。

| 关键截图 | 实际观察与证据边界 |
| --- | --- |
| [HTML工具输出](html-tool-output.png) | 原始工具文本中的两行正文、pre缩进及多个空行可阅读，来源仍为实际HTML样本。 |
| [完整Markdown工具输出](markdown-complete-output.png) | 原生frontmatter、缩进代码、围栏代码与中间空行在展开输出中完整呈现。 |
| [代码空行阅读位置](markdown-blank-lines.png) | 键盘阅读至围栏尾部，代码间距和后续真实回复、来源链接均可见。 |

截图说明实际可见结果；行末空格和CRLF（Carriage Return + Line Feed，回车加换行）的精确保真由规范工具正文检查证明。其余两张原始截图也保留在完整压缩包中。Copy Output 控件实际点过，但剪贴板读取为空，未验收成功；系统剪贴板不属于本批网页工具输出边界合同，不影响已证明的正文输出结论，也未被宣称修复。

## 运行收尾与失败事实

[原生资格回执](runtime-completion.json)确认NativeService物理完成、6次Provider EOF。[精确清理回执](physical-cleanup.json)记录原Host/Target的进程出生身份、正常exited0、输出排空和请求清理，以及之后成对删除本scope复制的auth/models。原应用launcher64131、shutdown73110、资源服务26998均实际join exit0；NativeTarget运行381579ms，在原固定时限内退出。独立资源服务只接收两次真实文档GET及自己的shutdown POST，随后正常退出；18496/18497端口均已释放。

原launcher命令的PowerShell `$LASTEXITCODE` 未被脚本填充，原 `provider-launcher.exit.txt` 为空并原样归档；真正的进程退出由 `owner-handle-joins.json` 和原生settled回执证明。资源首次绑定18484遇到 `EADDRINUSE`、exit1，发生在Provider启动前，原失败及输入保留；主 agent 确认该端口属于另一独立验收服务后，双方保留18496/18497供本批使用，没有操作占用进程或延长已启动的验收轮次。

## 归档范围与检查

[evidence.zip](evidence.zip)仅含[精确允许清单](archive-manifest.json)中的60个 `archive-safe` 文件。日志已经压缩；打包后解压逐项比较，与被选证据原字节一致。此检查只证明本次归档完整，不替代功能正确性。

[凭据扫描结果](credential-scan.json)记录对压缩包内全部文本（含解压后的日志）及独立文本的检查。已知凭据只在内存中用于扫描，值未输出；全部文本此前亦经过生产CredentialRedactor清洗。图片为主 agent 的真实页面截图并经人工查看。归档不包含auth/models文件、数据库、附件库、home、配置目录或整个runtime；压缩包内的 `runtime/log/dev.log.gz` 是明确选中的单个脱敏日志。

本批功能、真实流式模型路径、桌面人工复核和正常收尾已完成。统一类型/文档检查、共享索引/当前架构及最终提交推送由主 agent 合并交付；本目录不声称执行发布、其它平台验收或剪贴板修复。
