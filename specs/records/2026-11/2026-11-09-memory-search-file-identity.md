# 记忆搜索条目保持原文件身份

## Recall

用户要求持续批次迭代直至明确停止，最新明确不要子agent，本人独立。前批f9435027a已正常push全部hook通过、HEAD/upstream0/0，原177条无关工作区状态精确保持。先根因/影响/spec（规格），真实前态后再有证据的实现、实际桌面开发/ui与本人截图、聚焦正向检查、范围提交/fetch普通merge/全待推审核/正常push后下一批。凭据/Sol授权仍未有新答复，不重复问、不读或使用认证与模型目录，不进行模型调用。

已读MemoryPanel全源（MemoryFile类型/list与search映射/文件级删除/expandedFileId/detailStates/详情ID）、MemoryContextPanel唯一调用、现07-panel/07-panel-reactivity/02-data、Panel知识list/get/search公开schema、MemorySearch返回原chunkId/fileId与排序、Memory.writeFile/writeChunks/splitChunks。全仓该MemoryPanel仅settings使用；未找到第二记忆搜索分组实现。前批修复分块父项目错误，不改当前合法多分块查询语义；b40/b41已验证日期/score本地化和当前搜索mode，当前不能倒退。已确认splitChunks按##段落生成真实独立chunk，无需长文或模型生成。

## 修改前根因与影响分析

待真实确认：同一Memory文件两个chunk命中同一查询时，后端合法返回两个原chunkId和相同fileId；MemoryPanel逐结果map为MemoryFile并丢弃chunkId，两条相同file身份进For。行详情/删除/展开是文件级，而expandedFileId和detailStates按fileId、详情DOM（Document Object Model，文档对象模型）id也按fileId生成，所以打开一个可能同时展开多个重复整文件详情，形成重复控件和重复详情ID。不是后端重复chunk或数据库损坏；多个命中本应保留在原后端与LLM（Large Language Model，大语言模型）语义检索合同。

界面在原始list/get/delete已经把一行定义为一个真实file，search投影应继续该身份。在现API（Application Programming Interface，应用接口）返回的排名窗口内按原fileId投影唯一行，每文件采用后端排名最靠前命中的score/snippet，文件间次序保留原首次出现顺序；不按标题/正文/关键词判断同一资源，也不新增客户端排名算法。原get继续读取该file完整全部chunk，其他匹配内容仍在完整原文及原HTTP/Tool响应中，不为减少UI（User Interface，用户界面）行而删除或重写记忆。保留原20个chunk查询窗口；去重后可少于20文件，本批不虚称返回20个完整文件或改变公共limit含义。

若复现，直接替换现单次map为同一函数内以fileId为key的Map投影，再用现setFiles发布唯一MemoryFile数组；首个已存在key跳过后续同文件chunk，保持唯一数据来源，无持久file缓存、第二搜索管线、fallback或别名ID。不把chunkId当另一个文件身份后仍复用文件级展开，以免保留两种身份语义。

影响面是MemoryPanel搜索结果的行数/文件身份/排名最靠前摘要与score、展开/详情ID/删除控件指向、清除与语言切换的原状态。现list/文件级动作/权限/source owner/加载token/错误路径保持；后端排名、chunk内容、FTS（Full-Text Search，全文检索）/项目归属、公开HTTP（Hypertext Transfer Protocol，超文本传输协议）/SDK（Software Development Kit，软件开发工具包）/数据库schema与持久格式、模型流式执行均不改，无迁移。未观察调度/队列/唤醒/并发终态异常，此处是同一合法文件的展示身份投影，不降级执行机制异常。

风险：按标题误合并不同文件、按原文去重丢失真实身份、选择非首个后端排名、重排或改公共结果数、清除后仍保留分组缓存、只删重复ID表象而保留重复文件级动作。使用原fileId及原返回顺序的局部Map，与原For文件级语义一致；全量原文仍原get，不静默截断其余chunk。未知项为真实多命中数/排名/当前页面的同时展开表现，必须先真实复现再修改。

## 验收方案（修改前）

Temp b43 before/after各一个真实Git项目、独立profile、私有Git身份/禁签/autocrlf=false与原notes/HEAD seed。原Memory.writeFile写含两个##小节且各含multirowprobe的原笔记，另写一个独立匹配文件；实际FTS返回三个原chunkId/两个真实fileId，保存原排序和得分；不建Session/消息，不调用模型、embedding或凭据。先真实开发39006/ui观察3行和点一原笔记的重复展开/完整原文，截图与原HTTP/schema/数据事实绑定。若实页已有唯一投影则排除假设，不修改产品。

after39007/ui真实搜索显示两个原文件行，首个摘要/score来自原排名最靠前的该file命中；展开整文件同时呈现两个原小节，另一文件独立可读；语言切换保留query/展开与原文；清除恢复两个原列表，再搜索保持文件级身份。本人逐张截图人工查看，必要补稳定帧；只读DOM可解释身份/详情，但不替代视觉验收，不新增或运行UI自动化（DOM/文案断言/组件/快照/浏览器fixture）。

真实TCP list/get/search通过当前运行时/doc schema，原API仍三个chunk/两个file、get完整两节原文不变，只证明未改后端集成合同。纯UI改动无自动化UI测试；typecheck/i18n/正常Node build/renderer/docs/架构辅助验证。最终核对原Git字节/HEAD、两份原记忆身份/Project归属/内容/创建时间，正常shutdown自有服务并消费原session退出0、关闭自有页。只提交MemoryPanel/当前架构/spec/artifacts与三README本条，原177状态保持；不建branch/worktree/tag/Release，不操作用户进程/窗口/凭据。Sol/权限/模型/引擎Task/Mission/Session执行恢复及未知历史错归属数据仍未验。

