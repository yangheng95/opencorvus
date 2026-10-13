# 382 网页读取的语义空白保真

当前验收状态：聚焦功能合同、真实GPT-6.1 Sol流式读取、桌面人工复核和原生正常收尾均已完成；[独立证据目录](../../artifacts/2026-10-13-webfetch-text-fidelity-382/README.md)保留完整允许证据与关键截图。Copy Output的剪贴板读取未验收成功，不属于本批工具输出边界合同。统一检查、共享文档和提交推送仍由主 agent 负责。

## Recall

用户要求持续按批并行体验、调查和改进 OpenCorvus，先完成根因和影响分析并落盘 specs，再实施、真实页面交互与截图人工复核、聚焦正向功能测试及必要的授权 GPT-6.1 Sol 端到端验收，最终由主 agent 完成范围提交、上游同步和正常推送。主 agent 最初委托实现网页输出保真修复，当时不启动真实 Provider或使用凭据；随后明确准入必要的独立真实GPT-6.1 Sol后端验收与本批artifact归档，详见后续章节。始终不得再次委托或运行 UI（User Interface，用户界面）自动化。

当前 380 Unicode 文件长行修复已交付。文件 UTF-8/NUL 文本准入、代理认证及模型搜索由相邻批次负责；工作区还有 session/message-store、source-persistence、来源并发测试及界面相关改动，全部保留且不修改、不运行其未提交测试。本任务仅拥有本记录、`packages/opencorvus/src/tool/webfetch.ts` 的输出边界、一个新增后台测试文件及根目录 `.tmp-webfetch-text-fidelity-382` 命令日志。共享索引、当前架构、CHANGELOG、实际页面和模型验收、提交推送由主 agent 负责。

验收指标：真实本地 HTTP（Hypertext Transfer Protocol，超文本传输协议）响应经过生产 `executeWebFetch`，返回转换器已生成的 Markdown/纯文本以及原生 text/markdown、text/plain、HTML 的语义空白；精确正文、UTF-8 字节计数、来源和内嵌附件仍一致；已有输出预算、HTTP 大小/取消/重试合同继续通过。函数级与本地 HTTP 测试不冒充模型或视觉端到端验收。

已读 AGENTS.md、`specs/current/architecture/capability-search-runtime.md`、`07-panel.md` 的 webfetch 合同、完整 webfetch/Tool 包装器/字节前缀代码、正式隔离测试 runner 与 memoryProject、webfetch 输出/正文/来源标题/编码/链接测试。历史核对 324 纯文本提取、325 UTF-8 前缀、378 字符编码、379 链接基址方案，以及 `git log/show` 中 `65d0bfc98` 至 `ba1c6e5a6` 的相关实现。全仓搜索 `formatFetchedText`、`convertHTMLToMarkdown`、`executeWebFetch`：只有 webfetch.ts 内一份格式化器和一条 HTML 到 Markdown 转换路径，各文本格式分支均进入此输出边界。当前检索的聚焦后台测试没有 UI 自动化测试。

## 可观察现象、根因及影响

只读调查通过当前 Bun 进程加载器临时追加私有函数导出，未改磁盘源码，直接运行生产函数：`<p>First line<br>Second line</p>` 经 Turndown 得到 `First line  \nSecond line`，随后 `formatFetchedText` 变成 `First line\nSecond line`。安装的 marked 解析前者为 text/br/text，后者为单个 text。原生 Markdown 输入出现同样损坏；围栏代码的四个换行变成三个，原生缩进文本 `    code\n    next` 的首行四个空格也被删除。

