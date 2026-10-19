# 真实监管命令的并发启动压力

## Recall

持续单agent自主迭代，不委托。447提交9c1cfab98只调查：FFI（Foreign Function Interface，外部函数接口）绑定不是19秒根因；Bun/Node各48叶子命令exit0；真实全历史服务cold20807.8803ms/restore5703.6465ms，388次实际helper spawn同步累计10.05秒。原10s/5s/20s门槛保留，实际composer references GET22.43秒也failed。已有Goal首页入口/布局441保持，447手动页面看到了保存期间短暂模型错误，未解决不能报告完成。原QA数据80 Projects、schema2、canonical完整恢复；原服务/检查器全部结算，临时auth/models对退休、源授权未变；用户18571及工作区.bun/、packages/opencorvus/bun/未动。447正常pre-push正在执行，完成后才能无干扰运行本轮性能诊断。

## 修改前分析及范围

已读447 Recall/全部阶段与spawn观测、443真实Process诊断、Process facade/runHost、Windows supervisor request/ready/物理输出结算、Project.fromDirectory两次身份发现及每轮两Git命令、Config全量并发/paired snapshot、Instance身份保留/idle convergence、当前05-config与server-runtime-readiness架构。全仓搜索settledWork、registrationBatch、readOnlyWorktreeBoundary、fromDirectory、spawn入口。当前host availableParallelism12，每Project身份阶段最多两命令，同时最多24个helper和24个target；原始version串行对比只有约5ms而完整服务平均约26ms，触发差异未知，不能直接归因Bun或硬编码限流。

候选根因为实际系统进程创建/资源压力、宿主进程状态或包装开销，尚未知。这里只测同一实际Process.runHost/Git/native helper完整链，保留新的request generation、真实owner/出生时间、Job（Windows作业对象）与全部输出/物理/请求结算，不创建新worker/IPC（Inter-process Communication，进程间通信）协议、不跳过身份复核/项目、缓存真实观察或修改schema。未发现新的队列/恢复/终态异常；若出现则立即按共享机制横审全部生产入口、Task/Mission/Session occurrence、正常/终态、重试/重启和项目隔离。

## 实施前方案

1. 在自有新runtime、同一446 release helper上，调用原Process.runHost执行实际Git metadata，按1/3/6/12/24并发、反向交错复测；每组同样48条命令、相同输入/cwd/env，记录完整结算时长与原spawn同步耗时，不只计ready。计时保留原错误和child，不读或替换输出。15秒无活动超时沿用原Process合同，不增总时长性能超时。
2. 原生退出/output/request都结算后才结束诊断；失败保留原证据并修工具后重跑。没有Provider请求，不复制授权、不接触用户数据库；隔离环境在导入生产模块前显式设置。
3. 根据结果补充根因和影响分析再决定生产改动。配置/策略只进入现有唯一配置面；不先引入任意并发常数、平台备用路径或无需求抽象。非UI（User Interface，用户界面）变更必须真实正向合同，最终完整80+历史的原checker、真实流式gpt-6.1-sol预检与手动页面截图；不运行UI自动化测试。
4. 索引/证据同步、必要docs与architecture检查，范围提交，fetch/merge、完整待推集合复核、正常hook push。没有达标仍继续，goal保持active。

## 测量结论与实施前调整

447已fresh fetch HEAD=origin/main=9c1cfab98a1ddef1f214f0e920e86c06a6f1652e，正常hook全部通过后才启动448。原exec27235 joined0；480个真实Git命令的两种路径输出均与独立realpath核对，原Process完整结算通过。1并发两轮9.53/6.39s，3并发2.77/4.14s，6并发2.73/3.50s，12并发2.59/2.20s，24并发2.74/2.16s。每轮48条、同cwd/env/helper；同步累计0.65–2.12s，未证明降低并发能稳定加速，故不修改现有并发策略。该阶段没有Provider或数据库初始化，不冒充全量验收。

