# 显式记忆稳定键的完整性合同

## Recall

用户持续批次迭代至明确停止，最新明确不要子agent，本人独立。前批9885429a0已正常push全部hook通过、HEAD/upstream0/0，原177条无关状态精确保持。根因/影响/spec（规格）先落盘，实际证据后实施、聚焦正向测试、真实开发/ui与本人截图、范围提交/fetch普通merge/全待推审核/正常push后继续。Sol/Provider凭据授权无新答复，不重复问、不读认证或模型目录、不发起模型调用。

已读Memory整个key数据流：normalizeKey、createFile/private updateFile/writeFile、findByKey SQL、deriveAtomicMemories与captureEpisode两生成路径、全部外部生产调用（MemoryTool.write唯一）、MemoryTool参数/执行/输出、实际Tool wrapper及既有Planner合同测试写法、原Memory/Project类型/FTS（Full-Text Search，全文检索）路径、现02-data/07-panel边界。全仓Memory.writeFile/createFile/captureEpisode生产调用及所有normalizeKey/input.key已搜索；没有现InvalidMemoryKeyError。相关测试未发现显式空key固定旧合同；只有搜索夹具DB列key:null。未新增或运行UI（User Interface，用户界面）自动化。现120字符截断/大小写/NFKD/符号折叠语义不在本批改变，不擅自收紧已持久化canonical（规范）key格式。

## 修改前根因与影响分析

待真实确认：MemoryTool的key是可选稳定标识，宣称重复写入幂等；提供空字符串/空白或只有分隔符时，入口input.key真值分支与normalizeKey输出空串再次被真值分支当作省略，findByKey未按稳定身份读取，重复写入变成两个新file。直接createFile对不同输入可能落null或空key；writeFile二次传给createFile又可能把空规范key转undefined。错误是显式输入的身份丢失，而不是后台重试、队列/唤醒或终态收敛异常；正常未提供key本来就应建立独立新记忆，不能禁用该能力。

旧normalizeKey只返回string（trim/lowercase/NFKD/非字母数字折叠/截断120），没有明确非空身份合同；create/write/update各用input.key真假决定是否调用。修复应区分undefined与明确提供，非空规范化仍用同一个现算法；明确提供但规范化为空映射命名数据完整性错误，不能悄悄省略key或按title/正文找旧file。不得以模型提示文案代替真实writer校验。

拟在现唯一normalizeKey计算后，对空规范结果抛现NamedError机制生成的InvalidMemoryKeyError（code invalid_memory_key），message说明需至少一个Unicode字母/数字，不回显原输入避免扩大日志内容；key可省略的各入口用undefined判断，继续同一writer/事务。MemoryTool参数说明同步真实合同，无新tool gate（流程门）、工具发现或路由旁路。内部原子记忆的两个生成器总以fact/profile/lesson kind前缀调用，规范key必有该前缀；新的明确非空合同使其旧!key分支无实际意义，可删该分支保留seen去重，不改原子提取、文本规则或排序。新错误属于内存领域/Tool输入完整性，不是REST（Representational State Transfer，表述性状态转移）写路由的新协议。

影响面：Memory/index.ts三处可选key边界与唯一normalizer、两处原子生成调用、MemoryTool.write元数据/真实异常、相关现测试与新聚焦正向合同、当前数据架构。合法key规范化、按(Project,kind,key)定位与原fileID/内容更新、真正省略key的新file分配、createFile+writeChunks、host保护、FTS与项目归属均保持。SDK（Software Development Kit，软件开发工具包）/公开HTTP（Hypertext Transfer Protocol，超文本传输协议）/数据库schema版本10及持久格式不改，无迁移；未知历史无key/空key或重复文件不能按标题合并/删除/重挂，不宣称修复历史记录。

风险为误把省略key拒绝、改变合法Unicode/分隔符canonical身份、异常后部分持久化、误影响原子记忆生成、只改单Tool提示而领域仍静默建档，以及把fixture当模型端到端。使用现normalizer唯一错误合同/所有入口presence判断与真实writer/Tool wrapper/SQLite正向结果；模型/调度机制不改，现未观察这些执行异常。若出现调度/并发/恢复异常按全局要求全横向审计，不由key名字推断原因。

未知：实际重复file数量/返回key字段、Tool wrapper如何暴露命名错误、真实页面对应列表/搜索现象；先真实复现后修改。没有新稳定身份时必须报明确错误，不能编造或自动补key；不改变用户/模型原始标题/正文。

## 验收方案（修改前）

