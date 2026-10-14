# 第22批：归档工作搜索

## Recall

- 用户持续迭代要求保持；最新明确禁止子agent，Root独立调查、实现和验收。不向其他聊天发送消息。开始状态只含其他任务的compaction物理checker、spec索引等变更；保留其工作、暂存和进程，不创建分支或工作树。
- 第19/20/21批的e3c3d1aa、0fe81206、8c42e5d3和交付记录3b4f9680，已于本次fresh fetch后逐项确认是origin/main的祖先。原阻塞checker实际通过18 owners/23 acquire sites。前三批原失败仍保留；本任务新的正常push实际退出待确认，不能仅以其他任务推送冒充自己的成功回执。
- 已读AGENTS、07-panel统一Work Ledger/Archive合同、07-panel-reactivity的authority生命周期、ArchivePanel全部加载/分页/行操作/聚焦路径、唯一services/work-ledger的loadArchivedWorkLedger、SearchField公共组件、公开GET /work-ledger/archive和投影searchPattern/各kind查询、work-ledger-search正向合同、中英archive语言键、既有2026-10-05 connection-workspace-authority记录。
- 全仓搜索结果：loadArchivedWorkLedger生产调用仅ArchivePanel的初始/分页与mutation后重读两处；服务已有search参数并由唯一公开路由/统一投影解释，支持标题、身份、目录、技术kind和字面百分号/下划线/反斜线。当前页面两处都未传search，也没有搜索输入。没有新后端搜索、协议、SDK或配置的必要。旧command palette搜索改动保留了archived投影合同，但只接入active palette。
- 目标：真实隔离/ui证明归档页在超过100项时只能逐页查找；接入现有服务器搜索并保持分页、清除、错误、恢复及API authority所有权。Root亲看原始桌面截图并手动操作，中英标签/空结果和无障碍名称齐全；不增加或运行UI自动化测试。聚焦现有纯后端work-ledger-search测试只证明查询合同，不能代替页面。

## 根因与影响分析（实施前）

1. 可观察现象尚待页面证实：源码归档页固定100项一页，仅Load more，无查询控件。目标可能在旧页或另一个Project，用户只能逐页浏览；这属于已存在服务能力尚未接入的功能缺口，不宣称数据遗失或查询引擎缺陷。
2. 直接触发/数据流：ArchivePanel -> loadArchivedWorkLedger({limit,cursor,authority,signal}) -> GET /work-ledger/archive -> 单一SQLite投影。服务允许search，页面却从未传入；在已加载rows上过滤会漏掉后续页面，因此不能这样补。mutation后的正式重读也须保持同一查询。
3. 旧路径未根治：active command palette的搜索与归档页是不同页面调用者；后端支持不意味着此页面可访问。保留唯一搜索解释，不复制LIKE转义、kind映射或数据库事实到浏览器。
4. 唯一实施方案：页面增加一个search signal和现有clearable SearchField。当前修剪查询与API authority共同驱动已有请求代际/AbortController重置；新查询清空rows/cursor并加载第一页；append及恢复/删除后的重读都传当前查询。行mutation期间禁用搜索，保持原聚焦与busy所有权；加载期间允许继续输入并由现有代际退休旧响应。没有debounce队列、并行缓存、第二请求状态或fallback。
5. 公共契约/数据/风险：不修改函数签名、路由、错误、存储格式、schema、排序、分页cursor、归档时间、恢复/删除合同或公共配置；无需迁移。查询匹配继续来自服务器，中文界面也保留真实技术kind/原始title与目录。输入清除应正式重读第一页；过滤零结果有专用本地化空状态，不能误称整个归档为空。authority改变仍沿已有统一退休路径。
6. 真实验收：沿前批成熟隔离runtime启动正式backend /ui，独立HOME/数据库、完整仓库公开models目录和仅自有随机假auth同对。通过公开HTTP创建并归档两个Project的107条空Chat定义（105普通项、两个含中文和_%反斜线的目标，最旧目标先创建），不生成消息/运行/模型结果。before使用前批已验收冻结UI，亲看初始100及Load more后目标。after新Node构建，同一输入，亲看跨未加载页搜索、中文/字面字符、空结果、清除、分页、恢复后的同查询；公开GET验证身份/归档事实和恢复结果。仅声明实际操作的Chat资格；Task/Mission由相同投影接入但不冒充其独立网页操作。
7. 验证/收尾：当前原后端search正向测试、overlay类型/Node build、docs/index及精确提交拓扑检查；不写UI文案/DOM/组件/截图断言。只关闭自己页面；正常stop marker -> runtime settlement -> parent真实退出 -> 双端口0 -> 精确删除自有假auth/models同对并检查完整日志隐私。零真实模型请求，无真实Provider/用户凭据使用，无需Sol调用。
8. 调度/并发边界：本批只读归档查询和已有用户恢复操作，不改变调度、执行轮次或终态writer。若遇真实队列/唤醒/恢复/终态异常，立即按AGENTS横审全部Task/Mission/Session入口、重启、串并行与多Project，不以本批局部通过降级。
9. 交付：补当前07-panel归档搜索消费者合同与CHANGELOG未发布增量，中英语言同源；本record/原图/HTTP/日志/README和三个索引。使用范围私有index保留并行变更，普通commit后fresh fetch/merge、完整pending审阅、正常hook/push，然后下一批。不发布版本/tag/Release/PR。

