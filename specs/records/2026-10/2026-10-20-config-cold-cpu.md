# 全量配置冷保存 CPU 剖析

## Recall

持续单agent，旧goal三Astra委托文案已被用户后续明确单agent指令覆盖。上一批443为progress：db5545b450ab73078acbaa9e4305d721a91cc38e已正常push，fresh fetch确认HEAD=origin/main。独立Project注册在原跨进程queue owner内并行、重叠物理命名空间保持接纳顺序；单次lookup复用目标物理观察，初始/admitted仍各自重读。86个唯一正向用例/166断言与正常推送检查通过。自有质量验证（Quality Assurance，QA）412完整74项目、schema2，所有原服务/验证句柄joined0、私有auth/models对退休，canonical完整恢复，原授权源metadata未变。原.bun/及packages/opencorvus/bun/保留。

完整性能仍failed：74项目cold19611.1693ms、restore5280.8971ms，保存中真实GET16401ms/200。原门槛cold≤10000ms、restore≤5000ms、page read≤20000ms不变。沿用benchmark-debug-template，不清库、不减少项目集、不用暖缓存替代冷写，不改用户18571的进程或页面，不分支/worktree，不跑UI自动化。最终真实验收使用原完整QA412、正式441 UI、生产Config service/HostTransport/HTTP、真实页面交互截图、完整来源恢复及原native physical/output/request与原launcher join后才退休凭据。Provider凭据与完整模型目录配对，预检要求实际gpt-6.1-sol流式请求；不新增业务Goal/委托。

## 修改前调查与当前未知

已读443 Recall与原阶段、05-config、Project物理比较与lookup、Config readOnlyWorktreeBoundary及candidate model-reference-validation、Provider buildState/stateFor/globalStateFor/canonical cache、ModelsDev唯一Data/get、Provider缓存身份正向合同。生产模型解析已有按Project与明确Config来源的状态缓存；不能因为多个引用就断言重复build。configStateSource有parse及canonical bytes工作，但未证明是19秒主因。buildState会按当前Project配置与插件创建独立模型目录，插件可改模型/凭据；尚无证据允许跨Project复用可变Provider状态或删掉未引用模型。只按provider字段缩小config key也可能破坏插件读取完整配置的合同，暂不改。

443全量并发累计lookup85126ms、Git58665ms、model validation21151ms和config.load46799ms均包含重叠，不能相加作墙钟。需要分清实际脚本CPU（Central Processing Unit，中央处理器）热点和文件系统/原生进程等待；当前信息不足以调整身份/错误顺序、并行度、索引或缓存。Project/Instance共享机制及Task/Mission/Session正常、恢复、终态的443边界保持。本轮先不改生产逻辑、数据库、迁移、Provider、身份复核或队列协议。

## 实施前方案与验收

1. 使用当前锁定Bun1.4.0本机帮助已确认的--cpu-prof/--cpu-prof-name/--cpu-prof-dir，将CPU剖析仅加在自有native Target运行参数；Host与原监管协议不改。启动新before18679，使用全74项目以上QA历史、原正式UI和原完整保存/恢复checker。采样自身有开销，计时明确标为profiled，不与无采样批次作为严格提速比较。
2. 剖析只用于定位，不作为性能通过资格。原CPU文件仅存私有evidence，先按实际sample/timeDelta和请求起止关联，再输出安全的函数、模块、self/inclusive时间摘要；不提交完整Provider正文、配置或凭据，不把idle或重叠inclusive时间加总。canonical before快照、原请求/span/GET日志必须在下一scope启动前归档。
3. 继续真实页面交互，验证保存中读取与Ask恢复；两次canonical完整恢复。Provider预检仍配对auth/models并核对实际gpt-6.1-sol与streaming。公开shutdown、原句柄join0和native完整结算后读取CPU产物，再退休运行副本；私有授权对仅在后续实际scope需要时保留，批末必须成对退休并核对原授权源metadata。
4. 依据剖析结果补充根因、全仓定义/调用点/数据/测试/架构与风险后再决定源码修复。不得为求快速通过缩窄74项目集、跳过原身份/目录/duplicate/权限检查、增加影子Provider配置或不流式LLM调用。行为改动提供聚焦正向测试与无采样完整checker/人工视觉复核；若工具故障先修复并重跑原检查。
5. 三索引与当前架构按实际修改同步，docs/API与architecture-index、范围提交、fetch/merge upstream、待推集合完整复核和正常hook push。完整goal保持active，原性能未达标项如实保留。

## CPU 证据与实施前修复方案

before 原 Target/Host 已经公开 shutdown、原 launcher joined0、physical/output/request 结算，运行凭据对退休；私有444授权对仅为后续 scope 保留。原全75 Project、2个已加载实例，profiled cold20943.0677ms、restore5375.2346ms，canonical完整恢复。CPU profile 的 startTime/endTime 为 epoch 微秒，以真实 HTTP 请求区间筛选：cold2494个样本中，native spawn 自身891，三个同步 PATH 文件探测自身分别406（Windows命令启动）、105（admitted Project身份发现）、96（初始Project身份发现）。607个互斥 self 样本占24.3%；不能把不规则 timeDelta 归给当前函数，也不能把 inclusive 数相加作 CPU 时间。restore604样本中同步探测73、spawn127；Provider投影仍占明显比例。本轮只修已证明的同步探测，不宣称解决全部保存耗时。