Temp b45 before/after各真实Git项目、独立profile、私有Git身份/禁签/autocrlf=false及原notes/HEAD seed。原Memory.writeFile对提供key='---'的两次同标题重试实际写入，保存原返回/持久身份/FTS；同时合法Unicode规范别名两次更新同原ID，真正省略key创建两份独立原笔记，区分故障与正常能力。不创建Session/消息/模型输出、不使用Provider/embedding/凭据。before39010开发/ui搜索retrykeyprobe观察同标题两个真实file，展开各真实内容并截图；不是UI分块重复（原两file ID不同），不沿用前批按file ID投影隐藏身份问题。

确认实际根因后补实施定稿，新增聚焦真实SQLite测试：合法Unicode别名更新原身份/当前内容；显式空/空白/分隔符/emoji/组合符号映射明确Error name/code/data；createFile相同输入合同；真正省略或undefined形成两个独立合法文件；实际MemoryTool wrapper错误与后续正常稳定写入。为避免把新constructor不存在当red证据，红态只检查既有Error实例及所要求明确name/data输出，不能依赖尚未导出的新symbol失败。测试使用正式backend runner，不含UI自动化/核心负向断言。原子生成的kind前缀/seen及合法现查找路径需读/测相关当前正向合同，不无目标跑全量测试。

after原领域错key返回明确错误后，合法别名更新仍同file ID、省略key两独立file；独立39011进程真实API（Application Programming Interface，应用接口）list/get/search与当前/doc schema精确原ID/内容。实际/ui合法稳定笔记搜索/展开和省略key两文件保留，本人截图人工查看；该页面只读集成，不伪称公开HTTP暴露write或模型端到端。前端未改，沿用main-Dxl2eBc2.js，无UI自动化或无目标重建；backend类型/docs/架构辅助检查。Tool wrapper单测可创建真实隔离Session上下文但不写伪消息，不能称实际模型验收。

最终核对原Git字节/HEAD、保留的原文件身份/归属/创建时间与明确合法更新内容、config清单；正常shutdown自有服务/原exec exit0、关闭自有页。只提交本批实现/描述/测试/现架构/spec/artifacts/三个README本条，原177状态保持；无branch/worktree/tag/Release、用户窗口进程/凭据操作。Sol/完整权限模型/Task/Mission/Session执行恢复和用户未知历史重复数据仍未验。

## 当前状态

已完成下述真实前态、命名错误修复、聚焦测试、持久读取和实际桌面复验。Sol/模型/权限/执行恢复及用户历史重复数据仍未验。


## 真实前态与实施定稿

初版隔离checker错误假设RÉSUMÉ与resume是当前规范别名，实际NFKD（Normalization Form Compatibility Decomposition，兼容分解）后的组合重音被现非字母数字折叠为分隔符；SQLite真实key分别re-sume-记录与resume-记录，原checker因此在合法ID断言失败。保留初始profile-before、helper-alias-failed.log及helper-canonical-key-observation.json。修正第二原输入为re-sume 记录并用全新唯一前态profile-before-recheck重跑；不是改生产规范化或放弃检查，两个确实相同的规范key现在映射同一ID。

修正checker实际before：`---`两次写入均接受，原file ID mem_g0VaQT47v00w4QUJWM1K / mem_g0VaQT47z00JlUBFpWLy，原返回key缺省、实际SQLite文件各自持久，FTS回两原正文。真实合法Unicode别名归re-sume-记录/原ID mem_g0VaQT48200baXa9VnyC，当前正文更新成功；真正省略key的两份也各自合法。共5原文件，不把所有新增记录定性重复。

39010/IAB96实际01五原列表；提交retrykeyprobe，02两同标题原文件各自实际命中，03/04分别打开第二/第一原正文。它们是两个不同fileID，前批正确文件级UI投影应保留，不能按title合并掩盖后端身份丢失。四图本人呈现查看。实际TCP list/两查询/五exact get共8次HTTP200、当前运行时/doc/Ajv2020 schema通过，原ID/规范key/完整正文与领域回执精确。页96关闭，before原session14591正常shutdown200/exit0/prompts0。

实际Tool.define先按声明parse，writer Error原实例继续抛出，不需要包装/绕开。定稿采用现NamedError.create，域Memory.InvalidKeyError实际name InvalidMemoryKeyError/data.code invalid_memory_key，message `Memory key must contain at least one Unicode letter or number`，不回显原输入。create/write/private update均明确undefined语义并复用同一normalizer；findByKey/原idempotent查找和合法算法120上限不改。现MemoryTool描述同步。全仓captureEpisode当前只有该导出定义、无本仓生产调用；保留导出合同，不扩大删除。其两路径kind前缀总非空，移除只因旧normalizer可能空而存在的两处!key检查，仅保留原seen；新增一项正向真实领域检查覆盖两条合法派生路径，故聚焦总6项。测试红态检查现Error实例/name/data，不依赖新symbol；实际Tool fixture用真实隔离Session但空messageID/无消息记录，不冒充LLM或编造消息。


