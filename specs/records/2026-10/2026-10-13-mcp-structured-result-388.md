# 388 MCP 结构化结果与空文本资源物化

## 当前验收状态

本批共享物化修复及正式后台15项/130断言通过；Attempt01真实GPT-6.1 Sol Task scheduler完成default/package两类MCP的三个报告调用、大结果Read接续、可见准确答案及Task completed。全部12请求HTTP200/EOF；root实际页面交互及4张关键截图人工复核通过，双owner正常退出、复制auth/models成对清理完成。完整证据见[388档案](../../artifacts/2026-10-13-mcp-structured-result-388/README.md)。不外推普通Chat、worker、Mission、重启或MCP App页面。

## Recall

用户持续目标是按批并行调查 OpenCorvus，先完成根因和影响分析并落盘方案，再完成有证据的修复、聚焦正向后台测试、必要真实模型及桌面页面验收、范围提交和正常推送。主 agent 将本批投影结果后处理调查委托给本 agent，明确禁止再次委托。只读调查已收敛两个同一物化边界的问题；主 agent 随后授权388方案、实现和正式后台验证，真实 MCP（Model Context Protocol，模型上下文协议）模型与页面验收由主 agent 在下一阶段统一安排。

拥有范围为唯一生产定义 `packages/opencorvus/src/mcp/materialize.ts`、直接必要包装器、聚焦后台测试、本记录与 `.tmp-mcp-structured-result-388`。预计无需修改包装器。测试具体为新增 `test/mcp/materialize-result-content.test.ts`，扩展既有 `test/capability/projected-output-authority.test.ts` 的真实 MCP 结构化结果字节阈值，并修正 `test/mcp/result-provenance.test.ts` 的通用结果正文旧期望。不得修改并行 permission/session/file/Provider/UI 生产文件、共享索引/架构/CHANGELOG，不使用凭据或真实模型，不创建或运行 UI 自动化，不留常驻服务，不提交。主 agent 负责共享文档、模型/页面与最终 Git 交付。

已重读 AGENTS、383/385 Recall及其完整公开验收范围、当前 `capability-search-runtime.md` 的完整结果/显式执行授权合同、`04-extensions.md` 的精确 MCP 投影和内置提供者身份合同；阅读完整 `materialize.ts`、三个投影包装器、五个 Truncate 调用、MCP SDK（Software Development Kit，软件开发工具包）调用及 App 原结果绑定、Session 直接结果规范化与模型正文回放边界、附件存储和 text-mime、正式测试 runner 和383真实回环测试。当前工作区已有其他任务的 permission/session 与多个 UI/共享文档改动，全部保留。本调查未发现新的调度、并发或终态异常，也未运行 UI 测试；若后续测试暴露此类异常须立即按 AGENTS 做共享机制横审，不能归为单一 MCP 用例。

## 现象、触发与只读证据

已安装 MCP SDK 1.31.0 的 `LATEST_PROTOCOL_VERSION` 是2025-11-25。其 `CallToolResultSchema` 接受 `content: []` 与显式 `structuredContent`；`TextResourceContentsSchema` 的 `text` 是普通字符串，空串合法。

在生产 `materializeMcpToolResult` 上运行七组有限只读数据探针，两条命令均 exit0。为避免该模块间接导入 Global 时写运行目录，探针仅屏蔽未进入的 AttachmentStore 依赖；实际物化函数与 SDK schema 未替换。这是局部调查证据，不能冒充正式集成、模型或页面验收：

| 协议输入 | 实际物化结果 |
| --- | --- |
| 空普通 text block | 正常 `text: ""`、`is_error: false` |
| 嵌入 text resource，`text: ""` | 抛 `MCP tool resource file:///public/empty.txt did not return usable text or blob content` |
| 成功正文与空嵌入资源组合 | 同一错误，整个调用失去正常结果 |
| `content: []`、`structuredContent: { total: 7, report: "public-structured-result" }` | `text: ""`，仅 `mcp_tool_result.is_error: false` |
| text摘要及同一结构化对象 | 仅保留摘要，结构化正文丢失 |
|60013字节结构化报告 | 物化正文0字节，附件0；后续 Truncate 看到空串，直接 `truncated: false`，没有完整保存/恢复路径 |
|97字节结构化错误、`isError: true` | 正文0字节；`is_error: true`保留，但错误详情没有进入模型可读正文 |

## 权威协议与本地公开合同