直接触发点是 `formatFetchedText` 无条件执行行尾空白删除、连续换行折叠及 trim；这些字符既可能是格式语法，也可能是代码或原始文本。根因是输出预算边界同时承担了无语法依据的内容重写，而非 Turndown、HTML 实体解码、字符编码、模型或界面渲染错误。[CommonMark 6.7](https://spec.commonmark.org/0.31.2/#hard-line-breaks) 明确两个以上行末空格产生硬换行；代码块中的空白属于正文。旧 324/378/379 分别修复上游提取/解码/链接上下文，未触及已有通用清理；至少 `65d0bfc98` 已有这组操作。已有 br 测试只检查 format=text，编码和链接测试正文没有空白敏感案例。

影响普通 Conversation、Task、Mission 和 worker 经同一 webfetch 工具取得的所有非图像输出。输出、元数据字节统计与后续模型输入继承被改写的正文。无需改变公共参数、Source schema、来源身份/持久化、Provider 流程、权限、HTTP owner 或附加依赖。本轮没有调度、队列、唤醒、恢复、并发或终态异常证据，相关机制不适用；不检验或触碰其他并行来源持久化工作。

## 公开契约与唯一实施

在唯一 `formatFetchedText` 边界保留现有内嵌 data URL 附件提取，之后直接对其输出执行现有 UTF-8 字节预算与前缀裁剪，不再删除前后或行尾空白、折叠空行或统一原始换行符。HTML 到 Markdown、HTML 到纯文本的结构由现有成熟转换器拥有；原生 Markdown、纯文本和请求原始 HTML 的已解码正文保持原字符序列。转换器自身的格式选择仍是既有合同；这次不承诺重建 HTML 原排版或字节编码。

保留 5 MiB HTTP 响应上限、当前 50 KiB 输出上限与标记预留、按行优先截取/超长首行完整 UTF-8 前缀、原附件去重及替换引用、Source URL/标题、取消与重试。字节元数据描述附件外置后的实际输出文本；因为此前被删除的空白开始计入预算，某些资源可能比原来更早截断，这是正确计量带来的可解释影响。删除旧清理而非保留双路径、按关键字修补 Markdown 或增加第二套解析器。

既有 `webfetch-source-title.test.ts` 部分原生 Markdown 期望显式裁去末尾换行/把 CRLF（Carriage Return + Line Feed，回车加换行）转为 LF，属于受影响的旧合同。主 agent 已明确准入更新这四种资源的正文期望到已有 `markdownBodies` 原始字符串，保留原生 CRLF 和尾换行，不改来源持久化逻辑。

## 验收方案与状态

先新增 `test/tool/webfetch-text-fidelity.test.ts`：真实回环 HTTP 服务及正式 memoryProject/Instance/Session context，覆盖 HTML/XHTML br、pre 中空白、原生 Markdown 的硬换行/缩进/代码空行、原始 HTML 和纯文本的前后空白/CRLF、附件及输出预算。以完整预期正文和准确 metadata/source/attachment 值为正向断言；不用源码文本断言、DOM（Document Object Model，文档对象模型）断言、浏览器测试或截图断言。

通过 `bun run --cwd packages/opencorvus test test/tool/webfetch-text-fidelity.test.ts` 正式隔离 runner 保存改前失败，再修改唯一生产边界，并用同一 runner 重跑新文件及既有 webfetch 输出、链接、编码、HTTP body 相关测试。命令完整日志与退出码只写 `.tmp-webfetch-text-fidelity-382`。主 agent 负责统一文档检查、索引和架构更新、最终类型检查、范围复核与提交。

主 agent 的真实验收建议：隔离开发模式 `/ui`，用明确包含地址/诗句 br、预格式代码及原生 Markdown 缩进的资源，让已授权 GPT-6.1 Sol 调用真实 webfetch，人工查看正文/工具输出并截图；后台核对真实工具输入输出、持久化数据和实际流式模型请求，而不是依赖模型自述。方案初始状态为实施与正式红测尚未开始；后续结果按下节记录，页面与 Provider 验收由主 agent 补充。

## 正式改前证据与实施

正式命令 `bun run --cwd packages/opencorvus test test/tool/webfetch-text-fidelity.test.ts` 经现有隔离 runner 完成，退出码 1：0 pass / 17 fail / 17 expect calls，单文件实际约 29 秒。完整失败及退出码保存于 `.tmp-webfetch-text-fidelity-382/before.log` 和 `before.exit.txt`。17 个用例分别证明 HTML/XHTML 换行、两种转换器 pre、原生 Markdown/纯文本三种返回格式、原始 HTML、围栏代码、外置附件周围空白、精确预算、Unicode 首行裁剪、按行裁剪与纯空白正文损坏；不是环境初始化失败。

据此只删除 `formatFetchedText` 中四种通用空白重写，字节预算作用于附件外置后的实际 content。已更新四种旧 Markdown 资源的正文期望，复用同一 authored 输入字符串。Source 标题和持久化逻辑原样保留。修后正式复验与主 agent 的真实页面验收仍待完成。

首轮修后复验的新 17 例全部通过。相邻 `webfetch-link-base.test.ts` 的纯文本旁证发现同一旧 trim 合同：链接后跟仅含已跳过图片的段落，html-to-text 输出 `Etiquette\n\n`，原测试预期 `Etiquette`。主 agent 已明确准入按当前转换器保真合同更新这一个精确期望，并授权本范围其他同类过期空白期望按事实修复；来源、附件等合同不得为通过检查而改动。该首轮失败保留于 after.log，更新后另行复验失败文件。

## 功能复验结果与交接

正式六文件命令为 `bun run --cwd packages/opencorvus test test/tool/webfetch-text-fidelity.test.ts test/tool/webfetch-output.test.ts test/tool/webfetch-link-base.test.ts test/tool/webfetch-encoding.test.ts test/tool/webfetch-body.test.ts test/tool/webfetch-source-title.test.ts`。该次 exit 1，仅上述链接文件旧期望失败；其余五文件均 exit 0。修正该期望后，`bun run --cwd packages/opencorvus test test/tool/webfetch-link-base.test.ts` 单文件复验 exit 0。两份完整结果及退出码分别是 `.tmp-webfetch-text-fidelity-382/after.log`、`after.exit.txt`、`recheck-link-base.log`、`recheck-link-base.exit.txt`，不把首轮失败改称整体成功。

| 文件 | 最新通过用例 | 断言 | 最新文件退出码 |
| --- | ---: | ---: | ---: |
| webfetch-text-fidelity | 17 | 52 | 0 |
| webfetch-output | 1 | 36 | 0 |
| webfetch-link-base | 14 | 45 | 0 |
| webfetch-encoding | 16 | 36 | 0 |
| webfetch-body | 6 | 34 | 0 |
| webfetch-source-title | 1 | 38 | 0 |

去重后的六文件合计 55 用例 / 241 断言，已分别通过；所有 runner 进程已退出并回收各自隔离环境。本轮未运行全量测试、UI 自动化、真实 Provider 或凭据操作。生产差异仅一个格式化函数，其他改动为新增正向合同和获准的旧空白输出期望。`git diff --check` 对本任务已跟踪差异通过。

本子任务交付时，真实 `/ui` 交互、截图人工复核、GPT-6.1 Sol 流式端到端验收、统一类型与文档检查、共享索引/当前架构更新、提交和推送均由主 agent 负责且尚未在本记录中宣称完成。仓库 `/specs/` 为默认忽略目录，新记录须由主 agent 精确强制加入本次提交；临时命令日志目录也默认忽略，由主 agent 决定证据归档，不改全局 ignore 规则。

## 后续真实 Provider 验收准入

主 agent 随后明确委托本子任务完成 382 独立真实 GPT-6.1 Sol 流式验收的后端部分，必要凭据使用来自用户持续 goal 的授权；实际桌面交互和截图仍由主 agent 完成。本次应用 benchmark-debug-template 技能。已重读 380-final 的成功运行与中断事实、现有 `live-sol-locale-377-after.ps1` / `live-sol-cli-owned.ts` / `live-sol-shutdown.ps1`，以及生产 `stageDiagnosticProvider`、`RealProviderAudit`、公开 `/global/chat/start` 入口，不复制新的运行器或绕开正常工具权限。

预先固定 scope `webfetch-text-fidelity-382-live`，开发服务 `http://127.0.0.1:18483/ui`，RunRoot 为仓库 `.tmp-webfetch-text-fidelity-382/provider-run`，运行回执放 `.tmp-webfetch-text-fidelity-382/provider-live`。使用既有377完整私有运行包的 Bun 与当前源码 CLI，NativeService 总上限 600000ms、累计最多 12 个真实模型请求（含预检），模型无活动上限 180000ms；有意义的流活动只更新无活动时间，不延长原生总时限。模型和凭据预检成功前不得发业务输入。原生 launcher 常驻监督有其原接口；本 agent 只定时检查完成/失败回执，不持续追日志。

既有 runner 从授权的当前 OpenAI authority 暂存单个凭据记录，并完整复制同目录 models.json 模型目录事实。stageDiagnosticProvider 分别验证有效访问授权和完整目录中的 gpt-6.1-sol；Provider projection 检查实际 API 模型；真实 preflight 验证 credential usable/catalog projected/actual gpt-6.1-sol/streaming true。凭据不进入输入、日志、spec 或归档；复制 OAuth（Open Authorization，开放授权）只使用当前访问权，不刷新原凭据，最终按既有精确物理收尾后成对清理。

独立回环 HTTP 资源服务位于18484，仅发布本轮公开合成的两份测试文档，不模拟产品回复或模型消息。Node.js 前台句柄拥有该进程，记录 pid/父进程/启动时间/请求和自然关闭回执；服务自身固定720000ms上限，并有显式仅本轮 shutdown 路径。HTML 文档含 br 和 pre 内缩进/尾空格/连续空行；原生 Markdown 文档含标题、首行缩进代码、围栏代码空行、硬换行及 CRLF。真实业务请求经公开 chat/start 建立可见 user Message，由实际 GPT-6.1 Sol 自然调用 webfetch 读取两份文档 format=markdown 并简要解释与引用。不得插入伪 tool、source 或 assistant 消息。

后台 checker 读取真实已完成会话及规范 SQLite tool request/outcome 的持久化事实，逐字比对 authored 预期正文和字节元数据，验证两份实际输入 URL/格式、真实 Source 与会话完成事实；Provider 审计逐请求验证目标模型、流式 HTTP200 和 EOF（End Of File，流正常结束）。source-persistence 的并行实现不改动，检查不替代视觉验收。

主 agent 获得实际 session/directory/UI URL 后打开独立页面截图；必须在同一原生时限内关闭自己的页面，再由唯一既有 shutdown 入口完成 Host/Target/output/request/端口和 auth/models 配对清理，实际 join 原 launcher。资源服务也经自己的关闭入口后 join 原 Node 句柄。任何失败原样保留，不重用scope、延长预算、杀用户进程或把仅后台通过宣称为整体端到端完成。

启动前端口检查后，资源服务18484仍遇到 `EADDRINUSE` 并实际 exit1，未得到listener/owner，未启动Provider。原资源输入及日志保留，主 agent 确认18484属于其另一独立PDF验收服务。本轮不操作该服务；双方明确保留新的应用18496和资源18497端口，仍使用上述独立scope与原定600000ms/12请求预算，资源服务第二次启动的新输入清单为resource-documents-02.json。此为绑定前准备失败，不宣称已执行模型或重用已经开启的原生验收轮次。

## 真实模型后端结果（页面和原生收尾另记）

实际 occurrence 为 `webfetch-text-fidelity-382-live-b8a4461a-d6a4-416a-b6e5-34120e889359`，Native Target 69476、Host 80044。原生截止为 2026-10-13 14:38:49.557（Asia/Shanghai）；独立资源 Node PID 79440，720000ms 截止14:40:27.946。未延长预算。原 launcher 句柄64131、资源句柄26998由本子任务保留，物理收尾不能凭会话完成代替。

预检分别确认 credential usable / catalog projected / actualModel gpt-6.1-sol / streaming true。随后经正常公开 `/global/chat/start` 接受真实可见输入，HTTP202，Chat `ses_h9hSZADKVzpohRVKZuw2`、user Message `msg_hkPxozuYrDhaY6f9JLZU`、requestID `2f3a036e-f80d-4f7f-80d4-305ad5d4114b`。实际两个工具请求均为 webfetch + format=markdown，网址为18497的article.html与article.md。最终 assistant `msg_g0VXuOb5v00oO128rwgX` 的 finish=stop 且有完整完成时间；模型回复给出两份真实网址并解释其换行/代码内容，回复只作为交付正文而非根因证据。

14:33:35 实际后台 checker exit0，通过 readonly SQLite BEGIN/ROLLBACK 及生产 `completedToolOutcomeOutput` 解析两条实际 Permission result。HTML工具正文86 UTF-8 bytes、原生Markdown正文143 bytes分别逐字匹配预先 authored 预期；元数据originalBytes/shownBytes、截断状态、附件数与同message真实Source标题/URL全部准确。实际工具Parts为 `prt_g0VXuOXkY00ezqIYWeVb` 和 `prt_g0VXuOagm00OjzKbdGJK`。该时点6个真实GPT-6.1 Sol请求全部streaming=true、HTTP200、reader settled/EOF，未耗尽12请求预算。

后台明细保留在同一临时目录的 `chat-input.json`、`chat-accepted.json`、`live-canonical.json`、`live-provider-audit.json`、`live-check.json` 和 `live-check.log`；checker使用CredentialRedactor在内存收集现有凭据并清洗归档数据，不保存凭据值。API消息观察和SQLite规范输出均为真实生产消息，没有伪工具或来源。当前已通知主 agent 进入18496/ui按实际Chat人工截图；页面资格及正常shutdown/join/配对清理尚待闭合，暂不宣称完整端到端交付。

## 真实页面反馈、正常收尾与允许归档清单

主 agent 随后明确回报已完成真实Chat、两个工具展开、Expand Output、键盘阅读及截图人工检查，并已关闭自己的页面；5张实际截图位于 `.tmp-webfetch-text-fidelity-382/screenshots`。Copy Output 控件实际点过，但剪贴板读取为空，该项不作为成功验收；原文保真的数据结论来自上述 SQLite checker。视觉观察由主 agent 负责，本子任务没有运行浏览器或 UI 自动化，也不冒称亲自查看这些截图。

收到页面关闭回报后，经原 `live-sol-shutdown.ps1 -PageClosed` 正常关闭18496，shutdown句柄73110实际exit0；原launcher64131实际join exit0，qualified-surface-completion为NativeService / physicalCompletion=true / providerEOFRequests=6。NativeTarget在2026-10-13 14:35:12.088正常exited0，相对实际出生运行381579ms，早于原固定截止；Host/Target精确birth、两个输出drain和请求清理均由原生产owner确认。14:35:17物理收尾后仅精确删除本scope的auth.json与完整models.json副本，pairedCleanupComplete=true，未操作原凭据。

独立资源服务经其 `POST /owned-shutdown-382` 返回ok，Node79440在14:35:27.847自然关闭，原句柄26998实际join exit0；它记录两次真实资源GET和一次自己的shutdown POST。独立复查18496/18497 listener已释放、资源进程退出、两份复制凭据已清除，回执在 `independent-closure.json`。原launcher命令的 `$LASTEXITCODE` 未被PowerShell脚本填充，故原 `provider-launcher.exit.txt` 为空并保留；另以 `owner-handle-joins.json` 记录实际工具返回的三个句柄exit0，不能将空文件伪称退出码证据。

无凭据归档准备通过，精确清单为 `.tmp-webfetch-text-fidelity-382/archive-allowlist.json`，已在同目录 `archive-safe` 生成60份获准证据（729412 bytes）：正式红/绿测试与退出码、公开资源输入与绑定失败、真实chat输入/接受、规范消息/工具输出、Provider审计、预检/配对暂存元数据、真实原生收尾与资格回执、经内存CredentialRedactor清洗并压缩的stdout/stderr/单独dev.log，以及主 agent 的5张真实截图。逐份文本完成已知凭据扫描，秘密值未输出。此清单不包含auth/models文件、数据库、附件库、home、配置目录或整个runtime；原始私有运行目录不应整体归档。

本子任务的功能合同、真实模型后端、页面交接及正常物理收尾已闭合。主 agent 尚负责统一类型/文档检查、共享索引/当前架构、最终审查和范围提交推送；剪贴板读取未通过的事实保留，不扩写为本批已解决的能力。

## 独立artifact归档完成

按主 agent 后续准入，仅将archive-safe已有明确允许的60项归档至 [evidence.zip](../../artifacts/2026-10-13-webfetch-text-fidelity-382/evidence.zip)，并独立保留3张关键截图、实际资源输入/预期、原执行checker源码/退出码、规范消息数据、检查结果及正常物理完成回执。未改变生产或测试代码，未加入其他runtime文件或并行任务证据；完整范围见 [归档README](../../artifacts/2026-10-13-webfetch-text-fidelity-382/README.md) 和 [精确清单](../../artifacts/2026-10-13-webfetch-text-fidelity-382/archive-manifest.json)。

主 agent 已逐张人工查看实际页面截图，本子任务在归档时也查看3张关键截图，确认其绑定于同一真实Chat、HTML/Markdown工具输出和代码空行阅读位置。Copy Output读取为空仍明确未验收；系统剪贴板是本次输出边界修复范围以外的能力。归档的字节回读仅证明压缩包忠实保存已选证据，功能结论仍由正式runner、规范持久化checker和真实页面共同支持。最终凭据扫描结果保存在 [credential-scan.json](../../artifacts/2026-10-13-webfetch-text-fidelity-382/credential-scan.json)，不输出任何秘密值。

## 主 agent交付复核

主agent已读取唯一生产差异、17项正向测试、四个原生Markdown与一项纯文本过期期望更新、实际checker源码及持久化输出；六文件的首次单项失败和最终各文件通过回执完整保留。实际页面由主agent展开HTML与Markdown工具、Expand Output、End/Up键盘阅读并逐张查看截图；行末空格和CRLF不靠视觉猜测，而由真实规范输出逐字核对。PDF独立批381已提交bdf8d3aad并正常推送。

本批共享根/月份/证据索引、当前capability-search-runtime合同与未发布双语说明已更新。统一docs:check exit0(345 operations/25 groups)；此前381正常pre-push已对含本批webfetch改动的工作区完成全仓typecheck，最后仍执行本提交正常hook。未运行UI自动化、全量bun test或发布；Copy Output空读没有被包装成已解决。已知359历史记录也表明同类浏览器剪贴板边界仍需独立真实区分。提交与上游同步以本轮实际Git输出为准。
