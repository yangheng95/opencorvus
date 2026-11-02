# 任务看板的可见内容搜索（894）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，实页验证后提交推送，不操作用户窗口。后续单agent要求覆盖旧Goal三Astra文字。上一轮893属于已改变权威状态的progress：077068f1fa107548dc3970a183e8517d1b350503正常推送、fresh HEAD=origin/main/0/0，22普通文件/2本地化字段/三索引行干净，177项无关改动保留；原服务42636消费exit0、HTTP（Hypertext Transfer Protocol，超文本传输协议）关闭200、物理身份/输出/请求闭合、配对凭据/模型目录副本退休。源893-after严格资格259462行、schema9/92表、100项目文件/Git、229附件，模型0、累计1260。

已读：AGENTS、893 Recall/资格/推送；07-panel看板布局/筛选/项目身份/当前选择；MissionBoard全部搜索、卡片、子任务预览、结果/草稿展示、筛选和空状态路径；现text-search的matchesSearchTerms/Parts；mission-board全页加载/authority（权限）/sequence（序列）/分页/刷新合同；MissionRecord含原请求/结果/子Task标题与description的已有SDK（Software Development Kit，软件开发工具包）类型；SearchField完整props（属性）/TextField.Input转交；全仓20个生产TSX文件的SearchField调用位置，默认可选新属性不改变现调用；CommandPalette/项目选择器使用现all-terms primitive（所有词匹配基础函数）的语义。891真实741结果与子Task原文、888真实草稿请求作为只读候选，不从标题猜执行事实。

## 修改前根因与影响

候选现象待before实页确认：看板卡片可见pendingPrompt.text、outcome.summary和子Task标题，但visibleMissions只在title/missionID/directory/当前项目显示名四项逐字段includes整段query；因此按原请求/结果/子Task查找遗漏，把项目名和标题词组合也落空。项目名本身已经参与匹配，不把892已修路径或项目名搜索误当新缺陷。数据流为现全页Mission列表 → 前端visibleMissions → laneMissions → 原卡片；不是数据库缺记录、分页只搜当前页或模型执行失败。

修复保持同一现列表/权限/刷新owner和规范Project显示名。只在MissionBoard定义本区域的missionSearchParts，包含原标题、Mission/Session身份、真实及规范斜杠路径、当前项目名、已保存请求、结果摘要和受阻事项；visibleMissions用现matchesSearchTerms，附加全部真实子Task的title/description，所有词可跨同一Mission字段匹配。原项目directory精确筛选先执行，五lane次序、数量和状态由原事实决定；搜索不修改原文、任务顺序或执行状态，不请求第二列表。

卡片当前固定预览前三项；若搜索命中靠后子Task而预览不变，会出现“搜到但看不到为什么”的新困惑。给唯一MissionBoardCard挂载传现查询，用相同父字段/匹配primitive为各子Task算相关性，在本地拷贝中稳定优先展示匹配项，最多仍三项，其余数量保留原总数减三。空查询保持原顺序；不重排原store，不改变进度、剩余数量、子Task身份和打开Mission的callback（回调）。真实数据是否有三项以上未知，不构造夹具界面；至少对原第二项的查询观察它优先呈现，未覆盖项如实记录。

两语言增加搜索范围/所有词提示，并调整占位说明；用原controls容器的自然换行和既有设计token（设计变量），不改看板密度或lane结构。SearchField只新增可选ariaDescribedBy并直传给现TextField.Input，使新帮助段与搜索控件相连；所有既有调用不传时保持原语义，不复制搜索控件或新增平行状态。项目上下文仍显示原路径。无需后端/接口/SDK/schema/持久格式改动；纯UI变更不新增、修改或运行UI自动化测试，也不写映射实现的伪单测。

不涉及调度、队列、唤醒、并发执行、终态或恢复任务；当前没有其异常证据。若实跑发现则立即按共享机制横审，不由本页过滤结果推断调度正确。风险是跨项目混入、只在父字段匹配、匹配子Task未呈现、改动原任务顺序、空状态/清除失效及帮助挤压布局。验收需真实页面和截图；类型/构建/DOM（Document Object Model，文档对象模型）观察不替代视觉复核。

## 实施与验收

