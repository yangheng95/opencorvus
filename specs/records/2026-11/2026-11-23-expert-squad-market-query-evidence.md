# 专家团市场推荐以当前查询的词语证据为准

## Recall

用户要求本人独立持续分批调查和交付，先落盘根因、影响与验收，再实现、真实桌面交互和本人截图复核、聚焦正向测试、范围提交、合并上游及正常推送。前批已核对远端 `main` 为 `516d8a9c13f66f0f4cfa64e5db702ebfebb0ffed`，177 条原工作区状态完整保留。本批使用独立项目的内置市场目录，仅做查询和界面交互，无 Provider 凭据、模型调用或外部安装。

已读 `MissionCreateDialog`、`ComposerReferenceSelector`、共同市场读取资源、`loadExpertSquadMarket`、`expertSquad.market` 路由、`ExpertSquadPackageManager.payloadMarketPage` 的范围/候选/排序/游标、包索引正文来源、`capability/fuzzy` 的大小写折叠、词权、正文和中日韩词语与短语，以及市场链路和相关性正向测试。全仓核对 `scoreDiscoveryFields`（能力目录、已安装专家团、技能和随包市场）、`scoreDocumentField`（市场与自身测试）及所有市场页面调用。设置中市场数量和安装目录用空查询，公共网站有独立发布目录。现有[市场重试](2026-11-12-expert-squad-market-query-retry.md)保留真实当前查询，[上批键盘验收](2026-11-23-mission-squad-search-keyboard.md)的异常画面是本批线索。查阅现有依赖的主文档与本地 `fuzzysort` 3.1.0 实测。所查范围未发现界面自动化测试。 [fuzzysort 项目文档](https://github.com/farzher/fuzzysort)

## 根因和影响（实施前）

隔离基线 `40624/ui/` 提供 `main-DWL_DZIN.js`。真实 Work 专家团查询 `repot indoor succulents` 在新建任务和项目输入区都列出采购、客户运营和法证会计。同一正式市场请求给出 114 项，正好等于未过滤的可安装 Work 目录总数；已安装搜索独立返回 0。`zzreview424noresult` 和空格分开的 `zzreview 424 noresult` 在市场分别返回 2、114 项；下拉首屏的 `research` 正常相关。真实领域术语 `unpaid claim triangle` 同样返回 114 项，正确首项 Actuarial Reserving 之后是生物制药质量与支付欺诈运营。[实页证据](../../artifacts/2026-11-23-expert-squad-market-query-evidence/README.md)

在独立脚本中使用实际包索引、语言投影与现有分数函数，逐字段重算并核对正式路由的顺序与计数。无关园艺查询前三项的短资料分数分别为 0.352、0.265853、0.262128，正文分数远低于此。`zzreview424noresult` 的两个分数约为 0.2514、0.2378，均来自短资料。仅把现有 0.22 下限用于正文仍会接受园艺查询的 6 项与紧凑查询的 2 项。短资料接受任意字符顺序内的弱匹配、散落模糊词和字符片段作为命中依据。长正文的任何非零分数绕过了短资料已有的统一下限，查询中有空格时任意低相关片段也进入目录。已有正文权重只降低名次，不能阻止进入结果。两处界面的真实结果与直接请求完全一致，因此当前查询归属与界面缓存不是复现根因。

影响限随包市场有查询时的可匹配集合、顺序、页数及两处推荐内容。空查询浏览、可安装/已安装范围、项目与工作类型、安装资格、准确包身份、错误和游标共有合同继续走现有机制。能力工具、已安装目录和模型可用技能继续使用原有普通发现偏好。实施用包内现有语言文本和现有词权，不新增人工关键词、目录来源或并行查找。未观察到执行、调度、队列或终态异常。风险包括把领域精准词压掉、已有查询容错退化、序列/游标归属变化，以及国际语言混合查询产生误排。

## 方案与验收

使随包市场所有来源以同一套加权相关性函数接受当前查询。对使用空格分词的查询，要求对应字段提供实际语句或词语证据。保留完整标准化搜索词组、词语自身、前缀与近似词形，多词查询需要至少两个不同的词，专名/标识仍可通过有限的词内拼写差异提供证据。长正文不能用散落字符单独入选。中日韩继续使用已有无空格文字证据。每个字段已有权重继续参与排名，正文与短资料均按现有最低相关性统一入选。普通发现调用的输入及排序合同保持。以脚本对实际目录预测，三种无关语句的通过数为 0，三项主要 `research` 建议保持原序，中文合同仍以 Commercial Legal 首选；精算短语仅剩具体领域包。正式接口和实页结果以候选真实运行验收为准。

聚焦覆盖专名和拼写近似、正文领域精确命中、双语商业合同和代码场景、实际安装路径和现有已安装发现。候选实际测试新建表单与输入区的无关短语/精算短语/正常关键词、本地化中文合同及修正查询后的结果，留存正式请求、目录排序和截图。核对项目范围、计数、错误访问、空查询、工作类型过滤及游标、检查 SQLite 数据、正常关闭。运行后端和界面类型、相关测试、构建、语言及文档检查后范围提交并推送。

## 实施与实际验收

在 `40626/ui/` 通过正式项目服务加载 `main-DWL_DZIN.js`。新建多步任务和项目输入区的 `repot indoor succulents` 都在市场结算后显示相应空结果，新建表单保留原选 Dynamic 和查询。两处把 `unpaid claim triangle` 显示为一条 Actuarial Reserving。英语 `research` 仍按 Browser Research & Acceptance、Deep Research、Equity Research 排列前三项。中文询问商务合同后，Commercial Legal 仍是第一条，说明和安装控件使用当前界面语言。再换到原紧凑错误查询显示中文无匹配。本人复核 5 张基线和 8 张候选截图。[截图与观察](../../artifacts/2026-11-23-expert-squad-market-query-evidence/README.md)

正式接口复核三条无词证据的查询均返回 0，已安装查询 `research` 仍返回 Research Studio 和 Base。市场 `research` 从 24 项收敛为 20 项，候选第二页依次为 `sales-strategy`、`scientific-research-design`、`academic-paper-review`。英文词内漏字 `reserch` 的前三项仍为 Deep Research、Equity Research 和 Browser Research & Acceptance。空查询逐页核对 6 页与同序的 114 个真实可安装身份。用真实研究游标请求精算查询，响应 HTTP 400 与 `ExpertSquadCatalogCursorInvalidError`。Code 场景 `build a landing page` 返回三个支持该工作类型的包，首项 `frontend-innovate`。基线和候选两套存储均健康，会话、消息、Provider（模型供应商）请求、结果和用量全为 0。两套服务均通过正式接口正常退出，端口释放。

相关性与市场生产路由 21 项聚焦测试、522 个断言通过，包含准确的精算结果、词内漏字、跨语言、安装回读及五个内置目录读取。后端类型、Overlay 构建与渲染器边界、2 种语言 3271 个键、文档 353 个接口操作及 20 份当前架构文档检查通过。查询相关性由确定性本地索引产生，未调用真实模型。安装回读通过现有后端正向测试覆盖，桌面验收使用只读目录。