## 实施前状态

分析与方案先落盘，尚未修改产品，尚未取得本批真实页面证据。实现以本方案及实际页面调查的补充为准。

### 实施前真实复核

- before PID90472、18658/59，occurrence031e8399-304f-4ba8-92d7-8290929482c7。公开HTTP实际324请求创建/命名/归档107条Chat并读回分页及查询；Root浏览后再次3次GET确认100+7的完整身份集合及两个Project的精确目标。没有消息/推理请求。
- Root亲看01首屏100项，没有归档搜索控件；手动Load more后亲看02尾部两个原始标题`归档_50%\跨项目`和`归档_50%\旧记录`及其真实Project目录。这里只证明查找入口缺失/分页成本，未发现丢失或后端查询错误。修前tab23已关闭，发出正常停止marker，物理/隐私收尾待原父退出核实。
- 现有纯后端work-ledger-search原runner实际0：4项/18断言，含真实旧记录、中文/字面特殊字符、全局/目录边界、kind和cursor。方案文档原checker0（345 ops/26 groups）。本次恢复后的正常push实际0，八包types及全部原hook通过，899ffcb33..356cb5ba9进入main；此前三批自己的提交均已upstream，原失败仍保留。
- 据此允许按上文唯一消费者方案实施。不会增加服务器查询实现或在已加载100项上做本地过滤。

## 最终实现与实际验收

