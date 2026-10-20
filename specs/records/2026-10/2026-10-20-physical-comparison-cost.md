# 配置连续保存：物理比较与实例初始化

## Recall

持续单开发agent，不委托；用户后续单agent要求覆盖旧active Goal的三Astra文案。前轮473为progress：edddf660d71578b60a53b59d6ca27291576ea84d已正常push且fresh fetch与origin/main一致；审计器绑定后发布身份修复、41例/174断言、backend typecheck/完整hooks通过；真实Sources并发阅读21张人工截图，未建立新Rendering复发。三个native和真实输入原句柄全部exit0，运行/private auth与完整models对已退休，源未refresh/exchange。完整QA142 Project/191 Session/schema3，原139/188及双会话20 Message/48 Part/38 protocol逐行保留。当前仅原.bun/与packages/opencorvus/bun/未跟踪。

继续原配置完整保存cold≤10000ms、restore≤5000ms、保存中四类真实读取≤20000ms；不能缩小Project集合、变大缓存、跳过当前身份/候选验证、特判username或放宽阈值。重读465日志/CPU/创建标志调查、464物理计数与已撤回扫描并发、443队列批处理、448双Git路径和损坏仓库修复、439锁序、当前05-config与task-runtime-directory、Project/Instance/DirectoryAdmission/hostGit/Process完整调用点，使用既有benchmark-debug-template。不操作用户18571进程/页面/真实数据库；禁止UI自动化。

## 修改前分析

已有真实量测显示每次完整保存约2.9万次realpath和stat，lookup在两次身份发现中重复；native spawn仍有约半数CPU采样，不能只凭N²就声称lookup是全部墙钟根因。日志级别、reader整日志扫描、helper detached flag和扫描并发均无稳定整体收益，不重复这些实验。两个真实Git查询已在Windows合为一次，每次初始与准入后的发现仍独立且必须保留。所有Project必须完整验证、保留原队列与occurrence/registry复核。