首次before/after模型额度各0、75分钟共同绝对截止和5分钟闭合预留，不重启/续期/加额。本人CLI（Command Line Interface，命令行接口）38615/38616的`/ui/`，before用893最终UI，after用Node.js构建本人UI目录；不启动独立Vite或操作用户18571。全部旧行/100项目/Git/229附件保全，认证和完整模型目录配对验证/复制/退休。仅只读已有数据，不新建/编辑/归档/恢复或执行任何任务。

1. before实页查询888原请求“未保存输入”、741子Task名、项目名与标题组合、原结果文字，保留错误空结果和原卡片实证；公共reader完整分页核对原身份/原文。正常关闭原句柄/HTTP/物理资源/配对副本/全旧数据资格后再改产品。
2. 唯一字段集合/现所有词匹配/稳定预览及帮助关联，删除旧逐字段整句匹配。类型/本地化/CSS（Cascading Style Sheets，层叠样式表）/docs和Node构建；不使用UI自动化。
3. after原请求→同一Mission实际打开阅读→返回看板；子Task/结果/跨字段/规范路径搜索，真实项目筛选交集、清除/无结果重置与中英文帮助/卡片预览截图；公共reader逐字段等于before。实际覆盖据结果记录，不声称三项以上数据或失败读取像素已验。
4. 正常关闭本人服务、原句柄exit0、物理链/输出/请求闭合、配对副本退休、严格全旧数据资格；三索引和文档检查，范围清晰提交、fresh fetch/普通merge/完整待推集合、正常hook/push和fresh0/0。持续Goal仍active。

## before实证

38615的01–04实页截图分别为“未保存输入”、完整原子Task名“订单精确计算与汇总交付”、“Project journey773+表单校验”及原结果“3笔合计40.00CNY”的错误空结果（截图保存实际空格）；05按同一原Mission ID找到受阻卡片，原Task顺序为客户原件复核在前、订单计算在后。公共reader完整分页实际13条、最多2个子Task，精确原请求/结果/子Task名均存在；未构造三项以上或新模型任务。本轮原native句柄22549消费exit0，公开关闭HTTP200、物理身份/输出/请求闭合、配对副本退休。严格资格259462→259464仅两条租约，100项目/229附件/schema9/92及源数据保全，0模型请求、累计1260。

## after实际验收及闭合

38616实页实际加载main-DcnaJLIA.js。06按原请求片段找到原888草稿，07实际打开后仍是同一Session和完整原文，再由原Board入口返回。08按原第二子Task“订单精确计算与汇总交付”命中同一741并优先显示该完成子Task，原1/2进度和失败数保留；09按原结果合计找到同一741，父结果命中时仍保留原子Task顺序。10项目名+标题跨字段命中原886；11正斜杠路径找到同项目原885/886两项。12搜索888请求同时选择773项目，正确为空且说明当前搜索/项目；13原Reset同时清除两项筛选并恢复原13条/原Task顺序。14中文帮助/占位完整，混合ASCII大小写项目名+中文标题仍命中原886；15中文无结果有明确重置入口；16实际重置后又输入子Task查询并按Escape，查询清空、原lane数量和子Task顺序恢复。全部16张截图人工查看，08/14原图另经本地复核。两语言输入框的实际aria-describedby均指向当前对应语言的可见帮助文本，只有只读观察，没有DOM断言或UI测试。

after启动后和全部交互结束后分别完整分页读取同一13条MissionRecord，逐字段等于before，包括所有原Task顺序、状态、请求和结果；最大子Task数仍2。此证据说明仅改变当前展示，没有重写业务数据，不替代截图对搜索行为的人工确认。三项以上预览截断、单独受阻事项/子Task描述词命中、失败读取和超长查询未单独实页验收，不声称已覆盖。

overlay类型通过；2755键/2语言、本地化/CSS9066引用/402TS/TSX及文档352操作/26组通过；Node构建exit0，仅保留既有大chunk提示。没有后端、路由、SDK、schema或执行机制改动；纯UI修复不新增/运行UI自动化或映射实现的单测。本人tab185关闭，公开shutdown HTTP200，原服务53391消费exit0，settle确认原native/launcher及物理身份/输出/请求闭合，配对认证/完整模型目录副本退休。严格资格259464→259466仅两条本轮租约，全部旧行、100项目文件/Git、229附件、源DB/认证和目录元信息保全，schema9/92不变；0模型请求/累计1260，沿首次截止退休时余3879918ms，无重启/续期/加额。交付推送以本轮Git回执为准，持续Goal保持active。