## 当前状态

已完成下述真实前态、文件级投影和桌面复验；Sol/模型/权限/执行恢复与未知历史错归属数据仍未验。


## 真实前态与实施定稿

before真实领域得到两个原file、三个原chunk与三个排名命中。首命中为多小节file mem_g0VaQKWPb00fl1w7fLf1/第二小节chunk mck_g0VaQKWPd00oqUKAk46B，score0.25163808198470206；第二命中为同file第一小节，第三为独立file mem_g0VaQKWPe00XUInS0Ses。没有重复chunk ID或数据错归属。

39006/IAB92：01普通列表两个原file；真实提交multirowprobe，02显示三条搜索行（同多小节file两条及独立file一条）。只点击最靠前多小节行，03两个同file行同时expanded；原生PageDown后04直接看到两份完整相同的两小节全文，独立file仍其后。四张截图本人实际呈现查看。手动只读DOM解释两个原data-id相同且详情id均memory-detail-mem_g0VaQKWPb00fl1w7fLf1；该观察不替代截图或作为UI自动化断言。

实际TCP list/search/get两原file共四项全部HTTP200/current运行时/doc/Ajv2020 schema，原三个chunkId/fileId/正文/次序/score与领域回执精确一致，两file get完整原文精确。服务原session22874正常shutdown200/exit0/prompts0，自有页92关闭。之后才实施。

定稿为现doSearch内部Map<string, MemoryFile>按原fileId保留第一个后端排名命中，再把唯一数组交给原setFiles。首匹配不是按数值重新排序；保持现后端近似分数tie/创建时序决定的正式排序。SDK已声明且运行时/doc实测返回数组，直接遍历该当前数组，不保留旧非array→空结果的静默成功转换；异常仍由原search error owner反馈，不增后备响应或新错误协议。原query20个chunk窗口、scope owner、list/get/delete、语言派生/当前mode不改。


## 实施与真实复验结果

doSearch原逐chunk映射已替换为唯一局部Map按fileId保留第一个正式排名命中，再发布原MemoryFile数组；未抽象单用逻辑/增持久缓存/改后端或重排。详情/删除/展开沿原文件身份，原20chunk窗口保持，UI文件数可少于20。非array的静默空结果转换随旧map删除，当前类型化数组及异常原error owner不变；本批没有制造或验收非法响应变体。

39007/IAB93真实搜索：05两个原文件结果，Multi-section只一条，摘要为原排名第一个第二小节/score显示0.25，Separate为0.21；未按章节来源位置重排。点击Multi-section并原生PageDown，06一份完整详情含第一/第二小节全部原文，另一文件仍独立未展开；手动只读DOM观察原两file ID各一行、只有所选ID的详情，仅辅助解释，视觉资格来自本人查看06。点击Separate，07该原文件完整正文独立打开，第一文件按原单展开语义收起。08同页中文搜索结果/相关度/详情日期，query multirowprobe/原正文/当前展开保留。Escape清除09恢复两原普通列表和中文日期；再提交10仍两file结果及正确绿色/搜索结果状态。十张原始截图全部本人实际呈现查看，没有UI自动化、文案/DOM断言、组件测试或截图基线。

before/after各四项真实HTTP（list/search/get两file），合计8次全部200/current运行时/doc/Ajv2020 schema通过；两阶段后端仍原3个chunk、2个file，原chunk ID/file ID/顺序/正文/score与各自领域回执精确，两个file get完整原文精确。after原多小节file mem_g0VaQLBAB00WyTZq1i1e，首排名第二小节chunk mck_g0VaQLBAE00cHeGSNkDF，score0.25163808198470206，与界面摘要和0.25对应。未把文件分组伪装成API返回数变化，所有分块仍在原接口与完整原文中。

数据审查两Git项目原notes与seed/HEAD:notes.txt逐字节一致，两原HEAD精确；四份原Memory file身份/Project归属/title/source/kind/不可变创建时间/content完整保持，两小节全文按原chunk读取顺序保持。两DB各Project1/Session0/Message0/memory_file3/memory_chunk4（含host文档），config文件0；原正常生成未跟踪元数据如实记录，未清理。host可变文档时间不设跨读伪常量门槛。

## 辅助检查与交付范围

纯UI改动，没有新增/修改/运行UI自动化或负向测试；未改后端故不无目标重复领域测试，实际API/数据读检查只证明未改后端集成合同，不能替代视觉或模型端到端。Overlay typecheck、i18n2语言/2932键、正常Node build51.40s（main-C-dko5CU.js）/renderer公共面通过；docs352operations/26groups、架构索引20文档与精确diff提交前检查。没有API/SDK/数据库格式/迁移或模型流式变更。

自己before22874与after4621均正常POST/shutdown200并消费原session exit0/prompts0，页92/93关闭。范围仅MemoryPanel、当前07-panel、spec/artifacts与三个README本条，原177条无关工作区状态保持；fetch/普通merge/完整待推集合审查/正常push按原流程，以Git回执为准。无子agent、用户进程窗口/凭据操作、branch/worktree/tag/Release/发布。未获得Sol授权，未进行模型/权限/引擎Task/Mission/Session执行验收；未知历史错归属数据也未查或修复。