## 实施与聚焦测试

唯一normalizeKey保留现大小写/兼容分解/符号折叠/120字符上限，并对空规范结果抛真实InvalidMemoryKeyError（invalid_memory_key），不回显原输入。create/write/private update明确只以undefined表示省略；合法规范key仍按原Project/kind/key查找并原事务委托create/update/chunks。两原子生成路径仅删现非空合同下无意义的!key检查，保留seen/原前缀；未删除当前导出能力。MemoryTool说明同步，实际通用wrapper保留Error实例，不加host路由、流程门、第二写路径或模型交互。

正式新测试stable-key-contract.test.ts在修改前3pass/3fail/11断言；两个领域边界和实际MemoryTool wrapper均接受坏key，后者真实返回Saved: Invalid tool key及新fileID。失败是原实际writer输出，不是新constructor/import缺失。原wzBvcq失败runtime保留，physical/output settlement=true。修改后6pass/28断言：合法Unicode别名、五类空规范输入、createFile同合同、真正省略/undefined、实际Tool错误与合法更新、两原子前缀派生。加同次原chunk-project-ownership5pass/16断言，共11项/44断言。均原SQLite/领域/Tool当前正向输出与明确错误契约，不含UI自动化或核心负向测试。Tool测试实际隔离Session/空messageID/无伪消息；不等同模型执行。

## 实际持久数据和页面

after真实领域同`---`两次均返回InvalidMemoryKeyError和code invalid_memory_key；同真实合法Unicode别名两次写入仍复用原file mem_g0VaQUWN100H3BDnu2hZ/规范re-sume-记录，实际FTS返回当前完整正文。真正省略键仍分配两个不同合法file，实际列表3个；没有改写前态或用户历史。该KeyError是领域/Tool接口错误，未增加公开HTTP写入端点。

领域进程退出后在同profile启动独立39011。after实际TCP list/stable search/三个exact get共5次HTTP200/current运行时/doc/Ajv2020通过；before8加after5共13次，原ID/key/title/完整正文/当前查询回执精确。UI本人39011/IAB97：05合法原稳定文件及两独立无键文件；06真实查询stablekeyprobe/展开当前原正文，读到原同file的更新内容；07实际unkeyedprobe仍两个独立原笔记，08第一无键原文单独展开。八张前后原始截图本人呈现查看，01初始长列表有下方视口裁切，02–04清楚给出两真实重试文件，06–08为主要合法集成证据。前端未改，沿用前批main-Dxl2eBc2.js，不无目标重建；API与Tool测试不冒充模型或UI自动化验收。

审查两个原Git项目notes与seed和HEAD:notes.txt逐字节一致、两原HEAD精确。实际验收before-recheck五、after三共八原语义file身份/Project归属/title/source/kind/规范key/不可变创建时间/完整最终正文一致；两合法别名写入预期更新正文与标题但保留原file ID/创建时间。两profile各Project1/Session0/Message0，before memory_file6/chunk6、after4/4（含host文档）；config文件0。原失败profile保留，不与有效before数据混用。正常未跟踪项目元数据如实记录，未清理；可变host时间不设伪常量检查。未知用户历史无key、空key或重复资料未读、未合并或删除。

## 检查与交付范围

backend typecheck及聚焦11项/44断言通过，docs352operations/26groups、架构索引20文档与精确diff提交前检查。未修改API/SDK/数据库结构版本10/持久格式、模型流式或引擎调度路径；未新增/运行UI自动化、mock或无效摘要门槛。初版alias checker错误经原代码/真实SQLite事实修复并重跑，原日志和观察记录保留。

自有before14591/after38530均正常POST/shutdown200并消费原session exit0/prompts0，页96/97关闭。只提交Memory writer、Tool说明、新聚焦测试、当前02-data、spec/artifacts与三个README本条；原177条无关状态保持。fetch/普通merge/全待推集合审查/正常push以Git回执为准。未使用子agent、用户窗口进程/凭据/Release/tag/branch/worktree。Sol/完整模型权限/Task/Mission/Session执行恢复继续未验。

暂存差异检查发现Bun红态错误片段三行空白源上下文带尾随空格；仅规范化仓库证据复制件这三行，Temp原始红态日志完整保留。重新检查完整暂存差异，不绕过hook。
