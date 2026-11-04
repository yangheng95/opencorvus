# 长工具记录的数量摘要

## Recall

- 用户授权持续自主改进全部UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能，实际体验后提交推送；最近明确要求提问数量、文件摘要清楚、中英不混写，仅本人一个agent，不操作正在使用的18571窗口、进程和数据库。长期Goal旧三Astra文字由后续单agent要求覆盖，不委托。
- 上轮926是progress：44d243873cadf0a2ff97c020468b4700f543f183正常推送；2026-11-04T15:56:28Z fresh fetch/普通合并后HEAD=origin/main、0/0，32本人普通文件与3索引行已提交，177条无关状态保留。18张实图和3条/13断言非UI测试，真实最终101配置/111项目/273附件保全通过。
- 来源为已正常关闭、保全、配对认证/目录退役的926-final：schema（数据库结构）10、92表、285821行、111项目、101现存项目配置、273附件，累计1367实际模型请求。接受前端main-CwnbdKAa.js；原阶段配置自动再生成失败、恢复与可用性generation例外已留证，不把中间阶段当作全程无写入。
- 已读AGENTS、926 Recall/根因/最终合同、07-panel工具身份和07-panel-reactivity有界传输/独立Question（提问）历史、conversation/transport全部首屏投影与metadata预算、transport-protocol现有deferred/file observations、共享tool.ts的数量/路径与所有调用、readToolPart及原完整性合同、现有非UItransport projection/attachment/command tests、923真实模型与Question反馈原生流程和926全配置保护工具。全仓搜索覆盖定义、Full/Deferred、Task/Session HTTP（Hypertext Transfer Protocol，超文本传输协议）/SSE（Server-Sent Events，服务端事件流）、Moved/Updated、主对话/选中Agent/Side Chat/工具卡/会话对话框、原API（Application Programming Interface，应用程序接口）/SDK（Software Development Kit，软件开发工具包）元数据约定；没有委托。
- 声明同一90分钟绝对截止，至少5分钟正常退役预留；before38696最多24个真实精确openai/gpt-6.1-sol流式请求，after38697和可选final38698各0，总最多24、原累计1367。只在本人新QA项目做一轮真实“长确认问题→真实回复→八份交付”工作，旧111项目/数据/附件保持；after只读相同真实记录。不得因观察超时重启、续期或加额。
- UI只用真实原生开发/ui、自有隐藏页、手动交互和实际截图人工复核；不新增/修改/运行任何UI自动化、文案/DOM（Document Object Model，文档对象模型）/组件/快照/浏览器fixture（夹具）测试。非UI正向数据/传输测试不能冒充视觉或端到端。成对复制认证与完整模型目录并分别验证账号可用、目标模型投影和实际请求一致；不记录凭据内容。

## 修改前问题深度与影响面

可观察线索：926真实1问题和2文件可读，但其Recall已指出长input可被省略。代码确证直接触发：projectConversationTransportPart只对completed的大于4KB state做裁剪，boundedToolInput最多2KB且大输入白名单不含questions；boundedToolMetadata最多1KB，完整file observations超预算时整组移除。当前UI分别读取剩余questions和files，两个事实丢失时只能显示执行状态，展开读取完整Tool后又恢复数量，冷读/首屏与完整阅读不一致。尚无本轮真实长记录截图，须先取得，不能只凭源码当视觉完成。

数据/控制流根因：数量本来是原Tool输入/文件目标的有限事实，却依赖携带大正文的数组存活。旧4KB优化保留完整性标记和按需读取，926修复已知工具的本地化和路径，却没有把数量从大正文拆为同源有限投影。不能解析英文title、补丁字符串或在页面保留影子计数；不能恢复全部大数组到首屏破坏容量合同。

共享影响：Task与普通Session、重连/历史HTTP、实际Message Part Updated/Moved均使用同一transport投影；所有可见工具身份经utils/tool共享。原Tool输出、Question真实原Request/回答/终态、原文件比较端点和readToolPart身份/完整性保持。只是派生传输元数据，不改持久Tool、数据库schema或迁移；Message metadata仍为现有可扩展记录，需核对正式接口/文档没有意外漂移。

非适用与未知：未发现新调度、队列、唤醒或终态收敛异常；若出现立即按AGENTS审计全部Task/Mission/Session生产入口和执行轮次，不归因模型偶发。真实模型可能没有选择单个八文件批次或完整四问题，届时保留实际结果、不伪造工具事实或加额；不能据单例宣称多问题/多文件实页通过。超长单路径可能不能保留全路径，数量仍应来自真实有限事实，原完整路径在披露中保持。

## 实施前方案

