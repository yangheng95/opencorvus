# 原生 helper 启动与主线程隔离

## Recall

持续单开发 agent，不委托。用户后续只用一个 agent 的明确要求覆盖长期 Goal 中旧三 Astra 文本。483为 progress：48ec875da4e8fa5655fce571ac257213847e3e1b正常推送，fresh fetch后HEAD=origin/main；只读原149 Project/198 Session/schema3和完整七表3665行，源库逐项保留。独立完整配置观察得到263352次原文件调用、896次原spawn，保存/恢复18568.570/18440.229ms仍未满足10秒/5秒，四类读取≤20秒通过。stat261.071ms与同步spawn260.655ms区间重叠；不能把Promise观察当纯磁盘耗时。局部native realpath交错没有稳定收益，未改生产。全部native/writer/reader/source EOF已结算、runtime/private完整auth/models已退休、自有50关闭；仅原.bun/与packages/opencorvus/bun/未跟踪。

用户原要求仍为深入UI（User Interface，用户界面）/功能体验、根因修复、实际验证、范围提交推送并自主继续。完整性能指标和全部项目验证不缩减；不操作用户18571/用户窗口/进程/数据库，不创建分支/工作树，不增加或运行UI自动化。沿用已读benchmark-debug-template；当前架构是specs/current/architecture的唯一事实来源。

## 修改前调查、范围和未知

已读483/475 Recall、当前Windows spawnWindowsRequest/childHandle/childSpawnFailure、Process facade与通用util/process-node、输出转发/ready/初次durable settlement/cleanup、父PID（Process Identifier，进程标识）与出生时间、原目录候选合同及当前调用点。475已排除把整个Process移到1/3个线程的简单吞吐方案；该方案仍让文件读取与spawn在同一工作线程互相阻塞，并会产生每线程runtime occurrence。此次不同问题是只将真实ChildProcess helper创建与其原管道读取放在一个标准工作线程，原持久request/ready/settlement、所有身份与文件操作仍由原主线程的唯一ProcessSupervisor拥有。隔离能否改善真实混合负载仍未知，不能先交付线程池或另一监管器。

共享面：应用Host/Task/Mission/Session的native shell/command进入同一Windows监管；Task Capsule和通用Node adapter另有同协议执行入口，不能把应用入口的诊断资格扩大到它们。所有正常、非零退出、spawn失败、cancel/deadline、输出背压/错误、detached transfer、restart与orphan恢复需要分别有原事实，不能把工作线程error当成helper exit。原helper的物理父仍是同一个宿主PID/出生时间，durable request的runtime occurrence仍由主线程构造；工作线程不导入Project/Database/Process模块，不创建第二执行身份。线程通信仅属同一物理进程的字节传输，不产生产品消息、工具或LLM（Large Language Model，大语言模型）参与者。

风险：跨线程不能传输原ChildProcess对象；需要传递实际pid、真实error/exit/close和stdin/stdout/stderr字节，并保留readable背压、写入确认和监听器准入。工作线程意外退出时，不能合成成功物理退出或关闭证明；必须保留原request与可恢复权限。detached fd、stdin、worker lifetime、打包后模块寻址和通用宿主目前都未具生产资格。仅通过正常小输出不能交付这些边界。

