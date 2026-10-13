# 390 MCP合法内容边界物化

## 当前验收状态

已按主agent后续批准完成唯一共享物化函数的空blob、AudioContent和resource_link映射。正式Bun1.4.0后台四组35项/206断言全部通过，核心typecheck和docs:check通过，owner正常收尾。真实GPT-6.1 Sol Task/default+package MCP三类结果已验收：11请求全部HTTP200/EOF，实际存储及页面下载为0/60字节，root人工查看4图；两owner正常关闭并配对清理。MCP prompt-parts输入入口仍未修复或复验，不能外推。安全证据见[归档README](../../artifacts/2026-10-13-mcp-content-boundaries-390/README.md)。

## Recall与当前状态

用户持续目标要求每批先根因/影响调查并落盘，再实施有证据的修复与真实验收。388已修复结构化正文和合法空文本资源，其范围明确排除空blob、audio、resource_link。本轮主agent最初委托单层只读审计，允许短期无凭据官方SDK探针及本记录/`.tmp-mcp-content-boundaries-390`，初始禁止生产修改、UI（User Interface，用户界面）自动化、模型/凭据、常驻服务、再次委托或提交。共享索引由主agent处理。以下调查与候选方案先于实施落盘；后续明确授权和结果记录在“实施授权”及正式红绿章节。

已重读388 Recall、当前 `04-extensions.md` MCP结果合同、`capability-search-runtime.md` 的MCP资源discover-only与结果授权/恢复合同、`06-provider.md` 的附件投影；读取SDK1.31.0对应固定协议2025-11-25、所有四个物化入口、AttachmentStore、Read、Message模型结果转换、ProviderTransform、Base64两种解码函数、MCP App原结果绑定与相关历史/后台测试。当前有并行permission/session/file/Provider依赖和UI改动，只读相关直接消费边界，保留全部他人改动。未发现新的调度、恢复或终态异常，无据扩大到调度审计。

## 权威协议与现有公开合同

