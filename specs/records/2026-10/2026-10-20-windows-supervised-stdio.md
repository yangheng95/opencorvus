# Windows 监管进程的标准管道诊断

## Recall

持续单agent自主迭代，后续单agent要求覆盖旧goal中的三个Astra，不委托。上一轮453是progress：ec9e69f204a09cffedebb63c9b435e6aac2bb8a9已正常push，fresh fetch HEAD=upstream；完整ModelsDev声明不可变、每Provider独立可变models按需构造以及环境候选先行，82例/254断言和正常hook通过。完整98 Project/schema2历史保留；实际98项目cold12.034/restore0.930s，复测10.982/11.441s，原10s/5s仍failed，写锁期间HTTP读取最长10.468s/200。实例默认4的闲置回收解释恢复重新进行94次身份/Git发现，不提高cache上限来过指标。

453所有四服务、原checker/reader句柄及runtime/private两组auth/models均完整结算退休；原授权源期间更新已真实记录，后续使用更新后的已授权配对成功gpt-6.1-sol流式预检。浏览器被Work设置禁用，最终scope视觉验收未达成；本轮不使用其他技术绕过，不操作用户18571、窗口、进程或数据库。开始只有既有.bun/与packages/opencorvus/bun/未跟踪。不新建branch/worktree，不清库、缩Project、改变schema，不新增/运行UI自动化。

继续已应用benchmark-debug-template。上一轮CPU（Central Processing Unit，中央处理器）真实请求窗口的native spawn自身样本515/1410和504/1452仍最大，Provider已另修；不能把采样比例当毫秒或相加并发span。原cold10s/restore5s/page20s指标保持。本轮先无凭据、无Provider请求、无生产DB initializer的自有scratch实测，若有生产改动，必须全调用/结算合同、正向回归和实际完整服务验收后提交推送；浏览器禁用时视觉限制明确保留。

## 修改前分析与排除项

已读453 Recall/完整阶段、447 windows-ffi-binding及raw-spawn/pass-through观测、448 native-spawn-pressure的480条真实命令、446父查询、当前server-runtime-readiness、Process facade/runHost、ProcessSupervisor Windows request/ready/cancel/settled与管道转发、util/process-node。精确搜索标准stdio与全部Windows spawn入口。447单叶子在Bun1.4.0与Node25.7.0均约5ms，FFI绑定不足解释慢；448并发12/24没有可靠下降空间，不能重做相同试验或任意限流。两个Git命令已在448合并为Windows单次，450已沿原保留身份边界消除重复Git，不能再次假称新优化。

当前共享Windows command/shell通过同一spawnWindowsRequest启动独立helper，stdin ignore/pipe、stdout/stderr pipe，detached=true/windowsHide=true；每次独立request文件、真实owner PID/出生时间、helper直接父校验、Job归属、ready/launch-failed/settled、原输出/请求清理全部必须保留。util/process-node还有root-owned/tree-owned入口和detached转移，不能只测一个Host命令就更改全部入口。当前未发现新的队列/调度/恢复/终态异常；若诊断出现则立即横审全部生产入口、Task/Mission/Session轮次、正常终态、重试重启、串并行和多项目隔离。

查阅[Node标准stdio合同](https://nodejs.org/api/child_process.html#optionsstdio)与[Bun对应接口](https://bun.sh/reference/node/child_process/SpawnOptions)：overlapped在Windows为child stdio增加FILE_FLAG_OVERLAPPED，在其他平台等同pipe。这不是资料已经证明的本机提速；在线文档面向当前版本，锁定Bun1.4.0的实际支持及Rust helper/Git/stdout完整性仍未知。不能直接换Bun专属spawn，不能假设同步Rust或任意子程序正确处理新handle标志。是否改善同步spawn或破坏完整输出必须实测。

## 实施前方案

1. 从原QA412闭合后的库直接readonly SQLite读取完整98个真实worktree，只保留本地.git存在者作为本轮只读Git输入并记录排除原因/数量；这是进程诊断输入，不代替最终全Project配置资格，不生产初始化或修改Project。标准宿主Process.runHost在独立新OPENCORVUS_HOME、原446 release helper、固定安全env下执行同一真实rev-parse。Node child_process.spawn的scratch包装仅对确切该helper替换stdout/stderr的pipe为overlapped，所有其他参数、返回child、事件、owner/Job与原settled合同保持。原pipe模式也走相同被动计时包装，交错顺序避免单次冷启动推断。
2. 至少两个交错轮次、串行与当前并行度，每组相同命令输入和完整结算。比较原实际stdout/stderr路径值、code、原exit/close与Process完整返回；独立realpath核对真实绝对Git路径。补充实际受监管Node子程序的大stdout/stderr和stdin回传，逐字节检查明确业务输出，覆盖backpressure而不以摘要替代。等待全部接受命令settled后才能切换模式/退出；原错误保留，失败先结算自有句柄再调查，不对用户进程操作。
3. 若管道不等价或没有稳定完整收益，保留原生产pipe，不新增备用实现、配置、worker/IPC协议或Bun分支。若确有证据，再补记根因、全部共享入口及迁移/交付/测试风险后实施唯一正确策略；真实正向覆盖错误、取消、并发、Host/Task/root/detached/recovery与完整stdout/stderr。随后完整98+历史真实HTTP配置checker、授权gpt-6.1-sol配对预检与原10s/5s/20s指标；视觉禁用仍明确未达。
4. 新artifact绝对目录写入前断言、保留原诊断失败/输出/结算，三索引与相关架构按实际变动更新，当前docs/architecture/API检查，范围commit、fetch/merge upstream、完整待推集合复核、正常hook push及fresh fetch。没有最终资格不标goal完成，也不因只剩文档而省略本任务提交。

## 原检查结果与决定

第一次原句柄3965在144条Git和4条大输出命令全部通过后，因为scratch汇总调用了不存在的ownershipSnapshot而exit1。已保留原脚本错误日志，改为实际metricsSnapshot后重跑同一检查。第二次88569的完整measurements.json已保存：六组各24条真实Git均fulfilled，四条大输出均code0，原close均code0/signal null，原监管live=0。上下文边界截断了最后一次原句柄结果，再读88569已退休；因此不补写未观察到的最终数值exit code，也不为补观察而启动第三轮。

第二轮串行pipe/overlapped为3485/3615ms；并发12的两组pipe为1394/1714ms，overlapped为1701/1756ms。两次pipe大输出为161/171ms，overlapped为218/179ms；每次都完整写入1MiB stdin、逐字节验证2MiB stdout和512KiB stderr。没有稳定收益，生产管道保持原pipe，不引入新协议、配置、宿主分支或缓存。

输入来自闭合QA412数据库的直接readonly读取：98 Project/schema2，97个本地Git、1个普通目录；选24个Git输入仅做进程诊断，不冒充完整配置性能验收。新scratch runtime只有cache/version，没有数据库；本轮没有生产数据库初始化、Provider请求或凭据复制。用户18571的readonly页面请求超时，未刷新、重启或操作其进程。当前浏览器仍被Work设置禁用；没有本轮UI资格。用户最新指出Goal发现性和默认页布局，后续优先处理该体验诉求。

证据：[标准管道实际测量](../../artifacts/2026-10-20-windows-supervised-stdio/README.md)。本轮只交付可复核的诊断记录，原配置10s/5s指标仍未满足，持续目标保持active。
