# 配置验证的短期原生查询作用域

## Recall

490延续用户单agent自主修复、真实体验后提交/push；不委托。489已提交8059bdb26737fb8d27ac270422d481ea3bb73de8且fresh fetch=origin/main。八组完整149目录局部数据表明：整表Git组合9.3秒，但隐式同轮次合批18.9/20.0秒，未投产。原完整Config服务→HostTransport→公开HTTP（Hypertext Transfer Protocol，超文本传输协议）验收仍要求保存≤10000ms、整份恢复≤5000ms、四项并发读取≤20000ms，全部149目录/完整canonical不可缩减。长期Goal active；本批模型额度0，无凭据或模型目录复制，无Provider请求，不操作用户18571/进程/库。

已读489 Recall/全部fromDirectory、Instance保留身份作用域、配置候选与reconcile、目录registrationBatch及正常/继承准入；已读hostGit/Process与Windows supervisor TS（TypeScript）和Rust当前请求/创建/父身份/Job/结算核心，04-extensions与server-runtime-readiness公开契约。沿用benchmark-debug-template：局部收益不是完整性能合格，不运行UI（User Interface，用户界面）自动化。

## 修改前分析

可见现象是完整配置保存/恢复约17—18秒。每项目初始/准入后两次新鲜Git、物理归属和删除fence是当前合同；scope retention已经消除了reconcile重复发现，不能再以TTL（Time To Live，存活时间）缓存或移除检查提速。489真实逐项对照有296次helper启动、累计spawn约10秒且主线程最大间隔约500ms；这只是重叠局部证据，不把累计值当墙钟根因已证实。

显式Project整批提交会改变原每目录独立结算；一个坏目录可能拖累并行合法目录。向原注册准入里塞“等全部Git完成”的barrier会在重叠别名串行准入中死锁。因此不修改Project批算法/队列。新可证伪点是保留原逐项并发12和两次观察，只在短期native helper内执行独立真实查询，避免逐条启动helper；没有查询结果缓存、固定等待凑批、长期daemon或模型路由。