1. 从926-final准备新原生before，单独新QA项目两份原始输入，真实页面发送自然业务请求：完整逐项确认四条长说明，收到人工真实四项选择后，批量生成八份独立行动卡并回读核对。原始来源/文件身份固定，模型自行用正常授权工具，不能host绕行或注入消息。先取得原数量掉失的完成/重开截图与公开完整/裁剪事实，正常退役并保全后进入after。
2. 在现有transport-protocol增加同一无状态Tool身份事实投影：精确question从原questions得到数量与真实answered/expired状态，精确apply_patch从原files的规范目标得到去重数量及单路径。完整记录直接派生；deferred记录严格读取同源有限身份元数据，不以title或raw文本补值，不支持旧格式兼容路径。
3. 后端在裁剪前生成有限身份，优先计入原1KB metadata预算；完整文件观察若仍能放下则保持原合同，其余metadata使用剩余预算。数量不能因正文/文件数组过大而消失，整条state仍在4KB内；超预算单路径不截断成假身份，只保留真实计数。原持久state与完整性标记保持。
4. UI共享摘要消费同一事实函数，删除现有两套临时数组计数。中英key与当前路径处理继续使用926实现，不新增第二显示源。补非UI正向测试覆盖4长问题、8文件/重复目标/移动目标、单路径、完整与有界相同数量、历史与Updated/Moved以及总预算；原错误/输出完整性合同保持，当前触及过期/负向测试按AGENTS修正或删除。
5. 正常types、Node构建、正式API/docs/架构检查；after0模型重开同一实际记录，核对中文/英文、数量在展开前后及刷新后稳定，原Request/回答、八个交付和旧回归仍正确，截图人工查看。原始结果与未覆盖项如实记录。
6. 同一截止内HTTP正常关闭、原句柄exit0、物理/输出/请求结清、成对退役和全数据/项目配置/Git/附件保全；归档根目录specs并同步三索引。范围提交、fresh fetch/普通合并、完整待推集合复核、正常push及fresh0/0，不跳钩子、不新分支/工作树或发布。长期Goal保持active。

## 实页复现与实施前方案补充

2026-11-04T16:22Z，本人隐藏页真实选择精确模型并发送简报，模型一次提出四条完整长问题，人工逐项选择四个确认后正常回复；模型单个apply_patch完成八份独立行动卡并逐份回读，19个真实流式请求完成，空闲收敛正常。原input为4065字节，八文件原state为21068字节；公开有界记录均保留deferred完整性标记，但问题/目标数组已移除。截图01—04实际确认完成后及冷读均只显示“已完成”，数量丢失。一次错误读取cards.csv随后glob定位sources/cards.csv，属于明确错误路径请求，原失败事实保持，未发现调度问题。

同时追踪底部“修改信息不可用”：file-change-summary对没有有界路径观察的deferred Tool生成unavailableReceipts，而ChangesPanel的resolveCurrentChangeGroups只返回已有sourceGroups，没有读取这些真实原始记录，所以审阅入口打开仍不能展示文件清单。该路径与同一裁剪根因相关，不能用计数修复掩盖。补充方案：仍保持首屏有界；只在审阅面板可见时，以完整会话/目录/服务授权版本和原记录修订为键，通过现有readToolPart读取缺失文件观察的规范Tool及原完整性证明，再用同一reduceToolFileChangeGroups计算审阅。读取中/错误/重试在面板显式显示；旧目标结果不得展示到新会话。底部将可按需读取的记录说明为“详情待加载”，保留真正缺少比较的原有错误说明。不存在新消息、持久状态、备用接口或扩大模型调用。完整文件计数只在实际路径已知时计算，不把多个Tool计数相加冒充去重文件总数。

模型选择菜单实页另有“配置 Provider…”及说明残留；当前中文语言文件和目标使用指南引用同一提示需同步改为“配置模型服务…”，英语内容保持英语。

before已正常HTTP关闭、原句柄73787 exit0、物理/输出/请求结清、成对副本退役，19次请求全部精确Sol流式200/eof，未用5次额度退休，累计1386；旧111项目/101配置/273附件与源数据库保全通过。新QA首次执行按现有ensureGitProjectMetadata规范追加了.opencorvus/.r/和11项二进制属性，初次业务checker因把这两个新QA维护文件误当作原始业务输入而报错；依据真实代码后验证明确追加字节、原2份业务输入、Git HEAD/引用/索引和8份回读交付，原失败记录保留，不修改基线或旧项目。

## after实页发现的通用代码标题语言

