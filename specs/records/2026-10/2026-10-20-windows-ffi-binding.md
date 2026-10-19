# Windows 外部函数绑定的调用成本

## Recall

持续单agent，旧goal三Astra委托描述已被用户后续单agent要求覆盖。上一批446是progress：f78b3ff0648364e5ee5ac2ff6a486aa9c59e7dca及日志整理5ad0aed408bb90271751955bb740c4794373cbf2正常push，fresh fetch HEAD=origin/main。Windows父进程点查询、owner拒绝前终态事实修复通过35例（29 backend/72断言+6 native），发布优化helper实际路径及真实gpt-6.1-sol流式预检核实。完整QA（Quality Assurance，质量验证）412保留78 Project、schema2；原native/检查句柄physical/output/request与launcher全部结算，临时auth/models对退休、源授权metadata未变。上一批归档误写445目录已保存实际数据并精确恢复旧文件，当前旧artifact无改动；本批必须显式核对新目录目标。已有.bun/及packages/opencorvus/bun/保留。

完整性能仍failed：cold19395.3382ms、restore5234.7129ms、真实GET16166ms/200；原10s/5s/20s门槛不变。继续benchmark-debug-template，完整历史开发服务/正式441 UI（User Interface，用户界面）、真实交互截图，不清库、缩样本、UI自动化或操作用户18571进程/窗口。任何Provider验收仍完整auth/models配对、credential/catalog/实际gpt-6.1-sol streaming分别预检，原句柄完整退出后才成对退休副本；不分支/worktree，不建tag/Release。

## 修改前分析与未知

已读446 Recall/原生诊断/安全CPU（Central Processing Unit，中央处理器）摘要和最终阶段、server-runtime-readiness、process-occurrence的定义/出生时间/存活观察/局部observer缓存、Windows Job读取、rename-no-replace的Windows两条真实操作、Filesystem durable publication及原子替换/进程owner测试、现有lazy primitive。全仓dlopen调用还包括serve启动控制台和platform capability探测，后两者不是已证明的热路径，本轮排除。

可观察问题仍是cold全量配置保存与并发页面读延迟。线索为windowsProcessInstanceID每次require bun:ffi、dlopen四个Kernel32符号并close；Job探测同样每次绑定两个符号。原子rename/replace每次绑定2或5个符号并close。上一轮父查询位于子helper，点查询快并未证明宿主整体更快。本轮尚未证明这些绑定是19秒根因，不能先缓存PID/出生时间/存活结果或增加新协议。

共享影响面：process-occurrence为Host/Task/Mission/Session、目录准入、跨进程lease与恢复提供唯一真实进程观察。每次仍必须OpenProcess/GetProcessTimes/WaitForSingleObject并关闭该次handle；进程退出/标识复用/unknown_live语义保持。原子rename/replace为请求/配置等durable publication提供现有文件操作，句柄、GetLastError、write-through/替换与真实错误合同保持。没有新调度/队列/唤醒异常；若测量或测试发现则立即按共享机制全面审计。schema、数据、配置、消息与LLM（Large Language Model，大语言模型）均排除变更。