已读取官方固定版本 [MCP 2025-11-25 Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#structured-content) 与 [Schema Reference](https://modelcontextprotocol.io/specification/2025-11-25/schema#textresourcecontents)。该版本与当前仓库 SDK 协议版本一致：结果可以同时承载非结构化 content 和结构化对象；服务器为了兼容旧客户端应附加 JSON（JavaScript Object Notation，数据交换格式）的文本副本，但这不是要求客户端只读取 content 的依据。工具业务错误属于结果中的 `isError`，协议错误另行报告。嵌入文本资源的正文类型为 string，并未要求非空。本批不升级协议或 SDK，不引入更新协议的标量/数组 structuredContent 合同。

OpenCorvus 的通用结果消费者最终需要有界文本及规范附件；其现有单一物化函数必须将通用 `structuredContent` 派生为可读正文，才能进入现有预算、持久化和回放链。原 MCP 对象仍是协议事实源，派生文本不是另一个配置面或结果状态源。正常成功、`isError: true`、协议异常继续采用当前各自合同，不把业务错误改成成功，也不新增异常或失败判定。

## 根因、调用影响与历史

1. `materialize.ts` 只遍历 content 构造 textParts；structuredContent 仅用于明确 Browser/Computer 身份的专用语义抽取。通用提供者即便返回有效结构化正文，也在 `textParts.join("\n\n")` 前没有正文投影。package/default MCP wrapper 使用这一空/摘要文本进入 Truncate，且只透传 `content`，原 structuredContent 仅由 App WeakMap 绑定为交互 App 回执保留。普通模型结果不从此 WeakMap 取正文。
2. 嵌入资源以 `"text" in resource && resource.text` 判定是否已经物化，把合法空串等同于未提供正文；后续 `materialized === false` 抛错。混合 content 中的其他合法正文不能挽救此错误。

全仓生产调用为同一物化函数的四处入口：`prompt-profile-resolver.ts` package MCP 和 default MCP、`session/loop.ts` 普通 Host MCP、`interactive-artifact/mcp-app-host.ts` App 工具记录。前两者与 Host MCP 已将派生 text 送现有 Truncate；App 记录物化 text，但返回给 App 的仍是完整原结果。Session 规范结果和模型回放读取已物化 output/attachments，不重新解析原 MCP 结构化对象。故修复共享定义即可同时闭合这些入口，无需修改受保护的 Session/Permission 或 App 文件。

package Tool 直接返回字符串，不使用 MCP 物化，不改变。全仓 Truncate 生产调用仍为五处：上述三个 MCP、package Tool、通用 Tool 包装器；383已恢复的 authority、主项目/Task/Session路径、Read 授权及完整文件恢复合同不变。385请求 metadata 与本问题无关，不改变不可变请求事实。多项目/多 Session 不新增状态，仍使用调用方明确 projectID 与已验证 execution authority。

`git log -S resource.text` 追溯真值判断到 `65d0bfc98` 初始导入；后续 materialize 历史仅 `26ed3e6a4` 的提供者身份修复和 `b3cea6889` 的浏览器截图证据。`26ed3e6a4` 及2026-08-25架构债务记录 ARC-006/007 明确要求内置 Browser/Computer 语义由提供者身份决定，不能从 payload 形状猜测。本修复必须保留该合同。383修改授权实参，385修改请求 metadata，均未处理结构化物化或空串准入。

现有383测试只有单一 text block，覆盖51200/51201字节及2000/2001行，未触发结构化对象或空嵌入资源。result-provenance 测试验证内置身份和截图引用，其通用提供者旧期望只有原 text，即直接固定了本次丢失行为，需按当前完整结果合同更新。computer-contract 中的物化测试验证专用内置 identity/attachment，应保持既有通过。

## 实施契约与精确范围

分析完成后按以下单一实现执行：

- 通用 MCP（明确不是内置 Browser/Computer，或调用方未提供提供者名称）若 `structuredContent !== undefined`，将 `JSON.stringify(structuredContent)` 作为一个新的文本片段附加到既有 content 派生正文之后，继续使用既有双换行分隔。保持原文本顺序、内容与空白、原附件及原 MCP content 不变。即便服务器同时提供 JSON 文本副本也不猜测或删去它；不用文本关键字、JSON解析或深度相等判断去重。
- 内置 Browser/Computer 继续现有按明确身份选择的专用物化，避免把截图原始 base64 数据再次注入正文。此判断只用已经持有的提供者身份，不根据 structuredContent 形状选择特殊语义；通用提供者返回相同形状仍按通用 JSON 正文处理。
- 嵌入 text resource 使用字段存在且 `typeof text === "string"` 判定，空串形成合法空片段并参与原顺序/分隔，和普通空 text block 语义一致。二进制 base64 解码、空 blob、audio/resource_link 支持不属于本批，不放宽既有二进制或未知类型错误合同。
- `isError` 元数据照原值保留；错误结构化对象同样可读。JSON-RPC（JSON Remote Procedure Call，远程调用协议）异常仍由原调用链处理。超限后的原提示文字和错误语义不在本次扩展。
- 不在 wrapper 新增另一份结构化转换或并行元数据字段；唯一生产改动应只落在 `src/mcp/materialize.ts`。

## 正式验证与交付计划

先写后台正向测试，再以正式 `bun run --cwd packages/opencorvus test <明确测试文件>` 隔离 runner 记录改前失败。新测试通过官方 SDK Client/McpServer 和短生命周期回环 HTTP（Hypertext Transfer Protocol，超文本传输协议）真实 tools/call 取得结果，调用真实物化函数和实际 AttachmentStore：验证结构化独立正文、空对象、混合原文/资源/图像及结构化正文、合法空资源、结构化错误详情与 is_error 保留，以及 raw content 原样。全部用明确输出、字节和元数据正向断言，不 mock 返回或替换物化/存储。

在已有383真实包装测试中新增 package/default MCP structured 表示形式，复用现有包安装、真实 Task/Session、运行授权、官方回环服务和完成写入。结构化 JSON 的精确51200/51201字节应分别得到完整输出和完整保存文件；检查精确主项目 Task/Session目录、保存正文、规范完成结果及已有普通 text 预算。通过既有准备而不复制大段运行器。该后台测试建立的消息和状态仅是测试准备，不是模型自然交互，不宣称实际调度端到端。

正式红测确认目标根因后实施生产差异，重跑同一组，再运行相关 result-provenance、383包装用例及必要核心 typecheck（类型检查）。只在本批出现新失败或明确未覆盖风险时扩大；不运行全量测试。短期 HTTP/MCP owner 全部在 finally 中正常关闭，正式 runner 回收隔离运行目录；所有命令及结果日志放 `.tmp-mcp-structured-result-388`。

主要风险：通用服务器同时返回文本和 structuredContent 时输出会比旧版更完整，可能新触发既有预算，这是必要的可恢复结果合同；已有依赖仅文本旧期望需对应修正，不能维持数据丢失。内置截图/身份路径必须保持原有字节与元数据；加入数据不应损坏真实请求不可变 metadata 或权限结果恢复。当前并行 Permission/Session改动如引发准备/恢复错误，保留日志并先与主 agent 对齐，禁止擅改其文件或归为本批通过。

后台检查通过后向主 agent 交接精确文件、命令/退出码/测试数与未验收范围。真实 GPT-6.1 Sol 自然调用两个 MCP投影、依据结构化字段回答、对大结果使用 read 和页面截图不由本阶段冒充；主 agent 统一安排并负责最终提交推送与共享索引同步。

## 正式红测准备记录

首轮 `before.log` 由正式隔离 runner 执行三个指定文件，实际子进程使用 PATH 中 Bun1.3.14，exit1。两条真实投影结构化包装用例在51200字节时得到空串而失败，两个空嵌入资源及结构化错误详情用例也在真实物化边界失败。新 materialize 测试的其余五例尚未进入目标函数：测试误将 SDK 工具输出 schema 声明为 ZodRecord，服务器在输出验证时返回 `undefined is not an object (evaluating 's._zod')`。这五例只能计作本任务测试准备错误，不能计作产品复现。

已依据 SDK 的对象输出 schema 入口将本测试声明改成 `z.object({}).catchall(z.unknown())`，不改 SDK 或产品约束；生产代码仍未修改。另在既有真实包装测试的完成写入后加入 MessageStore 正向读取，证明规范 completed/output/metadata 实际持久化，而不是仅断言 wrapper 返回。保留首轮并再次运行同一正式命令确认全部目标红测。

第二轮 `before-confirmed.log` 正式 exit1，共4 pass / 11 fail / 96 expect。8个新物化用例均通过真实 SDK 回环协议准备，6例在正文对比失败、2例准确进入空文本资源错误；两个投影包装的结构化51200字节正文均实际为空；更新后的通用提供者正文期望失败。原3个文本包装和内置 Browser 证据测试继续通过。没有 SDK schema 准备错误或调度异常，此轮为正式根因红测。

红测后保存/检查唯一生产文件原始差异（为空）与副本，按已落盘合同增加通用显式 structuredContent 的 JSON 文本片段，并将资源 text 真值判断改为 string 类型判断。未修改三个包装器、Truncate、权限、Session、来源或内置语义函数。下一步使用完全相同正式测试及核心类型检查验证。

## 后台实现与验证结果

`after.log` 使用与正式红测相同的入口、文件选择和实际Bun1.3.14环境，exit0。新物化测试8 pass /45 expect；扩展包装测试5 pass /78 expect；结果提供者身份测试2 pass /7 expect。合计15项/130断言。`typecheck.log` 的核心 `tsc --noEmit` exit0。

八个新用例各经过一次真实官方 SDK 回环 tools/call，并检查协议回执与明确正文；混合结果的图像和二进制资源分别进入真实 AttachmentStore，按规范引用读回完整原始字节。原文本及CRLF（Carriage Return and Line Feed，回车换行）、JSON外观文本、服务端JSON文本副本、空资源的顺序分隔、结构化错误详情和is_error标记都按当前合同通过。提供者身份测试继续证明通用提供者（包括未指定身份）获得通用JSON正文，明确Computer仍保留专用identity，Browser截图仍保留严格来源标识。

五个包装用例使用五个独立项目/Task和八个Session，合计16次真实producer执行（12次MCP、4次原package Tool capsule）。八个超限正文文件均读取完整内容并核对主项目Task/Session路径；结构化两个MCP各覆盖51200字节完整返回和51201字节文件恢复。每次完成后重新读取真实MessageStore，验证规范completed/output/metadata。此处文件恢复检查是后台实际文件读取，不等同于模型自然调用Read；内置Tool文本原有2000/2001行覆盖保持。所有短期HTTP/MCP连接在finally正常关闭，正式runner退出并回收隔离目录，无常驻服务。

注意运行环境：启动命令外层使用仓库已有Bun1.4.0，但package脚本按PATH重新解析`bun`，因此本次红/绿实际子进程为1.3.14。已保留同环境红绿事实；根packageManager声明1.4.0，交付前仅在自有命令环境将该已有目录前置PATH，再补跑同一聚焦检查验证声明版本。不修改共享runner、系统PATH或安装运行时，也不把两版本日志混为一轮。

声明版本复验 `after-bun140.log` 三个正式隔离子进程均明确为Bun1.4.0，仍为15 pass /0 fail /130 expect，exit0。该轮使用最终格式化后的新测试源码，三个文件用时分别见日志。`docs-check.log` 为当前package声明的 `docs:check`，exit0（348 ops /26 groups）；`git diff --check` exit0。最后读取四轮日志中的精确runner路径，均已由正式runner正常回收，结果记入 `runner-cleanup.json`；没有借助外部kill或操作用户进程。

本阶段最终文件为唯一生产 `mcp/materialize.ts`、新增物化测试、扩展383包装测试、通用正文期望更新及本spec，共5个仓库文件。全部命令日志和原始生产副本仅在 `.tmp-mcp-structured-result-388`，未保存凭据或运行数据库。未修改wrapper、共享文档、UI或其他任务文件；未提交。主agent接手共享索引、最终复核/提交推送与实际模型/页面验收。本次后台真实成功不外推worker/Mission调度、进程重启或MCP App页面。

## 真实 Sol/MCP Attempt01 计划与授权

主agent已独立复核388全部生产差异和新测试，明确授权 fresh `.tmp-mcp-structured-result-388/live-attempt-01`：沿383现有OpenAI凭据及完整模型目录配对stage，使用原生产NativeService runner、精确GPT-6.1 Sol流式预检与实际请求审计。复用 `.tmp-product-iteration/live-sol-locale-377-after.ps1`、`live-sol-cli-owned.ts`、`live-sol-shutdown.ps1`，不修改/复制共享runner。应用固定18506，公开报告官方SDK回环MCP固定18507；不访问用户进程或窗口，不新增UI自动化，不再次委托。按benchmark-debug-template技能记录输入、预检、无活动时间和验收边界；原生600000ms固定物理资格预算按本次明确授权保留，不用有进展延长它。

应用采用NativeService资格，固定原生600000ms、同进程预检及业务累计20请求、180000ms实际无活动上限。该runner只证明物理/流式服务资格，不假称它已经验证业务Task；本任务另经正常CLI创建精确选择包的真实Task，独立读取规范Task/Session/Tool事实完成业务checker。项目默认Base不变；仅通过正常配置API添加公开MCP，再用官方SDK生成/正常import-folder安装一个精确包。包scheduler明确投影 `default/mcp/publicreports/tool/public-summary` 及包自己的 `empty-note`、`report-archive` 两个MCP能力，因此一个自然Task可覆盖default和package两条投影；若模型实际没有覆盖，只按真实调用报告，不伪造消息或补完成状态。

公开MCP服务有自有前台命令owner、唯一启动回执、有限600000ms寿命、累计请求记录和正常shutdown端点；SDK server/transport在收尾中关闭，HTTP停止后发布closed回执，父命令正常join。先生成所有公开输入和安装checker，再启动两服务以避免浪费固定运行窗口。MCP仅返回固定公共数据：structured-only小摘要；正文+合法空text嵌入资源+structured note的混合报告；超过50KiB的structured-only存档。存档把本次要核对的review_code/record_count放在开头，完整JSON按当前紧凑序列化保存；模型依据真实截断提示使用Read获取所需前部。完整保存文件由checker逐字节核对，不把读工具对超长单行的前部预览误称整个存档进入模型。

验收输入是正常用户Task请求，要求从三个报告核对明确公共字段；包提示仅描述只读资料核对和真实生命周期，不设置Host选择gate、不按请求关键字路由、不mock源码模型或合成模型/工具消息。应自然出现capability search/精确调用、三份真实结果、至少一次对真实outputPath的Read、可见回答及Task completed。独立checker读取只读规范数据库，验证project/Task/Session目录归属、两类投影metadata、三种正文（含空资源混合）、完整存档文件、Read正文、用户答案及原生截止前的正常终态；同一进程审计全部请求必须目标模型、streaming、HTTP200及EOF。失败保持原始错误和未满足项，不放宽合同。

凭据由现有stageDiagnosticProvider移交指定OpenAI项及相邻完整models.json；启动业务前分别确认credential usable、catalog projected和actualModel精确一致。秘密只由CredentialRedactor内存处理，不输出或归档；正常原owner shutdown/join、物理端口释放之后成对删除仅复制的auth/models。MCP服务另行正常shutdown/join，不能由停止应用掩盖它的存活。

应用ready即发送主agent `http://127.0.0.1:18506/ui`、真实Task/session和原截止时间。预算至少保留最后两分钟给root真实页面交互、截图人工复核与关闭；业务未在此前收敛则保留失败事实并按原截止收尾，不延长、不立即盲重试。如出现共享调度/恢复/终态异常，立即共享横审，不能归于本包或模型行为。真实页由root独立操作，本agent只管理后端及自有两个owner。

## Attempt01 真实运行与后台结果

NativeService scope为 `mcp-structured-result-388-live-01-e3b42b40-3b3b-45c6-a224-da6b4b24b7d9`，Host42824/Target78344，原生固定截止2026-10-13 17:58:52.170 +08:00；MCP自有PID84740、occurrence `e7e5286e-9190-4bd9-8804-1fd53fcd09ae`，独立截止17:58:52.862。原启动句柄分别30513/81613。真实预检一次成功，没有准备超时或重试scope。官方SDK包已生成并从正常import-folder安装，项目配置仍Base；正常CLI显式选 `structured-reports-388` 创建业务Task。

真实Task `tsk_g00VXvCmcH00E5YceOHj`，项目 `prj_hhKbA4lObfeHpAZb2F4f`，root Session `ses_-zUS4nDEezzn6QUvUul0`，scheduler Session `ses_-zUS4nCBizz8V6ef3AzS`。模型自然skill、capability_search后调用default摘要及两个package报告，继而对实际保存路径调用read，给出可见中文答复并自然manage_task complete_task。没有注入工具结果、改状态或模型桩。

独立 `check-live.ts check` 于17:52:20.140 +08:00 exit0：三类结果为规范completed，准确保留结构化字段、混合原文/空资源及is_error:false。完整存档178967字节与公开预生成JSON逐字节一致，保存目录为该主项目下该Task/scheduler Session的tool-output；真实Read结果含存档前部review_code及record_count。答案包含全部实际字段，Task lifecycle completed且activity.running=0。全部12条实际请求均精确GPT-6.1 Sol、streaming、HTTP200和reader EOF，在累计20与固定物理截止之内。

规范Part分别为：摘要 `prt_g0VXvCtc300CQksYvU9M`、混合空资源 `prt_g0VXvCxSv00QmuYGOeqs`、大存档 `prt_g0VXvCyii00b256JtfSw`、Read `prt_g0VXvD0Hf00SKnFxSr1a`。完整文件名为 `tool_g0VXvCyrj00fiEuVG6z`。本次真正覆盖Task scheduler下default/package两类MCP投影，不外推普通Chat、worker、Mission、重启恢复或MCP App页面。NativeService资格与该独立业务checker证据边界仍区分。

后台成功之后已将页面、原截止及精确Part交给root，留出超过六分钟实际页面和正常收尾窗口。当前等待root自有页复核/关闭；此段尚不声称页面或物理收尾成功。独立规范结果、Provider审计和checker已由CredentialRedactor处理后写入本次自有目录，秘密未输出。

### 页面、正常收尾及辅助服务警告

root已在独立真实tab24查看Completed答案、展开工具组，人工核对default摘要两个字段、混合原文与JSON、完整恢复路径和Read首部，随后明确关闭自有页。四张关键截图分别为 `task-completed-answer.png`、`default-structured-summary.png`、`empty-resource-and-structured-note.png`、`structured-output-recovery-head.png`；本agent也逐张人工查看并确认与checker一致。另一个 `structured-output-recovery.png` 仅中段滚动样本，不冒称路径头部且不列入关键截图归档。

收到PageClosed后立即调用原 `live-sol-shutdown.ps1 -PageClosed`，同时按独立MCP的精确occurrence正常POST shutdown。MCP关闭46个SDK server全部fulfilled，17:56:33.399 +08:00写闭合回执；Native生产ProcessFacade物理退出/输出排空/请求清理17:56:45.736完成，auth/models复制对17:56:49.275成对移除，均早于17:58:52原截止。Native launcher30513、shutdown12511、MCP81613全部join exit0；NativeService资格回执确认12 EOF请求。未执行kill或操作用户进程。

原MCP服务日志保留一条Bun默认10秒HTTP空闲警告。该警告没有请求ID，不能假称原请求已直接定位；全部3个真实tools/call、规范业务结果和模型EOF仍独立通过。读取官方SDK实现确认其GET独立SSE（Server-Sent Events，服务端事件流）通知通道允许保持空闲。随后root明确授权仅修自有辅助服务，并要求先保留实际模型运行源码原像，禁止用新源码冒称原scope。

已将实际源码保留为 `mcp-service-live.ts`，再在自有 `mcp-service.ts` 增加显式 `idleTimeout: 0`，固定600000ms owner寿命与正常shutdown保持。无模型/凭据短期官方SDK GET探针实际证明：10秒配置下12.5秒观察到明确socket-closed错误；0配置下12.5秒仍等待，正常SDK close/http.stop后为HTTP200/EOF，全部owner fulfilled、命令8403 exit0。该探针归档为“后续辅助修复”，不计新增真实模型验收；探针回执的port在stop后读取为0，仅为已停服务属性，不用它推断实际绑定端口。原scope的三次工具成功、原警告及后续局部验证分别保留。未更改产品源码、Provider、共享runner或重新启动模型scope。

## 归档与最终交接

完整档案位于 [2026-10-13-mcp-structured-result-388](../../artifacts/2026-10-13-mcp-structured-result-388/README.md)，共75文件：明确allowlist保留73份后台/真实/后续辅助证据（含4张关键PNG），外加凭据扫描回执和README。只保存选定日志、公开数据、checker/实际服务源码及正常owner回执；大文本和日志gzip压缩，不复制runtime、数据库、auth/models内容或二进制程序。精确逐项文件清单见 [credential-scan.json](../../artifacts/2026-10-13-mcp-structured-result-388/credential-scan.json)。

最终独立扫描解压全部文本并复验实际/预期存档字节、12个实际请求、原截止和物理配对收尾；75文件严格等于allowlist加README/扫描回执，72份文字（含本spec）及4张人工查看截图已知凭据零命中。当前源凭据metadata与stage时源一致。README和spec共40个本地链接全部存在（README37、spec3）；最终docs:check exit0（348/26）、git diff --check exit0。实际运行MCP源码与后续版本仅显式idleTimeout差异得到核对，二者不混同。

交付冻结范围为4个产品/测试文件、本spec和75个独立档案文件，共80文件。共享索引/架构/CHANGELOG由主agent统一整合；本agent未提交、未改其他任务文件，两个真实服务与后续短探针全部已正常退出。后台与本轮Task scheduler真实MCP链路已完成；本记录明确列出的其他入口仍不外推。