- 产品只改ArchivePanel一个消费者和两份locale各两键。一个输入沿现有请求generation/AbortController重置第一页和cursor；两处canonical读取均携带当前search；行mutation时输入禁用，原focusAfterAction保持。没有服务/路由/错误/schema/模型/调度改动或新查询引擎。
- overlay类型0，Node正式构建0（1m29s，原有chunk/directive warnings完整保留），语言目录0（两语言2300键），docs0（345/26）、架构索引0（19文档）。既有纯后端search正向4/18通过，未新增/修改/运行UI自动化、DOM/文案/组件断言。
- after PID77892，18660/61，occurrence2eac9c9d-3c0b-48ba-8139-11bdd20e8bed。正式公开324 HTTP重建同一107项输入并读回100+7及跨Project目标；UI操作后5次真实GET确认旧目标恢复为active、另一个保持原archived时间、分页查询100+5的105项精确ID集合。本批正式checker合计656 HTTP；浏览器自身真实请求另计，不能把此数当全网请求总量。
- Root亲看12原PNG：01修前100首屏、02Load more后两个旧目标；03修后搜索布局/100首屏，04英文中文+字面_%反斜线查询直接返回两个Project目标，05英文专用空结果，06Clear正式重读100且焦点留输入，07查询分页累计105；08中文搜索/原标题/日期，09恢复提交期间1条剩余且控件暂disabled，10真正settled后原查询/剩余跨Project记录/可操作控件与恢复按钮焦点，11中文专用空结果，12中文清除后的100首屏。09明确是过渡态，不代替10的完成证据。日期/路径/技术kind/原输入身份保持。
- 两个自有tab23/24均关闭；两轮正常marker/settlement/父真实exit0，双端口均0后分别精确删除自身假auth/models同对。完整原后台日志328259/356328字节、stdout/stderr各0；隐私checker两轮0，原日志无损gzip。两轮terminal真实requests0、realSolCalls0；没有用户凭据或进程操作。
- 资格边界：桌面中英Chat/跨Project真实查询、分页和恢复；Task/Mission共用原读取合同，但本批未独立操作其网页恢复/删除。未点永久删除，未声称真实模型/调度触发或强制迟到响应的验收。原authority/代际路径经过代码复核，不能以此冒充新的网络延迟实验。
- 所有本批原件归档并同步当前架构、未发布更新日志和三个spec索引。范围提交、精确拓扑与本批正常push须以随后实际回执确认，不先填写未来SHA或成功。

### 提交竞争的真实回执

首次正常提交包装器在写Git对象前观察到共享HEAD已变化，按现有保护退出1；没有提交失败内容或覆盖他人提交。原输出保留。重新读取HEAD并从其树生成只含本批源、原件和精确共享patch的私有index，再正常提交；不rebase/reset/删锁/绕hook。

## 交付审阅补充：原件范围的文档校正（修改前分析）

本批产品已正常提交9fc9fb7bbd05e7c84d9962375922d72d6cccf9b5，parent a169819b823871bd18efc98908dcd6ec5743ddb2，113路径，原逐blob身份核对及精确index结算0；release与module精确该树检查0（1163 modules/5936 edges/4 imports）。自己组件/record/artifact范围与HEAD一致，普通暂存区空。

fresh fetch/merge后完整pending还含独立用户授权的compaction物理checker提交a169819b8，产品源码只涉及其原checker/worker，不是本批UI。Root只读该不可变提交的源差异和原始gzip报告：8手动/自动case、24真实cut/recover/inspect阶段、46流式loopback请求的实际exit/settlement、第三进程snapshot、原user身份/选段、helper真实Tool流和当前checkpoint全部符合原合同。没有新增调用、委托或消息。

审阅发现README和qualification的人工概括写范围[26,80)，而8个原始receipt与原source.correctionExcerpt均为offset27/end81：原前缀27 UTF-16单位，选段54单位。全仓对应记录检索将定位该概括的全部调用；校正只覆盖事实错误的说明数字，不改任何原始报告、summary、实现、数据库、模型结果、公共错误或资格状态。直接根因是人工重复填写边界时偏一位，真实数据链各处一致，证据排除生产选段/恢复机制异常；不能把它冒充新的共享调度故障或抹除原Luna语义失败。

这两份文档当前无其他未提交修改，允许在精确原文上修为[27,81)，保留原始不可变提交/报告并归档本次只读对照脚本与实际0输出。同步文档检查、范围提交；属于完整pending事实审阅所需的窄校正，不扩大为该任务的新模型/Task/Mission验收。其已有README索引路径不变，无需新增平行规格。

补充全仓文档检索还定位到当前compaction-stress record的3处同一人工范围概括，该文件当前同样无未提交修改。它们一并按原始receipt改为[27,81)，只改这3个token。原观察/运行状态与语义失败全部保留，不改原输入、报告或实现。最终校正范围是README一句、qualification两个数字、原record三处范围；本record中的旧数字是错误定位的原观察，明确保留为调查证据。