已核对[官方FFI（Foreign Function Interface，外部函数接口）说明](https://bun.sh/docs/runtime/ffi)的dlopen/符号/close合同。在线文档面向较新Bun，不能将其中JIT（Just-in-time Compilation，即时编译）实现直接归因于本机锁定1.4.0；只按当前真实计时与行为结论行动。现有宿主绑定不扩展为新通用Bun专属能力，也不引入备用平台路径。

## 实施前方案

1. 先在自有新OPENCORVUS_HOME下调用真实公共进程观察/Job API（Application Programming Interface，应用程序接口）和Windows durable rename，测量原始方法。再用相同系统函数与每次新handle、buffer和实际系统读取作绑定一次的局部诊断，核对同一真实出生身份/结果；只证明阶段成本，不冒充全量或UI验收。
2. 若阶段测量和实际调用面支持，实施前补充具体根因和边界。优先复用当前lazy；只延长不可变函数库/符号的进程寿命，不复用进程或文件句柄、buffer、错误码、物理观察或数据。失败的初始化保持原错误，不增加fallback。仅在重复和证据成立处建立私有绑定，不因都属于Kernel32就创建无需求的全局系统API包。
3. 正向测试必须覆盖真实存活→退出（包括保留内核handle）→其他进程的身份观察，以及现有Project跨生命周期、准入、错误与结算；文件操作若触及时覆盖真实替换/readers/durability/错误。禁止以“不调用dlopen”之类负向断言代替行为，禁止UI自动化。按改动运行聚焦类型/现有检查；工具故障先修复再重跑原checker。
4. 最终仍完整78以上QA历史、正式441 UI、原生产Config service→HostTransport→HTTP（Hypertext Transfer Protocol，超文本传输协议）两次保存与完整恢复；真实gpt-6.1-sol配对预检、原子信号、手动页面交互截图。原10s/5s/20s资格不变，微基准改善不作为完整通过。所有原服务/检查句柄结算后退休凭据对、只读核对schema和项目保留。
5. 显式新artifact路径，归档前扫描实际凭据、保存原阶段和失败事实，三索引/对应架构及当前docs/architecture-index，范围提交、fetch/merge upstream、完整待推集合复核、正常hook push及fresh fetch。goal保持active。

## 结果

当前锁定Bun1.4.0真实诊断exit0：128次原公共身份读取共4.0538ms（均值0.03167ms），相同新handle/buffer/system calls而只绑定一次为0.7800ms；原Job128次1.6892ms，一次绑定的相同读取0.2343ms。64次绑定+close均值identity0.01794ms、rename0.00974ms、replace0.02472ms。所有身份与原Rust helper独立读取的真实出生时间一致，Job结果一致。初次probe只因Windows路径分隔符原样比较而拒绝，改为绝对路径规范化后重跑，未进入生产或修改用户数据。

这些量级与444剖析中的dlopen仅5个自身样本一致，不能解释19秒，故本轮不实施函数绑定缓存，也不扩展原子文件实现。下一步方案补充：用相同原生helper和Git、同样env/stdio/windowsHide/两种detached输入，分别在锁定Bun与现有Node直接测量spawn调用返回、首次输出、真实exit及完整pipe close，按交错顺序复测排除单次冷启动影响；叶子version命令只有15秒无活动时才终止自己的原child句柄。若需完整服务调用计数，只对真实spawn作pass-through计时，原函数/输入/输出/错误引用保持，字段仅身份/时长/环境大小，无argv正文或env值；诊断不冒充正式性能通过。生产调整前必须再落盘具体根因/共享owner影响与正向验收方案。

四轮交错、每轮24个真实叶子命令全部exit0且关闭原输出。Bun1.4.0与Node25.7.0的helper启动通常约5ms，Git样本有系统波动，未证实Bun专属问题。不能据此升级运行时或改变Windows detached/隐藏窗口策略。

## 完整调用的实际阻塞

原完整QA历史、当前446 release helper、正式441界面，Target的实际named spawn导入核对后作pass-through；只加原child的spawn/exit/close被动listener，不读取输出、不改参数/env/返回child/错误/owner/结算。原服务真实gpt-6.1-sol streaming预检成功，Config service→browser HostTransport→HTTP两次写入，完整canonical恢复。最终80 Projects、schema2，原服务public shutdown200、native physical/output/request结算、原launcher36239 joined0、checker32440 joined0；runtime及private临时auth/models全部成对退休，源授权metadata未变。没有生产源码变更。

冷写20807.8803ms、恢复5703.6465ms，原10s/5s性能failed。冷写388次helper spawn同步返回累计10051.1036ms，最大216.0915ms；恢复80次累计1719.5322ms。实际env95 keys/3875字符，记录只保存大小、不保存值。0观测丢弃。所有调用仍执行真实Git和原native监管；冷写请求中的全量调用还包含并发页面的命令，不能把这些都命名为该writer自身调用。与原阶段152次Git身份查询、每轮两个命令及每Project一次snapshot边界读取相符。该诊断证明主线程同步阻塞量，但listener开销及并发活动使其不能作为未插桩性能通过证据。

真实并发GET /global/config为16667ms/200；/global/composer-references为22430ms/200，超过原20s页面门槛。CUA（Computer Use Automation，此处仅手动真实交互）42首页Goal入口和紧凑布局可见；冷写打开真实对话时短暂出现Model configuration unavailable，随后真实gpt-6.1-sol/Ask me恢复，保留错误截图，未宣称修复。此前一次恢复19.8s时loaded仅4而非全量，可能受idle convergence影响；尚未证明竞争或根因，不用最后状态推断。

## 诊断工具错误与边界

首次完整观测把exit时process.argv[5]当evidence，普通CLI已改写argv为--port，导致ENOENT并丢失该次内存观测。原Target exit7、Host原exec13835 joined1，真实canonical两写成功并完整恢复；native physical/output/request事实齐全后精确退休runtime pair，失败不记为成功。修复为在CLI导入前捕获不可变绝对路径，新的原occurrence重新验收，原错误和结算保留在results.json。生成第二次脚本时遇到scratch文件wx拒绝覆盖，检查目标为本agent新建的精确诊断脚本后修复命名生成器，未覆盖用户文件。最终归档写入前断言全新绝对目标，445/446旧artifact未改变。

下一轮保留原门槛与完整历史，先测实际Process facade在不同并发度下的完整执行/同步启动成本，区分子进程资源压力和JS包装；不先硬编码新并发策略、不跳过身份复核、不建立worker/IPC新协议或provider缓存。当前所有测量、失败与人工截图见[原始证据](../../artifacts/2026-10-20-windows-spawn-observation/README.md)。