已查阅官方[Node工作线程](https://nodejs.org/api/worker_threads.html)、[ChildProcess事件](https://nodejs.org/api/child_process.html#class-childprocess)与[Bun运行时插件](https://bun.sh/docs/runtime/plugins)。官方不把工作线程视为一般I/O（Input/Output，输入输出）提速手段；本轮只依据本机已测同步spawn停顿开展可证伪诊断，不以线程概念保证吞吐。

## 实施前方案

1. 先在新484自有scratch/隔离runtime做无凭据、无Provider、无数据库initializer的私有原型；当前冻结Bun1.4.0与原446 release helper。通过Bun运行时loader只把原Windows helper那一个spawn调用变为await私有线程adapter，其余生产函数、源码文件和协议均不改；未匹配唯一调用就明确失败，不设fallback。普通基线与线程变体只在独立scope选择，不在运行中切换。
2. 线程只创建原helper，主线程持有原request/runtime occurrence、ready/settled/cleanup。只转发实际原生事件；输出按通道逐块确认、背压再继续，stdin等待实际写入回执；先等待主线程监听器准入再发布已发生事件。关闭线程前所有实际helper/管道必须结算并自然退出，不用terminate掩盖失败，不自动重启。超时只检查同一原句柄/物理事实，不能认作已退出。
3. 先用真实原Process.runHost验证小输出、双通道大输出、二进制stdin/明确非零exit、原取消/deadline和同一owner事实。未覆盖的detached、worker异常和打包继续明确未达；这些局部合同不是生产/端到端通过。
4. 全部原149实际目录仍参与局部混合文件读取，实际Git仅对原本具有.git的目录执行两次；保留非Git目录的计数与文件读取，不把局部探针称全量Config资格。基线/变体交错，记录完整结算墙钟、主线程最大停顿、实际stdout/stderr和物理request身份。只隔离spawn，与475移动整个Process的结果分开。
5. 若无稳定整体收益，不改生产并保留排除证据；若有收益，先补所有生产入口、worker失败/恢复、背压、detached与打包的完整设计、正向合同，再决定唯一实现。真实完整Config资格必须重新走当前正式UI/源码CLI、原production checker、全部目录/完整canonical与10s/5s/20s门槛，人工截图；若需Provider，在启动前另行声明固定预算、完整auth/models成对及精确Sol预检，原请求/native全部结算后退休。此时没有新模型预算、凭据副本或业务输入。
6. 调度/恢复/终态异常立即按共享机制横审全部入口、occurrence（执行轮次）、正常终态、重试重启、串并行和多项目。所有本任务修改结束前范围提交，索引/docs/architecture检查、fresh fetch/merge、完整pending审查与正常push。长期Goal保持active，不创建Release/tag/PR（Pull Request，拉取请求）。

## 首轮局部事实及补充对照（启动前）

工具首次使用相对preload参数，在导入之前exit1；修为绝对路径。第二次因process.env是不可结构化克隆的proxy，postMessage在创建任何helper之前失败，原request创建失败清理完成、进程exit1。修为在首次await前取得原env/cwd的普通对象快照，保留该次调用时的实际输入，不记录环境值；之后所有诊断都由原413 owned-host/446 release监管，原scope4分钟资源边界，不因观察超时重启。失败日志保留，不当作产品故障。

原822907 smoke exit0：真实stdout/stderr及exit7、主线程原PID/birth/runtime occurrence与线程内实际物理PID一致，worker自然exit0。后续原e4676c合同scope exit0，真实512KiB二进制输入、4718592字节stdout、2097152字节stderr/exit9精确相同；活动后代截止与独立peer、原取消和65536字节输出上限均得到明确原receipt和完整native/output/request结算，5个原helper、4个场景、worker exit0。仅正常传输及这些原合同有资格，worker异常/detached/打包仍未测，未改生产。

全部149目录参与两次新鲜stat/realpath，每轮各44402次；其中148个实际.git目录执行296次原Process.runHost Git，其余1个仍参与全部文件读取。四组交错为main-a、worker-a、worker-b、main-b，不是完整Config。首两组墙钟16894.518/16617.408ms，主线程最大计时间隔415.906/47.320ms；worker-b为15187.374ms、59.394ms。仅响应性有明确改善，不能将约16秒算成10秒/5秒达标。所有Git原stdout/stderr与main-a逐项相同，原owner只有同一物理主进程身份。

单个spawn线程自身同步工作累计约8.7—10.3秒，仍串行占用这个独立线程。为了区分“隔离本身无吞吐收益”与“隔离后单条启动通道仍串行”两个机制，增加**只隔离spawn的三线程**对照，复用同一个私有adapter工厂，原文件操作/全部身份仍仅在主线程，不重做475整个Process三线程方案。3只是与475相同的明确对照，不成为生产常数或新的配置面；不按测分反复调参。先再跑原四场景正向合同，再按main-c/worker-three-a/worker-three-b/main-d交错全149混合负载，原输出/身份/自然线程退出/原native结算全部保持。仍无Provider、凭据、数据库initializer、产品实现或新预算；未达整体证据不交付任何线程池。

## 完整配置对照（启动前）

原单线程main-b17403.974ms。三线程原合同5e739a exit0，5个helper、四场景与三个实际worker自然exit0。新增全149混合负载main-c18741.218、worker-three-a14574.388、worker-three-b14642.008、main-d18594.101ms；各296真实Git与44402次stat/44402次realpath，原输出/身份逐项相同，全部原scope自然结算。三线程局部稳定约14.6秒，只是方向资格，不是10秒/5秒或生产收益资格；禁止据此直接发布线程池。

下一阶段仅测同一原production Config服务/HostTransport/HTTP（Hypertext Transfer Protocol，超文本传输协议）完整路径：baseline18843与私有三线程variant18845分别从同一旧149/198完整七表序列化、完整canonical克隆，全部原项目目录保留。当前正式482 UI与源码CLI、原413 owned-host/446 release监管20分钟，不安装483的FS观察器，避免累计采样开销混入对照。variant仅在私有loader替换那个helper spawn，并在原serve的settleRecoveringServerRuntime成功后自然关闭三个已空worker、保存原退出回执，再继续原shutdown；没有新的控制端点、写入旁路、任务或消息。任何迟到helper/线程失败仍沿原错误失败，不回退或重启。

独立模型预算固定总8、每scope最多4（均含两次预检及全部helper），不发业务模型输入/Goal/成员任务。重新准备完整private auth/models，分别核对当前credential、精确gpt-6.1-sol目录和实际预检模型/流式。baseline全部原请求、writer/reader、native/output/request/launcher和运行对结算后才启动variant；unused不复活、不活跃扩额。模型源不refresh/exchange/写入，私有对在两scope最终结算后按实际秘密值检查退休。

两scope各一次真实保存/整份原canonical恢复、四类并发read与原10秒/5秒/20秒指标；实际内置/ui设置截图人工查看，原日志在下一scope之前冻结。新旧完整七表事实与schema3逐项复核，不把源码类型/局部探针/模型自述当产品资格。若完整路径没有足够收益或worker错误/生命周期仍未满足，继续如实保留原问题，不交付私有adapter为正式实现。生产设计、全部入口、detached、worker异常、重启恢复和打包仍须单独完成。

## 完整实际结果与交付裁决

baseline原25393、writer5310、reader62103全部exit0；未插桩原源码保存17829.5306、完整恢复17563.0747ms，四read最长17935.6121ms，全部200、227 Provider/8133模型。公开shutdown200、原physical/output/request/launcher及2个实际Sol source EOF结算、完整runtime对退休、自有51关闭，才准备新的variant完整副本。

variant原82248、writer19717、reader69453全部exit0；私有loader仅替换原helper spawn及原runtime settlement之后的自然线程退休，保存15624.4824、恢复15320.5959ms，四read最长15731.2215ms，全部200且原目录完整。两组10秒/5秒仍failed、20秒读取通过。八张真实IAB页面实际查看，02/06绑定各自原写入期间的Loading，03/07目录完整，04/08原Ask恢复；不以计时器采样当视觉帧速度或Rendering修复。本轮无UI源码或UI自动化变化。

variant公开shutdown200，原服务退出前的原runtime settlement成功后，896个实际helper关闭/双通道drain事实全部归于主进程92516，三个工作线程均自然exit0；随后原82248正常join0及native物理/output/request/launcher结算。原worker异常、启动等待期间的全部取消组合、detached、通用Node/Task Capsule的变体资格和打包仍未完成。局部混合负载八组共2368命令，加smoke/两个合同scope的11次，共2379次局部实际命令；全部11个本地原scope/物理宿主和Target出生时间已复核终态，未重启或terminate线程。

结论：隔离只改善了主线程停顿和此对完整路径约2秒的局部结果，仍约15秒，不能替代原10秒/5秒目标；一对完整scope不足以声称稳定跨环境比例。相对于尚未完成的异常恢复、所有入口、控制准入、背压和打包风险，当前收益不足以交付该复杂传输。**生产源码、监管实现和当前架构保持不变，私有原型只作为排除/定位证据归档。** 后续不能继续用工作线程数量调参代替减少每命令原生启动本身的机制成本，也不能取消fresh身份或添加缓存。需要更改该机制时必须另行审计完整Job/父死亡/输出/错误/重启合同并取得真实全链路证据。

两个独立副本均保留全部原七表3665行事实与源库size/mtime，原Project身份/归属和Session/Message/Part/protocol/Tool数据含rowid/time逐项保持，changedProjectFields为空；最终各151 Project/199 Session/520 Message/1159 Part/1410 protocol/119 request/119 outcome/schema3，完整canonical恢复。用户18571与用户数据库未操作。模型固定总8、每scope4，最终各2/4、合计4/8，全为实际gpt-6.1-sol/stream200/source EOF；unused4退休，没有业务输入/Goal/成员任务。单scope cleanup receipt内maximumBatch4描述单scope限额，组合汇总明确4+4=8，未扩大活动预算。

两个runtime完整auth/models及最终private完整对全部在各自原请求/native/launcher结算后退休；5612文件/331543026字节经5实际秘密值检查clear，源凭据size/mtime未变、无refresh/exchange/源写入，完整private模型目录与源逐字节相同。自有51/52关闭，原scope日志冻结后再启动下一scope。[原native、合同、矩阵、完整配置与八张人工图](../../artifacts/2026-10-21-native-launch-isolation/README.md)同步三个索引；本轮只对证据/文档做范围提交和正常推送，未更新版本或发布。长期Goal保持active。