代码根因为每轮Project Git发现分别启动两个受监管Git来读取top/common；cold初次+准入后共四个命令。单纯which异步/parent点查询不消除主线程进程创建。此前442拒绝--sq的跨平台统一分行正确：POSIX文件名允许换行；不能重试另一协议。依据[Git rev-parse](https://git-scm.com/docs/git-rev-parse)一次可输出多个指定路径；[Windows命名规则](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)普通目录禁止1–31控制字符，因此Windows可明确采用一次命令的两行合同。当前Windows Node真实mkdir普通/extended两种命名空间的换行目录均返回EINVAL；这只是本机边界诊断，不替代平台合同。POSIX保留两个单路径命令，且只去掉Git自己追加的一个LF（Line Feed，换行字符），不trim真实文件名。

计划改动只在Project私有Git发现：Windows一次rev-parse --path-format=absolute --show-toplevel --git-common-dir并严格核对两个非空路径；其他平台两个独立单路径读取，保留原并发和完整两次物理身份复核。统一读取器只使用Git作为事实源，没有Windows失败后重试POSIX协议、缓存路径或新配置。旧text捕获任何错误并返回undefined，后续以directory/.git猜测身份；这在已有.git损坏时不是可靠事实，必须同步删除此旧路径，新增ProjectGitDiscoveryError（command-failed/invalid-output）并映射HTTP（Hypertext Transfer Protocol，超文本传输协议）400，进程执行/超时错误保留原cause。没有.git的普通目录仍按既有非Git合同处理。

影响面全仓8处Project.fromDirectory引用：Instance初次发现、身份refresh、rollback恢复及相同Context构造，外层Task/Mission/Session均由同一Instance进入；不存在独立新增路由绕行。公共Project.Info、generation、注册锁、lease、持久数据/schema、Provider和LLM（Large Language Model，大语言模型）消息不变。新错误只在已有.git却无法取得真实Git元数据时显式拒绝，用户需修复仓库；不将未知身份写成新Project。先真实损坏.git正向错误测试复现，再正常/linked/junction/空仓库/分离Git目录/身份交换/注册并发、全量配置checker和人工页面。POSIX真实换行/尾空白路径合同在该平台运行；Windows当前验收如实列出平台限制。不以spawn“不调用”断言验收，仍核对真实最终身份与错误输出。

实际HTTP（Hypertext Transfer Protocol，超文本传输协议）检查又暴露一个同源触发条件：损坏的本地.git若位于有效父仓库中，Git会忽略它并向上发现父仓库；所以仅检查exit code仍不足。首次D盘scratch请求确实把D:/myhexin-local/opencorvus登记进隔离QA库，之后配置层级冲突409；该源码仓库.git/opencorvus标记的实际creation为2026-08-09、mtime为2026-08-14，未在本轮改写。保留QA新增row，不清历史。移到C盘私有scope仅证明无有效父仓库时400，不能作为这个新条件的修复。新增真实父Git+损坏子.git正向错误用例，当前代码真实失败（原test runner正常结算exit1）。

实施前调整：由同一Git读取器在已有本地.git的前提下，对这次命令设置唯一GIT_CEILING_DIRECTORIES=dirname(directory)，限制自动发现至目标本身，保留Git原有所有权/safe.directory校验和配置语义；没有.git仍按原非Git目录分支。根据[Git环境合同](https://git-scm.com/docs/git)，ceiling不排除当前目录。没有选择--git-dir，因为显式指定仓库改变自动发现及信任语义，超出本次读取优化。完成这个真实祖先条件、原正常/linked/alias及其他身份合同后，重新冻结新服务完整验收；此前15.46/15.59秒仅为绝对路径校验版本的中间结果。缓存默认4及请求finally的原scheduleConvergence共同解释恢复又初始化77项，已以处置日志核对，不把正常收敛当新队列异常或改大缓存来过门槛。

## 实现与分阶段真实验收

交付复核还发现同一读取器的前置分支：which找不到Git时，已有.git仍进入resolveNonGitDirectoryIdentity并猜测/写marker。它违反本轮明确身份合同，不能作为“缺少Git”的兼容路径保留。实施前补充：已有.git且命令不可用返回同一个GitDiscoveryError的command-unavailable；没有.git的目录继续原非Git身份。删除因此变成死路径的local marker写入参数与分支，只涉及本次被替换的身份路径。真实PATH指向自有空目录的正向测试分别验证Git仓库的明确错误和普通目录的正确Project身份，finally恢复测试进程环境，不修改用户PATH。之前37例、2 HTTP与完整性能是这个复核之前的结果，后续最终证据必须区分并重新验证。

同一私有Git路径读取器完成Windows一次双路径、POSIX独立标量读取、全部原操作settle后再抛错、严格绝对路径和命名空间边界；删除原catch→undefined及directory/.git身份猜测。原初次/准入后身份复核、registry generation和Project/Task/Mission/Session所有权不变。损坏本地.git的明确ProjectGitDiscoveryError有command-failed/invalid-output原因，HTTP400；普通进程执行错误保留原cause。没有并发参数、Schema、LLM或UI源码变更。

原聚焦runner提供两次失败→修复证据：孤立损坏.git、有效父仓库下的损坏子.git。最终按文件取最新的6份合同，共37 pass、82断言、1个POSIX路径用例明确skip（不计为通过），覆盖主/linked/junction、空仓库的同目录分离metadata、独立宽inode/真实hardlink、Project身份与Session prompt owner收敛、registration batch、identity retention和全项目配置。最终typecheck exit0。原HTTP公开/project/current对D盘原始子目录和C盘隔离损坏仓库均400、精确错误name/reason/directory一致，无mock或旁路。初始409和“仅工具scope”解释保留，同时用http-scope-root-correction.json明确纠正根因。POSIX真实特殊路径尚未在该平台执行，不伪称全平台验证。

after/final/reviewed三次完整QA原native开发服务全部真实gpt-6.1-sol streaming预检成功，credential/catalog/实际模型分别可核对。最终reviewed未插桩、实际OS（Operating System，操作系统）确认仍是446当前release helper。全84项目，cold15746.4516ms、restore16535.8561ms，原10s/5s仍failed；真实并发/config GET11970ms与11093ms均200，原20s页面门槛通过。前轮插桩20.8s与当前15.7s条件/项目数不同，不宣称严格等价加速比。没有把暖缓存、增大保留量或缩减历史替代原要求。

CUA43/44/45真实桌面交互、截图人工查看；最终首页明确Goal入口、Chat显示真实OK/Ask me/gpt-6.1-sol与Goal栏。悬停提示覆盖内容时移开指针再截图，未把遮挡误报为消息丢失。当前目标无UI源码改动，也未运行UI自动化。原服务public shutdown200，原launcher77714/49785/3170全部joined0，原checker47524/23058/22108全部joined0；每次native physical/output/request完整结算后runtime auth/models对退休，最后private pair也成对退休；源授权metadata未改。直接只读SQLite确认schema2、84 Projects，原完整canonical已恢复。用户18571及窗口/进程未操作。

证据：[37例正向合同、2例公开HTTP与真实页面](../../artifacts/2026-10-20-native-spawn-pressure/README.md)。人工二次复核：输入错误的两个真实触发均已修复、成功身份合同保留；完整性能仍未满足，持续goal不完成。下一轮继续原完整数据和门槛，优先研究主线程进程创建的剩余成本及安全的成熟异步执行primitive（基础组件）；任何公共进程协议/worker生命周期变更前另行完整分析、方案及横向验收，不在本轮偷偷引入。

## 交付冻结结果

上述37例是availability复核前的中间证据。最终38 pass、84断言、1 POSIX skip；新增真实缺失Git及普通目录的明确行为，原失败before-availability-contract.log保留。现有.git且Git不可用时command-unavailable/400；普通无.git目录仍可正确登记。删除非Git读取器local marker写入的旧分支。最终availability typecheck exit0，无后续源码修改。

第四次全历史未插桩服务availability预检仍为实际gpt-6.1-sol streaming，当前release helper物理路径核实；原checker82853和launcher32785 joined0、public shutdown200、native physical/output/request齐全；runtime及fresh private auth/models对均退休，源授权metadata未变。只读SQLite为schema2/85 Projects，canonical完整恢复；原三个scope也全部完整结算。CUA46最终首页/实际回复截图人工呈现并查看，最后关闭本轮自有标签页。

最终cold15800.2715ms/restore16365.7551ms，原10s/5s均failed。扩大collector为所有真实并发GET（不再按配置路径挑选）后，25个完成读取里/chat/capability 28915ms、/expert-squad/catalog 28977ms，虽然均200，仍超过原20s。因此此前中间结果“pageReads=true”只证明有限路径，不是完整页面通过；reviewed-results.json保留原中间判断，results.json已以完整观测更正为false。这是验收工具覆盖缺口，不能掩盖；没有通过调高超时或缩减请求类型解决。

下一轮首先研究全局candidate validation期间的共享catalog读取等待与连续两个writer的读者进展：/config约12s可返回，能力/专家团目录跨两次writer等约29s。不能只依据这个最后时长判定锁根因；须核对当前公共catalog/config owner、所有生产入口和原句柄/队列事实，再另行落盘方案。当前交付仅修复Git身份/命令成本，性能目标继续active。最终证据主入口：[38例合同与全页面失败事实](../../artifacts/2026-10-20-native-spawn-pressure/README.md)。