after的14张新增真实截图已经确认中英4/8数量、八路径/新增56行审阅、筛选第八份、应用内普通文件阅读、切换另一项目仅2路径、展开/刷新数量保持。截图17同时发现产品代码块默认标题仍为CODE；原始工具输出中的英文与CSV字段属于真实原文，不应翻译。全仓搜索wrapCodeBlock、renderCodeBlock、md-code-lang和截取提示，当前唯一实现是utils/markdown.ts，代码阅读和marked围栏共用；历史artifacts副本为旧证据，不是生产路径，没有发现对应当前UI自动化测试。直接触发是language空时硬编码code，两个显示截取点和无说明图片省略也使用固定英文。现有缓存键已包含localeTag，复制按钮已经使用同一t本地化，无需新状态、配置、服务或持久迁移。

实施前补充：默认标题使用“代码”/Code，显示截取和图片省略提示使用当前语言；实际语言标识、工具输入输出和原始文件仍保持原文。最后一个预先声明的final38698阶段保持0模型、继承正常退役保全的after，在同一真实提问/CSV披露中实际查看中文“代码”，再检查中文4/8摘要与审阅，原生关闭和完整保全后交付。超大正文截取与无说明图片省略条件本轮未有实际呈现证据，不把简单文案改动当作这两条件的完整视觉验收。

验证工具修正留证：新增传输测试初版没有给live envelope声明orderKey，schema据合同保留了原对象；修正为真实VisiblePart后30条/155断言通过，未放宽生产校验。另一次测试命令误将Bun二进制交给Node，已按原Bun运行器重跑通过。类型检查发现状态字段unknown及Feedback/Button参数错误，按当前primitive契约修正后8工作包类型检查通过。旧Task比较器最初把新增派生identity当成原业务变更；现从完整Part逐项正向核实3处派生计数，并对其余原始响应完整比较，旧4Task、3Goal、收件箱及文件读取检查全部通过，不修改原始事实或schema。

## 验收结果

最终接受main-D-Lc2Rbr.js。21张本人实际查看的[原生页面截图](../../artifacts/2026-11-05-bounded-tool-summary/README.md)覆盖真实待答、完成数量丢失、中英修复数量、完整披露、刷新、八路径/新增56行审阅、筛选第八份、应用内当前文件阅读、中文模型提示、切换另一项目仅其原有2路径和最终中文代码标题。实际原Question state7938字节、input4065字节，有界state从430变为507字节；八文件原state21068字节，有界从2539变为2593字节。4KB state与1KB metadata限制保持，完整Part、持久请求/结果、真实Question询问/回答和8份实际回读文件一致。只在共享transport metadata中新增有限派生事实；未改变原始Tool存储、数据库结构或迁移、OpenAPI路由/类型及SDK。

- 正向非UI命令：`bun test --cwd packages/opencorvus test/conversation-transport-projection.test.ts test/attachment-write-transport.test.ts test/conversation-command-exit.test.ts`，30项、155断言；真实历史/Updated/Moved投影、4长问题answered/expired、8去重目标、移动/单目标/超长路径、metadata/state预算、原读写与退出事实通过。所有命令均经隔离运行器，未运行UI自动化。
- 当前`bun run typecheck`8工作包通过；项目配置下Node真实构建通过；`bun run api:routes-check`6规则/36文件、`bun run docs:check`352操作/26组通过。后续提交前文档与正式推送hook仍按当前仓库合同执行。
- 公开回归：15个原Mission、4个原Task完整响应（新增3处派生identity先对完整Part正向验证）、原Goal915与923两条Goal、24个有效/未读收件箱及查询、Office二进制/文本/明确404、Question历史HTTP/SSE均正确。三个阶段都分别验证账号200、精确模型已投影，before19次真实Sol流式200/eof，after/final各0次，5次余量退休，累计1386次。
- before285821→290282行：原业务内容及源数据库保持，两个原本已过期的共享容量槽在真实运行中正常复用并释放，不能把该阶段称为所有原始行完全不变。after290282→290284、final290284→290286均仅增加当前控制授权/租约各1行，全部原始行和源数据库保持，无可用性generation例外。最终112项目/102现有配置/275附件及Git/文件全部保全；原111项目/101配置/273附件始终保护。
- 本人三个原生服务全部经HTTP200正常关闭，原始句柄73787/67584/12312均exit0，物理完成、输出耗尽、请求清理与启动器退出结清；6份配对凭据/目录副本全部退休，原凭据/模型目录元数据保持。final关闭时距共同绝对截止尚2618779毫秒，不延长预算、不重启观察、不操作18571用户窗口或数据库。

未达成范围：未对超大正文截取、无说明图片省略或审阅读取失败/重试注入故障做真实视觉验收；八文件实页为新增，移动及重复路径只以非UI正向契约覆盖，不冒充真实模型用例。后续可继续评估很长的已回答问题历史阅读密度，属于下一批体验，不在本批扩展为无关重构。长期Goal保持active，用户后续单agent约束继续生效。