共享控制流风险：现有CreateProcess使用JOB_LIST且继承标准流；多查询共处时必须明确HANDLE_LIST，否则子进程可继承同伴管道导致EOF（End Of File，流结束）迟到。微软[UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)规定继承句柄列表和bInheritHandles；[重定向示例](https://learn.microsoft.com/en-us/windows/win32/procthread/creating-a-child-process-with-redirected-input-and-output)要求父读取端不可继承并关闭自己的子端。原父PID（Process Identifier，进程标识）必须仍是Bun实际owner且出生时间完全一致，不能把helper伪装成业务target或放宽到任意祖先。

当前生产入口含Host/Task命令、shell、SDK（Software Development Kit，软件开发工具包）、plugin、执行胶囊、detached转交；共同依赖原native进程出生身份/悬停创建时Job归属/父死亡/后代active-process-zero/物理、输出和request清理三分支。公共入口不在本阶段变更，私有副本实验也保留原run_request监管与逐请求持久markers。若出现取消、并发、恢复或终态异常，立即横审全部生产入口、Task/Mission/Session occurrence、正常/终态/重试/重启、串并行/多项目，未排除前不称局部偶发。

schema/迁移、用户配置、Goal/消息/Sources协议均不变；无相关死代码删除。原7表3665行保留复核必须通过。新native传输能否满足错误归属、stdout/stderr原bytes、每查询env/cwd/inactivity、EOF、取消与父死亡尚未知，先不改生产或公共架构。不得以私有新协议作为未验证并行生产路径。

## 先行私有资格方案

1. 在.tmp-product-iteration/native-query-scope-490复制当前Rust crate到自有scratch（不是Git branch/worktree），只改副本。增加短期NDJSON（Newline Delimited JavaScript Object Notation，按行分隔数据）查询模式；每请求仍走当前run_request的原父身份、原子Job、ready/helper/pretarget/settled标记。原单请求模式也编译并真实复核。worker直接由实际Bun owner启动，整个Bun进程又处于原413 owned-host/446 Job边界，退出stdin后join原查询和输出并退出。
2. 每项独立匿名stdout/stderr管道、NUL stdin、明确句柄列表；父读取端不可继承，创建完成立即关闭父持有写端。env只覆盖该项原GIT_CEILING_DIRECTORIES，不能共享可变进程环境；默认原90秒IO inactivity，实际读到bytes刷新。已读公共process.ts：原默认输出上限为Infinity，并非预设有限值；本批对照双方显式8MiB资源上限，仅为私有资格边界，不能改称生产默认。失败返回原请求id、明确error/exitcode及实际bytes，不能让其他项目共享错误或假成功。
3. 先单独合同scope，最多50个真实查询额度：正常非空双流/Unicode与空格参数/cwd和不同ceiling、并行快慢输出EOF独立、明确启动错误和同伴成功、主动取消、输出上限、实际IO刷新与静默超时、父owner死亡与native/输出终态。原权限、Job和detached不转交给新scope；不在活跃scope追加模型或命令预算。未用额度退休。
4. 若基础合同有效，交错single-a/scope-a/scope-b/single-b，每组原149目录/148 Git/1非Git、并发12、两次真实查询、原44402 stat+44402 realpath循环。单组296原helper，scope组只一个native scope但296个独立Git目标；所有输出bytes和设备/inode/realpath与489原single-a逐项一致。每组原413 owned-host独立4分钟资源边界，180秒无活动记观察失败，不重启原handle；等待真实物理/output/request/launcher结算。四组合计1184查询上限，单请求596helper加scope2（外层不算查询）。
5. 有收益再另记生产唯一实现/调用点、原checker和完整生命周期合同方案；本阶段绝不以局部149混合负载替代真实完整Config验收，也不自动投产或宣称UI改善。结果保留原失败/阻塞，归档源/运行日志和有限指标，不提交私人原历史或凭据；三索引/docs:check同步，范围清晰提交、fresh fetch+merge、完整pending检查及正常push。若无收益则拒绝生产复杂度，长期Goal继续active。

## 原始首轮与运行器修复（新作用域启动前）

原contracts-a8个聚合正向合同通过（9项scope查询+1项原Process.runHost单请求）：双流/Unicode/空格/cwd/ceiling、并行快慢EOF、CreateProcess明确错误与同伴成功、取消、真实IO刷新和静默超时、输出上限。原launcher exit0且native/输出/request完整。父死亡/活动EOF等仍待本批独立scope，不能写成全生命周期已通过。

原single-a=17963.9666ms、296helper、44402+44402循环、原296输出完全一致。原scope-a149项结果中148Git失败、1非Git正常，全部原请求结算后launcher exit1。根因代码对照：生产spawnWindowsCommand在创建原生request前调用resolveWindowsCommandExecutable/whichAsync；私有客户端漏掉此步骤，将裸git直接交给lpApplicationName。合同中的实际目标是绝对Bun路径，因此未暴露。补回原whichAsync规则，不改生产、不增加解析缓存；后续原样归档raw结果应在外层断言前持久化，防止只剩聚合错误而丢掉per-request事实。

原两scope已结束，原矩阵剩余scope-b/single-b未启动且额度退休。修复后重新声明完整single-c/scope-c/scope-d/single-d交错矩阵，各296独立查询、合计1184上限、各4分钟资源界限、原149/两观察/完整bytes和物理身份/全部结算不变。基础合同预算仍原50项，已10；后续仅使用剩余40，不在活跃作用域追加预算。原失败不会混入合格矩阵或被新成功覆盖。

## 本轮实际结论

原19770 single-c=17468.2428ms/296helper，58107 scope-c=11117.9093ms/1helper，64102 scope-d=11194.0896ms/1helper，30367 single-d=17921.683ms/296helper；各296原Git输出与489逐项一致、原44402+44402循环/输入物理身份全部通过、metrics live0。原各handle自然exit0，不重启；原single-a8793与失败scope-a原exec cdca60分别exit0/1，失败完整收尾保留。累计成功1480次真实Git观察+148次失败启动尝试，不混作成功Git输出。

生命周期原exec a33fd0 exit0：活动输入EOF后查询/输出独立join；自有子Bun owner精确身份SIGTERM结束后，原helper/target/孙进程全部dead_or_reused且原Job active_processes=0。死owner的JS（JavaScript）输出响应分支不能再履行，不宣称公共恢复成功。加基础8项，共10项聚合正向合同/12次查询（原50中38退休），模型0。原exec ed937d基础scope exit0。总8个原scope的native物理/output/request/launcher与host/target出生复核通过。

原schema3/integrity ok、七表全部3665行/rowid/字段/时间及source bytes/mtime保持。没有用户库初始化/迁移、凭据/模型目录、Provider或页面操作；无新UI资格。当前只有自有私有Rust与运行器副本变化，生产未改；[完整原数据与脚本归档](../../artifacts/2026-10-21-native-query-scope/README.md)。首失组未保存per-request底层错误码是明确证据限制，不能以新通过伪补。

收益约6秒稳定但局部11秒仍不满足原恢复5秒，更未证明完整配置10秒/5秒。新传输收集末尾输出，不具备公共Process流式适配资格；所有生产入口/异常帧/worker崩溃/公共恢复仍待审计，当前不推广，避免未足额收益即增加公共控制协议复杂度。下轮若继续性能，应先以原执行链分段证据区分真实目标创建/持久化/物理核验等待，不能再从累加重叠值或微调worker数猜根因。三索引/docs:check同步、范围提交并正常push；长期Goal active。