可观察现象是冷保存阻塞同时发生的页面读取，直接触发为异步 Project.discoverIdentity、initGit 和 Windows spawnWindowsCommand 调用 util.which 的同步库API。根因是 which@2.0.2.sync 对每个 PATH/PATHEXT 候选执行 statSync，在并行注册时仍阻塞同一事件循环；443解决注册接纳串行，没有消除回调内部同步I/O。全仓精确搜索确认12个生产文件使用现有同步facade；其余同步合同本轮保留。ProcessSupervisor 的 Cargo 调用位于同步 buildLocalWindowsHelper，不能仅凭上层 async 名称改成 await，明确排除。

方案：util.which 保留真实同步调用，并增加同一成熟库的 Promise API whichAsync，共用唯一环境参数提取函数，不自建查找算法或缓存；库异步耗尽返回 ENOENT，将其映射为原 null 合同，其他异常原样传播。Project 两处和 Windows 命令解析一处改为 await；绝对/相对路径直通、原缺失命令错误、环境优先级、PATHEXT、Windows cwd搜索和原生请求协议不变。同步和异步模式是现有调用者时序需求，不是新旧兼容双源。依据本机锁定库源码及[同版本官方说明](https://raw.githubusercontent.com/npm/node-which/v2.0.2/README.md)核对 Promise/错误/不缓存合同。

影响面：所有共享 Windows Host/Task/Mission/Session 命令都经同一解析入口，串并行、重试与恢复继续使用当前环境；解析完成后原 spawnWindowsRequest 重新检查 AbortSignal，且原 physical/output/request 结算不变。Project 初始/admitted 两次身份仍分别查询，原Git指纹、目录接纳、物理复核与跨项目隔离不改。无 schema、数据格式、配置、LLM、UI源码或迁移变更；风险为 Promise错误映射及调用漏 await，通过聚焦正向测试和 typecheck检查。新增后端测试覆盖真实文件 PATH/PATHEXT 顺序、事件循环让出、PATH更新与原生 Git完整执行及原错误；复用当前相关注册/配置/进程结算合同。随后无采样完整历史真实checker和实际网页截图复核，保留原10s/5s/20s资格；不以profiled计时作严格提速基线。

## 结果

已实施 whichAsync 唯一异步库调用、共用 options、Project 两处与 Windows 命令解析 await；真实同步 Cargo 与其他既有调用者保留。首次 typecheck发现仓库本地 which.d.ts 仅声明sync，按锁定库补入Promise签名，重跑11172 joined0。未改库版本、原生监管或UI/schema。人工review确认3处热路径全部await、其他同步facade合同保持。

真实正向后端检查原78630 joined0，8文件33例58断言；精确选中的显式Git初始化1例3断言和原生命令非零退出/Task Capsule宿主控制入口2例2断言均exit0。总36例63断言，不运行UI自动化。新测试以真实临时文件证明PATH/PATHEXT先后与setImmediate先完成、当前PATH和移动后的文件被重新观察；原生Git以实际完整结算输出及实际请求executable验证，缺失命令验证原明确错误。prettier只整理新增测试，生产热路径未再改。

无采样after18681最终源码保留完整76 Project、2实例初始加载：cold18065.6297ms、restore5345.6541ms，canonical全部字段完整恢复、Ask保持；保存中实际New chat触发GET/global/config为14649ms/200，起点21:19:58.226Z在cold原PATCH区间内。旧无采样443为74项目19.61s，本轮before为75项目采样20.94s；数据集合与采样条件有差异，只报告当前绝对资格，不能声称严格提速比例。原cold≤10s、restore≤5s均failed，page≤20s通过，完整goal仍active。原生spawn与Provider投影仍待后续根因修复。

实际浏览器39展示已完成OK、openai/gpt-6.1-sol、Ask及441 Goal入口；保存中返回默认页并人工查看截图，首页标题、输入框、快捷建议与Goal卡片顺序清楚。本轮无UI源码改动，不把截图复核当作性能通过。原27501 checker joined0，公开shutdown200，原38064 launcher joined0；before99118及60379均此前joined0。两scope physical/output/request与launcher证据齐备后才退休私有444 auth/models，源授权metadata未变。直接bun:sqlite readonly/create:false读取QA412得到user_version2、Project count76，没有生产初始化器、清库或迁移。

[安全摘要与人工截图](../../artifacts/2026-10-20-config-cold-cpu/README.md)保留原请求ID、完整项目数、重叠阶段摘要、CPU采样函数及36例检查日志；原profile、完整开发日志、配置和Provider正文保持私有。归档前按实际授权值扫描，无凭据内容进入提交。文档/API、架构索引及正常Git hook随本批提交推送结算；不创建branch/worktree/tag/Release。