[MCP 2025-11-25 Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)定义文本、图像、音频、资源链接和嵌入资源。音频内容携带Base64及MIME（Multipurpose Internet Mail Extensions，媒体类型）；资源链接携带URI（Uniform Resource Identifier，资源标识）与资源描述，并不保证出现在resources/list中。[固定版本Schema](https://modelcontextprotocol.io/specification/2025-11-25/schema)的BlobResourceContents为Base64字符串；安装SDK的Base64Schema用atob校验，接受空串，空串对应真实零字节内容。不能仅凭类型合法便声称模型可听音频、能读取任意URI或空图片是有效图像。

仓库已有独立事实进一步确定边界：AttachmentStore接受完整零字节文件和audio/wav字节，规范引用带项目、字节数与存储身份；Message模型结果转换会读取并校验规范附件，文本附件以可读正文/字节数呈现，未经验证的二进制Provider传输则返回明确的附件引用和原因。当前ProviderTransform只验证特定图像与OpenAI Responses文件类型，不因模型声明audio能力便自行启用音频typed transport（带媒体类型的工具结果传输）。Read能定位规范attachment引用，但二进制返回通道只有image/PDF；普通音频仍受二进制文件错误合同约束。

MCP prompt/resource在当前能力目录仅是可搜索metadata；`descriptorForMcpMetadata`明确返回 `behavior.kind: unavailable` 和 `mcp_resource_metadata_only`，discover-only不等于execute授权。用户明确附加的MCP资源另有 `Session prompt parts→MCP.readResource` 入口，MCP App还有其专有resources/read代理；这些都不意味着Tool结果内的resource_link可自动读取，更不能把MCP服务器file://URI当作本机文件路径。

## 正式只读探针与可观察现象

使用正式 `bun run --cwd packages/opencorvus test ../../.tmp-mcp-content-boundaries-390/probe.test.ts`，实际Bun1.4.0。1项/13断言、exit0，7次真实官方SDK Client→Streamable HTTP（Hypertext Transfer Protocol，超文本传输协议）→McpServer tools/call；收到的每个结果均与服务器原始结果精确相等并通过CallToolResultSchema。随后直接调用实际物化、实际AttachmentStore和离线Message模型输出转换，不mock结果/存储，不调用Provider。日志、完整输入输出在本任务 `.tmp` 的 `probe.log`、`probe-observation.json`。探针通过表示观察和对照成立，不表示这些产品缺陷已经修复。

| 实际输入 | 当前生产结果 | 现有通路对照与影响 |
| --- | --- | --- |
| 嵌入application/octet-stream资源，blob空串 | `MCP tool resource file:///public/empty.bin did not return usable text or blob content` | 空文件是合法内容，却被当成无内容；零字节导出无法交付 |
| 成功text + 空CSV blob + structuredContent records:0 | 同类错误，整次物化失败 | 原成功正文和结构化计数也失去正常结果；远端效果可能已成功，失败不能当作未执行证据 |
| 成功text +60字节有效WAV的AudioContent | `Unsupported MCP content item type: audio` | 音频文件及成功说明不能进入正常工具结果 |
| 完全相同WAV字节改为resource.blob | 正常audio/wav附件，存储读回60字节相等 | 模型输出保留原文、规范附件引用、bytes=60与“未验证audio/wav传输”原因。这证明缺陷在输入表示适配，补存储不要求新增听音频能力 |
| 成功text +公开HTTPS resource_link | `Unsupported MCP content item type: resource_link` | 即便用户只需资源名称/链接，也拿不到成功结果 |
| 相同公开URI作为普通text | 原样text进入模型输出 | 已有文本结果足以交付引用事实；不需要获取链接正文即可修复这类结果损失 |
| 空嵌入text资源 | 正常空正文 | 388既有合同继续成立 |

额外直接正向对照：真实AttachmentStore写入零字节CSV后读取仍精确0字节；Message输出保留“零记录导出成功”及规范附件说明 `bytes=0`。因此“底层存储不支持空文件”被排除。`decodeRawBase64Payload("")`确实给 `expected non-empty base64 payload`，而现有专用于持久导出的canonical解码函数接受空串；这两个函数拥有不同输入合同，不能为MCP随意合并或全局放宽。

服务使用明确idleTimeout:0与本次有界测试owner，所有SDK server关闭均fulfilled，HTTP正常stop，正式runner正常退出；精确临时端口释放另记录在 `closure.json`。没有常驻服务、模型请求、凭据或UI自动化。

## 共享根因、所有入口与历史

唯一生产 `mcp/materialize.ts` 目前只分派text/image/resource，audio/resource_link落入通用unsupported异常。resource.blob又由真值而非字段类型判断，合法空串未进入存储；只改真值仍会被复用的严格非空Base64 decoder拒绝。共同问题是MCP协议内容到现有结果表示的边界不完整，而非新的存储、Provider音频能力或资源授权需求。

全仓 `materializeMcpToolResult` 有四个生产调用：package MCP wrapper、default MCP wrapper、普通SessionLoop Host MCP、MCP App工具执行记录。四者都继承相同输入失败；wrapper原content/App原结果绑定不应因修复被丢弃。前两者与Host MCP继续经过现有Truncate有界正文和完整文件恢复；所有附件使用同一AttachmentStore projectID。package Tool字符串路径不使用该物化器，不受影响。现有任务/会话执行授权、调用事实、重放与错误结果合同都不是本次缺陷来源，不改其实现。

直接相关的另一入口 `session/prompt/parts.ts` 读取用户选定MCP资源时，也用非空text/真值blob判断；它不是CallToolResult物化的调用方，尚未在本轮真实提示词入口复现，不能因四处工具入口修复便声称它已修好。本轮必须在交付限制中明确保留；若后续独立修复该用户输入入口，应复用同一MCP资源解码合同并先协调正在并行的Session范围。

历史 `65d0bfc98` 初始物化已经只支持text/image/resource并使用blob真值；`26ed3e6a4`只修提供者身份语义，`b3cea6889`只增浏览器证据，`57fcefaa4`（388）只补structuredContent/空text。`af354ef8b`在共享util中确立raw非空与canonical可空两种Base64合同，多个用户上传、Channel、ACP（Agent Client Protocol，Agent客户端协议）、Task身份和Provider边界都调用raw；因此禁止把它全局改成允许空串来掩盖本MCP边界。

现有 `materialize-result-content.test.ts`覆盖空text、结构化与非空image/blob；`projected-output-authority.test.ts`覆盖普通/结构化正文预算；`result-provenance.test.ts`覆盖明确Builtin身份；`tool-result-attachment-provider-projection.test.ts`验证文本与明确支持的文件传输。均未覆盖AudioContent与同字节resource.blob的等价性、空blob或resource_link。原明示的unsupported错误并非可见的稳定“部分结果”合同：它会取消整个已返回工具结果，故不应因已有异常文案而认为用户结果已完整交付。

## 调查阶段候选优先级与最小实施方案

三个具体候选均有真实调用与现有消费通路证据，可由主agent决定同批修复；建议以唯一物化定义完成最小映射，不新增工具、协议版本、配置、Provider模式或自动资源读取。

1. **空blob：**按字段类型接纳string，空串在MCP资源语义内明确映射零字节Buffer，非空仍走既有严格raw解码。继续同一AttachmentStore写入，保留MIME、URI作为资源文件身份及规范字节数。不得全局放宽raw decoder、用空值掩盖缺字段/错类型，或把空image/audio默认当有效媒体。
2. **AudioContent：**使用与已有image/nonempty resource相同的解码和附件持久化原语，按实际音频MIME生成规范附件；音频没有协议filename时不捏造来源文件名。保留混合文本、structuredContent和isError。模型端继续实际已验证transport判定与可见引用/限制说明；不增加转写、解码播放、外部媒体请求或听音频承诺。
3. **resource_link：**只派生资源引用文本，保留顺序和实际公开字段type、URI、name、title、description、MIME、size；空size:0按实际值保留。不得解析文本猜链接、读取或重写URI、用本机Read处理远端file://、自动升级discover授权。原始content仍按已有wrapper/App边界保留；opaque `_meta` 与客户端展示提示不自动塞给模型。链接正文获取和新的Resource执行能力明确排除，音频/图像typed支持也不随此引用呈现扩张。

生产预计仅 `mcp/materialize.ts`，以及聚焦后台结果测试；不需要改Provider/Session/Read/AttachmentStore/权限或三个wrapper。资源链接派生文本与其标识是用户结果，应进入现有Truncate预算和完整恢复文件；不能另建无预算旁路。原内容及isError按同一事实源保留，不新增fallback或从payload猜Builtin。

## 后续验证、交付与风险

若获准实施，先落明确序列化文案/字段合同，再用正式runner写正向测试记录改前失败：真实SDK返回空blob、相同音频两种表示、混合正文/结构化、资源链接（含非HTTP URI和size0），通过实际物化→AttachmentStore→规范附件读取→模型结果转换检查明确输出/字节/状态。另覆盖无效Base64的既有明确错误，以及错误结果is_error仍真实保留。复用现有package/default MCP真实包装测试核对保存归属与规范结果，不用mock冒充端到端。资源链接不能以“没有fetch”负向测试作为核心；应验证精确引用正文及原始URI。

风险及范围：新增引用正文可能触发现有预算，属于应保留完整恢复的正确行为；音频只能据实保存/引用，现有Provider不支持仍明确可见；空blob须避免侵蚀图像/用户上传非空约束。MCP prompt资源输入的类似空值问题单独保留，不混入其他线程。真实页面音频附件/空文件、可见链接、真实模型自然调用尚未验收；本轮只调查，不把这份方案或探针exit0包装为产品交付。

本轮修改仅本spec和自有.tmp探针/日志/收尾事实；共享索引、生产实施、后续模型/页面和Git由主agent决定与完成。未发现足以证明调度/恢复共因的异常，故不开展无目标横向调度检查。

## 实施授权与精确结果合同

主agent完整阅读上述调查后，已授权三类共享映射与聚焦正向测试；原只读限制进入实施阶段。生产仅允许 `src/mcp/materialize.ts`，测试扩展 `test/mcp/materialize-result-content.test.ts` 与 `test/tool-result-attachment-provider-projection.test.ts`。不改Provider/Session/Read/权限/共享文档，不使用模型/凭据/UI，不提交或再次委托。真实Sol与页面由root另行安排。

资源链接在原content顺序位置贡献一个独立text片段，精确采用 `JSON.stringify({ type: "resource_link", uri, name, title, description, mimeType, size })`。JSON字段顺序固定为type、uri、name、title、description、mimeType、size；只保留实际存在的协议公开值（undefined在序列化时省略），空字符串和size:0按原值保留。URI原样，不解析、归一化或fetch；opaque `_meta` 与annotations不进入派生文本，原始result/content继续完整保留。相邻text与末尾structuredContent保持现有双换行和原顺序，资源引用仍进入现有预算。

resource.blob按string类型接纳，在该资源分支内精确空串映射 `Buffer.alloc(0)`，非空继续原raw decoder；全局raw和canonical Base64不改。AudioContent与image复用同一解码/附件存储分支，但imageFilename只给image。各类内容MIME与字节来自真实协议，业务isError、结构化正文、Builtin语义和附件规范引用保持；不扩张Provider音频transport。

实施顺序：扩展真实官方SDK回环正向测试，覆盖空blob/混合CSV、有效音频及相同字节resource对照、最小/完整链接固定字段顺序（含原URI、空title、size0）、明确错误Base64和空音频/图片解码错误；Provider边界增加实际零字节文本附件及音频规范引用/明确限制。先运行正式runner红测，再改唯一生产定义，重跑388同三文件及该Provider边界，共四文件，核心typecheck。命令PATH显式前置仓库已有Bun1.4.0，避免外层run被旧Bun替换；所有日志进入自有.tmp。所有SDK/HTTP和隔离runner按原owner正常关闭，未覆盖的prompt-parts资源输入问题继续明确保留。

## 正式红测与实施记录

`before.log`由Bun1.4.0正式隔离runner执行两个指定文件，exit1：物化16项中10 pass /6 fail /74断言；Provider边界12 pass /21断言。合计22 pass /6 fail /95断言。六个失败精确来自两个资源链接unsupported、两个空blob无可用内容、AudioContent unsupported，以及空AudioContent未进入应有解码错误；真实SDK准备和其他既有内容、附件消费通过，没有工具链准备失败。

红测后保存唯一生产文件的原始副本和空git diff，按上述精确合同实施resource_link公开字段JSON、audio与image共用既有存储分支（imageFilename只给image）、resource内空blob零字节映射。raw/canonical decoder、Provider transport、所有调用者均未修改。原始JSON字段/URI值、isError和388结构化/Builtin分支仍由原来源拥有。随后执行四组正式绿测与核心typecheck。

## 正式绿测、范围与交接

`after.log`在相同Bun1.4.0正式隔离runner中执行四文件，全部exit0：

| 文件 | 结果 |
| --- | --- |
| `test/mcp/materialize-result-content.test.ts` | 16 pass /100断言 |
| `test/capability/projected-output-authority.test.ts` | 5 pass /78断言 |
| `test/mcp/result-provenance.test.ts` | 2 pass /7断言 |
| `test/tool-result-attachment-provider-projection.test.ts` | 12 pass /21断言 |

合计35项/206断言。新物化文件包含14次真实官方SDK调用以及3个直接生产解码错误合同测试。相同WAV两种表示读回完整60字节；空blob实际存0字节CSV/octet-stream并保留混合正文/计数；资源链接原URI、固定字段顺序、size0、空title及原content完整；错误结果is_error与原结构化错误正文保持。Provider正向消费证明0字节正文可引用、音频仍为明确未验证传输的规范附件引用，未冒充模型听取。

既有388的三种文本/两种结构化投影预算、完整文件及规范MessageStore结果继续通过，Builtin身份/截图来源合同保持。测试HTTP/MCP owner在finally正常关闭；正式runner正常退出并回收精确隔离根，`runner-cleanup.json`另有观察。没有新增常驻服务、凭据/模型或UI操作。

`typecheck.log`核心tsc --noEmit exit0；`docs-check-after.log`为当前声明的docs:check，exit0（348 ops/26 groups）；git diff --check通过。最终修改仅生产 `mcp/materialize.ts`、两个上述扩展测试和本spec，共4个仓库文件，日志与原源码副本在自有.tmp。共享README、架构、CHANGELOG、实际Sol/页面和最终提交由主agent负责；本agent未提交或改peer文件。未达成项明确为真实模型/桌面验收及独立prompt-parts资源输入路径，不影响本轮后台合同已通过的事实。

## 真实Sol attempt01授权与固定验收计划（启动前）

root已独立复核唯一生产diff与全部新增测试，授权一次fresh真实GPT-6.1 Sol范围。复用已验证388生产NativeService runner，不复制或修改共享runner；自有输入、短期MCP服务、安装脚本和只读checker均在 `.tmp-mcp-content-boundaries-390/live-attempt-01` 及其父目录。开始前重读Recall与388正常收尾，确认旧native/MCP均退出，18506/18507无监听。并行permission/session/project/Provider及389 UI改动原样保留。

应用18506沿原377 NativeService：原生物理600000ms、累计20真实请求（含preflight）、流无活动180000ms，进展不延长截止。公开MCP18507由独立owner以idleTimeout:0提供SDK Streamable HTTP，启动固定600000ms，并有专有正常shutdown；两owner与原截止写入事实。沿授权源stage OpenAI凭据与完整models目录，启动业务前独立核验credential usable、catalog projected、actualModel gpt-6.1-sol、streaming true和occurrence一致；秘密只在内存脱敏，禁止进入spec/日志/归档。若本地15s preflight准备失败，先查根因，不盲目重试或延长；真实Provider错误保留原事实。

项目默认保持builtin Base。通过SDK写包、正常import-folder安装 `qa/content-boundaries-390`，再由正式CLI task create显式选该包。包声明一个default MCP报告链接、两个package MCP空导出/音频能力，不引入Host gate或伪消息。用户自然请求三报告各一次、列返回事实与附件字节、说明当前音频传输限制；不请求取链接正文、播放或听音频。公开结果精确为：成功原文+records:0+空CSV blob；成功原文+60字节有效静音WAV AudioContent；包含HTTPS URI/name/title/description/mimeType/size:0的resource_link。正常模型根据真实工具声明搜索/调用/答复，再使用现有Task完成接口。

独立checker读取真实Task/status、SQLite一致性快照和生产tool-part/result投影，核对request/task/project/session归属、三个完成结果的原content及输出、正确规范附件引用和实际AttachmentStore完整0/60字节（WAV逐字节对公开输入），原资源链接固定JSON字段及URI。可见助手回答应有各返回事实、字节与音频传输限制；字节正确性由文件读回而非模型自述证明。实际Provider审计每请求精确Sol/stream/HTTP200/EOF；Task completed及正常complete_task独立核验，NativeService自身回执不冒称Task验证。此范围证明真实Task内default/package MCP结果链；不外推worker/普通Chat/MCP App、prompt-parts或Provider听音频能力。

先向root报告ready URL、Task/session及原截止，并至少预留两分钟实际桌面展开/下载/截图窗口；root拥有独立页面与人工复核。本agent不操作浏览器或用户进程。root发PageClosed后原生正常shutdown、join launcher与shutdown句柄、读取物理退出/output drain/request cleanup回执、精确删除授权复制的auth/models配对；MCP正常close/stop/join，最后独立核对端口和进程身份。若提前达到原截止照既定owner收尾，禁止延长。成功、Provider失败、辅助故障、UI与关闭各自如实记录，不覆盖388或本轮失败证据。

## attempt01真实后台结果（页面与物理关闭待独立确认）

scope `mcp-content-boundaries-390-live-01-ce6b34bf-2656-48b0-a06a-70e9eaea3990`，应用18506，Host71428/Target76968，原native截止2026-10-13T11:00:35.929Z。MCP18507 owner20420，occurrence `1ea30bae-4fa0-4da0-bfaa-62cf44e5671f`，原截止11:00:06.173Z；两者未延长。预检凭据usable、完整catalog projected、actualModel gpt-6.1-sol、streaming true；Base与显式包选择各有真实配置/CLI回执。

实际Task `tsk_g00VXvSRD400ocgErO7w` /项目 `prj_h4Io1mTN9eWK4wixcEIn`，root session `ses_-zUS4XYfizzTsgqUuZu6`，scheduler `ses_-zUS4XXq0zzrQF2DPDnp`。2026-10-13T10:54:09.953Z只读checker exit0：Task completed/inactive、activity.running=0，真实manage_task.complete_task完成；3个MCP各恰好调用一次，实际durable Permission结果与SDK公开content精确相等，公开输出正文/JSON准确。规范CSV附件实际0字节、WAV实际60字节，均读实际AttachmentStore文件并与独立公开样本逐字节一致，真实project/session/message归属和metadata MIME/size/url一致。没有将模型自述作为字节证据。

累计11次真实请求全部为gpt-6.1-sol、streaming、HTTP200、reader settled且EOF。可见回答保留两个原文、records0、0/60字节和资源链接全部公开字段；人工阅读真实回答确认明确说明OpenAI适配器没有已验证audio/wav文件数据传输、附件仍是工具侧证据、模型未听取。checker保存 `live-canonical.json`、`live-provider-audit.json`、`live-check.json` 与 `visible-answer.txt`，使用CredentialRedactor处理规范事实。此时桌面展开/下载/截图由root继续独立验收，物理关闭与配对清理尚不据后台成功提前声明。

## attempt01页面、下载、正常收尾与安全归档

root已在实际tab27展开三个结果、阅读Completed答案、点击CSV与WAV下载，并人工查看4图：`empty-csv-result.png`、`audio-attachment-result.png`、`resource-link-fields.png`、`completed-answer.png`。两份实际下载文件由root checker和独立checker分别逐字节比较，真实CSV0/WAV60与公开样本一致。root于2026-10-13T10:56:30.087Z关闭页面并发PageClosed；没有UI自动化，文件下载不代表模型听取音频。

随后原owner正常关闭：MCP于10:56:55.661Z关闭，42个SDK server close全部fulfilled；native于10:56:58.343Z正常exit0，物理Job/output drain/request cleanup回执齐全，10:57:01.471Z复制auth/models精确配对删除。launcher exec88420、MCP exec22251与shutdown实际调用全部正常join exit0；PowerShell脚本正常返回未设置LASTEXITCODE，owner-handle-joins明确取实际exec工具exit0而非空字符串。独立观察18506/18507释放、原MCP身份退出、复制pair已移除。均在原固定截止前完成，未改变20请求或180s无活动约束。

[安全证据README](../../artifacts/2026-10-13-mcp-content-boundaries-390/README.md)与[逐项清单/凭据扫描](../../artifacts/2026-10-13-mcp-content-boundaries-390/credential-scan.json)包含正式红绿/typecheck、真实公开SDK输入、Task/canonical/checker、11请求最终audit、4关键截图、原owner正常收尾和公开expected/stored/downloaded样本。实际内容和[下载字节检查](../../artifacts/2026-10-13-mcp-content-boundaries-390/live-attempt-01/download-bytes-check.json)保留原0/60字节，禁止以哈希代替行为验证。文本大文件及日志gzip压缩，未归档runtime/SQLite/auth/models或其他任务文件；已知源凭据逐项扫描0命中，源配对元数据与stage时一致。

归档辅助脚本第一次因root下载checker实际位于scope父目录而非live子目录报ENOENT，保留本地原错误日志后修正明确路径；已写档案只允许相同字节验证并续写缺项，重跑exit0，没有覆盖真实失败/成功事实。业务没有Provider失败、调度异常或预算延期。当前验收限真实Task内default resource_link及package空blob/audio两条包装链，不外推worker、普通Chat、MCP App、prompt-parts、链接读取或Provider音频typed传输。共享索引、架构/CHANGELOG与范围提交仍由root处理，本agent未提交或修改peer文件。

最终独立扫描确认归档共82文件（80项明确allowlist、README、credential-scan），18份gzip可解压，44个本地链接全部存在，包含spec的73份文本及4图/6份公开样本已扫描，已知凭据0命中；归档实际存储/下载再次逐字节核对0/60，11请求HTTP200/streaming/EOF与正常关闭/原截止一致。最终docs:check exit0（348 ops/26 groups）、本范围git diff --check exit0；生产和测试在后台验收后未再改变。