新的可证伪点是唯一sameObservedLocation谓词的读取次序：相异路径先realpath，绝大多数得到不同路径后仍stat获取精确bigint dev/ino；原目标观察每scan惰性复用只省target，不能消除每个独立row的两次文件系统查询。对于可提供非零inode的文件系统，精确device/inode自身即可判定身份，realpath是额外观测；硬链接需要该身份，路径字符串无法区分wide inode。Node官方[fs.Stats](https://nodejs.org/api/fs.html#class-fsstats)及[realpath](https://nodejs.org/api/fs.html#fspromisesrealpathpath-options)已查阅，bigint保留完整inode，stat跟随符号链接；现有真实hard-link/wide-inode测试和current代码是本仓具体依据，不能用文档代替实际结果。

现公开同语义调用包括Project Git路径/marker/注册身份、Worktree破坏前比较、identity-convergence显式数据修复等，都必须由同一个谓词实施。改变次序会改变不再需要的realpath错误是否被观察，必须明确，不能伪称所有I/O调用顺序与原错误都完全相同。已执行的stat/realpath错误仍只允许ENOENT/ENOTDIR映射未知，其余原对象传播；非零精确身份充分时没有理由额外读取另一种路径投影。ino为0/缺失仍是未知，需要现有realpath事实；这不是缓存旧身份或错误时重试。samePath早返回保持；每次公共调用/初始/admitted仍新建观察，不能跨准入保存。文件系统本身无跨两次await原子快照，当前两次发现、真实occurrence和durable注册复核继续拥有变更防护。没有新调度/终态异常；若实际发现共享异常立即横审Task/Mission/Session occurrence、所有入口、终态/恢复/重试、串并行及多Project。

## 方案与验收

1. 先不改生产，readonly取全部142原注册Project的实际worktree，使用自有scratch/运行前隔离环境，测当前完整物理比较矩阵与同一次新鲜metadata→必要路径判断的原事实输出；保持所有pair，不仅选少数目录，不初始化DB。记录实际dev/ino可用性、真相同/相异、missing及读取错误；本地probe只定位局部成本，不冒充完整保存或产品资格。若当前数据不支持该方向，不做生产补丁。
2. 若局部证据支持，仅调整唯一谓词：samePath后先观察两侧精确metadata，均有身份则直接比较；有未知才读取两侧物理路径。删除旧的realpath优先次序，不留第二实现、跨请求缓存或平台专用捷径。现有目标惰性观察仍在一个scan内；完整遍历/重复身份错误/登记和再校验顺序保持。先补当前正确结果的正向合同（真实硬链接/符号链接/替换、wide inode独立Project、未知inode物理路径及明确I/O错误），不写“不调用realpath”计数测试。更新当前物理身份架构。
3. 在任何生产修改前先启动当前源码baseline自有native开发scope；当前472正式UI，全部历史和原canonical私有快照，DEBUG与原完整HTTP checker、四并发reader。之后先公开shutdown/原句柄join及physical/output/request/launcher/runtime对结算，保存raw log，再做实现/聚焦合同/typecheck并启动同样正式after。每scope最多4、整批最多8实际Sol，包括memory/helper；完整auth/models成对、credential/catalog/actual gpt-6.1-sol/stream预检，源不写/refresh/exchange。20分钟只是监管安全寿命，180秒无活动观察，不因超时重启。若两scope请求额度不足，先结算并据最终审计核算，不能沿用中间快照计算余额。
4. 原完整性能阈值与全部数据保持。只在实际整体收益稳定且身份契约通过时保留优化；若无收益保存diff后精确撤回本次实验，不把复杂度当交付。UI未改也须实际查看保存等待、四读和恢复截图；不用单独Vite。原完整配置恢复及每个旧Project/Session归属/目录、schema3/原来源数据只读核验，三个索引/docs检查，范围commit、fresh fetch/merge、完整pending审查与正常push。Goal保持active，当前其他缺口不据窄测标成完成。

## 修改前真实结果与实施决定

readonly/create:false直接SQLite导出142 Project/191 Session/schema3，未加载生产initializer。Node实际完整142²=20164对，current/metadata-first/metadata-first/current交错四轮：1204.527/318.386/244.219/1055.157ms；每轮所有身份关系逐项一致，current每轮stat20164/realpath20164，候选stat20164。这里只证明本批实际文件系统身份可用和局部成本，不宣称全链路达标。缺失/未知inode和错误分支由后续正向合同补齐，不将本数据未出现视为已验证。

基线18799用当前473后端和当前472正式UI，实际credential/catalog/gpt-6.1-sol/stream预检；原43544 writer与34813四reader全部exit0。真实保存20028.4108ms、恢复17209.7454ms，完整parsed canonical恢复，Ask保持；/config19937.9068、/provider20381.1756、/global/providers20141.6691、实际/session8.1611ms，均200。原冷10s/恢复5s及两目录读20s失败。实际首次Provider等待提示、恢复227目录/Connected OpenAI及Ask四张截图已查看。公开shutdown200，原40950 exit0、native/output/request/launcher/runtime完整对已结算，raw log在下一scope前保存，IAB28关闭。

现在实施唯一谓词次序调整。全仓直接生产调用仅Project内部和显式identity-convergence；Worktree的独立破坏校验没有直接调用本函数，受影响的是它进入Project发现的身份路径，不能扩大声称独立校验已改或已测。逻辑入口Task/Mission/Session经原Instance进入，初始/admitted都独立新观察；未知identity才需读取realpath，必要查询的非缺失错误继续返回原对象。配置数据、schema、消息/Provider/工具声明、队列/锁/角色不变。新增真实junction+未知inode正向等价，以及stat错误/未知identity下realpath错误的原对象契约，保留实际hard-link/替换/wide-inode、注册并发与Git/恢复测试。当前架构同步说明新唯一顺序，不保留旧算法。

## 测试执行纠正与共享异常审计

实现后直接bun test五文件得到37 pass/1平台skip；随后直接bun test四配置文件16 pass/1 skip/1 fail，失败是global cold candidate枚举到已删除memory-ebDutn临时目录。实际堆栈为Project.fromDirectory→assertDirectoryIntegrity的明确missing错误，不是队列超时。立即核对全部生产入口/实例retention/全局候选、fixture.memory、preload和run-tests：config-peer-convergence最后一例在开始resetMemoryDatabase，结束fixture只dispose Instances/删除目录，原DB row按文件寿命保留；config-registration-batch从下个文件开始，beforeEach只恢复global Config，afterEach才reset。直接多文件bun test共用preload/process/DB造成跨文件fixture寿命错误。仓库package.json唯一test脚本run-tests.ts本来逐文件创建隔离子进程、显式60秒每例及原生输出/物理结算，符合这些测试的预期；本agent用了错误入口，不能改产品跳过缺失目录，也不能据此修test以兼容错误执行方法。

已对比生产Task/Mission/Session均经同一Instance/Project admission；真实基线142旧身份完整、全局保存与恢复正常200；失败持久位置仅本次测试临时DB，未进入QA或用户库。旧并发scope、原native/reader/writer已全部结算。没有生产共享调度/恢复故障证据。改用现有唯一官方runner重跑原9文件，保留这次失败日志，不声称直跑结果等同正式验收；需要等待原runner物理结算后再启动after性能服务。

官方32466 exit0：9文件54 pass/2平台skip/103断言；原失败cold batch正向用例在既有文件隔离下通过。Backend typecheck91196 exit0。随后才启动after18801；原26613/97903均exit0，保存16658.95/恢复16527.4223ms，四读最长17003.6155ms且全部200，完整canonical/Ask恢复。原10s/5s仍失败。为区分稳定收益与单轮波动，在同一已启动scope内再执行原完整writer/四reader一轮，独立输出文件和完整canonical前快照；不修改运行源码或扩大Provider预算，不产生新的LLM输入。两轮全部完成后再结算scope和决定取舍。

## 第二轮真实共享等待环（根因与实施前审计）

repeat冷写后的四读全部200，最长15881.6469ms；恢复PATCH5639fa64-a203-42da-9469-c8eec63e034b自12:43:47.464 UTC持续未结束。实际35520原生实例/端口仍live，公开health正常，不能把等待超时当进程终止。保存repeat-unsettled-private.log和pending-private.json；open phase显示writer持catalog及directory.held，另一unattributed directory.admission35520:22038从12:43:49.002等待同队列。唯一未完成project.from-directory为12:43:48.281创建的已注册目录runtime/data/projects/2026/10/20/6c3e63bd-e207-4b3c-b262-eced03220398。其初始化Promise已在cache发布，global候选枚举到它时加入该Promise，但它在writer批处理目录队列后等待；writer又在队列内等全部Instance context，形成共享环。其他候选能力校验到12:44:03.371全部结算后仍无法进入persist，不能归因Provider未返回或性能慢。反复读取当前句柄确认仍running后仅请求自有公开shutdown200，等待原29596/31154结算；运行中不改生产源码，不重启。

共享审计：唯一getOrCreateCacheEntry为普通Instance.provide和provideProjectIdentity共用，在目录queue取得前发布contextPromise；Project.fromDirectory初始Git/lookup后才runRegistration。全局候选registrationBatch先持同一queue再调用provideProjectIdentity。全部Server project middleware、Config候选/peer/reconcile、Workspace、engine writer、独立Project owner和orchestrator message bridge均进入这两个入口；Task/Mission/Session的普通初始化、恢复与重试同样复用，不得只特判本匿名项目或global config。正常context/失败删除/后续重试、同路径并发/alias、跨root、普通与inherited durable registration都须保留。已交付439的Config generation/MCP及catalog/preflight turn修复不涉及cache发布与目录队列这条反序，因而未根治此新环。

拟修同一cache工厂的发布边界：普通新entry须先获得已有registration batch queue，再复核当前cache，建立唯一原context并在归还queue前等待其Project discovery完整结算；已在同batch的独立注册继续原并行，旧的ready cache不另开身份实现。普通provide在等待工厂时仍用原awaitWithAbort，取消消费者不取消共享初始化。Task已持有且目录精确匹配的durable registration token须保留原显式继承通道，Project.fromDirectory继续原assertOwned/occurrence/generation验证，不能递归等待自己持有的queue；错误token或其他目录不可借用。不能在global writer旁绕过cache、取消queue、跳过候选、增大缓存或使用新持久化锁。公共返回/Schema/消息/工具/角色不变，局部工厂变为async的两个调用点同步审查。

先新增真实队列与实例正向合同：外部异步链在batch持queue时申请目标Instance，利用已有beforeAcquire hook仅观察真实申请；batch内随后读取同一目标，期待两方返回同一真实Project/generation并全部结算。旧实现应在同一缓存Promise形成环，原withTimeout只用于失败可结算，不冒充正常结果。official runner先复现失败，再实现；追加managed Task目录继承、原注册batch/身份/Config peer及Instance生命周期合同。修复后新18803 scope在前两scope物理结算与最终Provider计数后固定最多剩余4（原批8）请求，仍当前正式UI和完整历史/原canonical快照。再次原保存/恢复和重复一轮实际验收；未达性能阈值继续如实报告。

真实复现进入官方runner，旧工厂得到held registration batch identity AwaitTimeoutError、外部身份在queue释放后正确结算，正向同一身份断言失败。新工厂普通路径先持原registrationBatch再发布/完整结算discovery，exact inherited durable registration保留旧通道；两例转为通过。工厂在await queue后重查原process/deletion admission和继承lease开放，防止排队期间shutdown后迟到发布；retention在发布时保留原非serving lease，不能丢失全局候选跨阶段寿命。普通provide沿原awaitWithAbort等待共享工厂，独立调用不取消共享初始化。

11文件生命周期检查仅旧alias竞争断言失败：旧测试要求一个调用成功、另一个RegisteredDirectoryConflictError；现在两调用在queue内重新发现同一已提交物理身份，都成功读到同一个Project，实际持久owner仍只有一个。该失败是旧的“先在队列外捕获两个不同本地ID”的中间结果约束，不能为了让它通过保留旧发布时序。已将正向合同改为两调用返回同一持久owner的明确ID列表；损坏/重复持久身份和真实冲突错误合同仍原样保留。其他10文件（包括managed Task、旧catalog/preflight锁序、retention、Config peer）通过，追加当前process settlement关闭的真实排队错误合同并重跑相关文件后再复测。

## 最终实际资格与保留问题

最终工厂在目录queue后的发布点重新校验process/deletion admission与继承lease；cache原ready读保持原路径。另一cache.set仅为Project删除从durable快照注入Promise.resolve的ready identity，不发布等待目录的发现，因此不经初始化队列。异步无归属生产者的具体触发函数仍未知；共享机制由真实日志唯一pending context、持有/等待queue和官方实际队列失败→通过证明，不把推测的peer monitor身份当事实。

3个真实queue/inherited/late-settlement合同、9个Instance活性/alias、4个多项目后台shutdown、17个后台work合同通过（91331 exit0）；最终类型检查96292 exit0。元数据比较采用新鲜非零bigint dev/ino先判定，未知身份才读取真实realpath。实际phase中lookup累计由基线cold67289/restore57540ms降至最终两轮cold28141/29521、restore25003/25796ms，而Git累计仍99881—109877ms；这是并发累积跨度，不能冒充墙钟或CPU。保留单一谓词调整，有完整本地矩阵和多轮实际lookup一致下降支持；不保留无收益扫描并发、日志或helper创建标志实验。

新18803scope使用固定剩余4请求，完整auth/models及真实model/stream预检。先用原production config client→browser HostTransport→公开/global PATCH完整恢复失败scope遗留的唯一username差异，18583.2166ms，Ask和整份原parsed canonical一致，不直接改文件绕过事务。原16190 exit0。

随后原checker/四reader连续两轮：34576/4384 exit0，保存15811.2648、恢复16342.0031ms，四读最长16041.4529ms；92301/79882 exit0，保存16618.4541、恢复16227.5041ms，四读最长16895.369ms。请求全部200、目录227 Provider/8133模型，两个完整canonical前快照及最终源均与最初原配置一致。两轮页面等待/已加载信息及恢复、原Ask共7张最终截图，连同基线/失败共17张人工查看；无UI源码或UI自动化改动。原cold≤10s与restore≤5s仍失败，四读≤20s通过。已排除本轮复现的共享等待环，不能据两轮宣称所有并发组合已穷尽。

3个native原句柄40950 exit0、29596 exit1（原挂起写入造成shutdown listener quiesce5000ms失败）、57855 exit0均join；三次公开shutdown200，native physical/output/request/launcher和runtime完整对全结算，各raw log在下一启动前保存。原挂起repeat writer31154五分钟后返回TimeoutError/exit1，未将其当服务终态或重发；独立四reader26024 exit0。最终正常关闭与原错误都如实保留。原Provider最终数字revision各2/4、共6/整批8，全部实际gpt-6.1-sol/stream200/EOF，包括memory/helper。实际秘密值扫描后private完整auth/models对退休，源元数据保持且未refresh/exchange；IAB28/29/30关闭。

readonly最终145 Project/194 Session/schema3，原142/191每个身份/目录/归属保持；来源双Session原行及32 Message/72 Part/62 protocol含rowid逐行一致，没有清库、迁移或用户库访问。额外以18个直接相关文件的官方隔离runner汇总为最终源码的一次完整资格；保留全部原失败日志。三索引/当前架构同步、docs与差异/实际凭据值复核，范围提交后fresh fetch/merge、完整pending审查、正常push/fresh fetch。Goal仍active，保留原性能阈值与native Git启动等未完根因。

最终统一runner10113已exit0：18文件112 pass、2平台skip、236断言；最终五文件物理身份/注册/Git/修复/边界runner38640 exit0，当前源码类型96292 exit0，docs:check345 operations/26 groups通过。所有观察、恢复、原生与测试句柄均已结算，没有本轮仍live的任务或复制授权对。
