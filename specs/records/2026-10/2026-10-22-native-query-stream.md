# 原生查询的增量输出资格

## Recall

522继续单agent，不委托，最新单agent要求覆盖长期Goal旧Astra描述。用户要求持续自主体验修复、实际验证后提交推送。521为progress：6b497cadff28e284bd6ce6a5495bb5e4de5c7b3c已正常push/fresh upstream一致；168完整候选两轮保存/恢复13–14.3秒，原10/5秒仍失败，20秒读取通过。四真图、Sol2/4及原4097/115/四成员配对全部闭合，源90表157004行/167目录保持。开始仅原.bun/、packages/opencorvus/bun/未跟踪。

本批补齐490短期native scope原型的增量输出缺口，不直接接入生产或改变config路径。模型严格0，不复制auth/models、不用Provider/用户库/18571/窗口，不创建业务Task/Mission/Goal/成员。原完整配置目标保持，本批不是新的全量性能或网页资格。

## 修改前分析

已读521 Recall/全量结果、490 Rust ScopeQuery/ScopeIo/collect_query_bytes/execute_scope_query/query_scope、ScopeClient/原正向contracts与launcher，以及当前公共ProcessFacade/ProcessSupervisor/Node适配边界和native Cargo配置。全仓既有Source入口仍统一经原spawnHostCommand/spawnTaskCommand，未改生产定义/调用/API/SDK/配置/schema/UI。

可观察缺口由代码直接证明：旧collect_query_bytes收Vec，execute_scope_query等待原run_request、两输出reader及monitor，query_scope才写一条含stdout/stderr数组的响应；TS客户端只在末尾响应后构造Buffer。它无法把真实字节活动提前提供给现有inactivity/输出观察者。490局部约6秒收益不能替代这一公共合同，完整stdin背压、精确env、回收与worker故障同样尚未资格。

私有改动只移动原reader已经实际读到的retained bytes：按request ID、stdout/stderr、逐流递增sequence和offset写NDJSON（Newline Delimited JSON，逐行JSON）data/end帧，client立即收集/回调，末尾terminal只含结果和流计数，不再携带另一份正文。保留原actual-byte inactivity、共享输出上限、per-query cancel文件、原父PID/birth/悬停创建时Job归属、HANDLE_LIST、ready/helper/pretarget/settled文件和全部join。控制帧/时间不当实际I/O活动，frame/末尾布尔不替代durable物理证据。

已核对权威资料：[Microsoft继承句柄/明确handle list](https://learn.microsoft.com/en-us/windows/win32/procthread/inheritance)、[Node child_process close](https://nodejs.org/api/child_process.html#event-close)。当前实验仍以锁定Bun1.4.0实际运行结果为准，不把文档示例或新版Node表面行为当Bun资格。父输出、target物理结束和helper整体close分别核对。

风险/范围：共享stdout序列化错误、unknown/duplicate frames、双流交错与截断、回调失败、取消与peer独立性、scope EOF及owner死亡，不能把最后一条frame等同物理/输出/request全完成。若新真实收敛异常出现，立即横审公共Host/Task/Mission/Session occurrence、正常/终态/重试/重启、并发/多项目的同语义路径；未排除前不归因偶发。该私有原型的公开consumer背压、stdin流、一般env、公共错误投影、detach/转交/恢复不在本阶段实现，未通过不能投产；当前生产架构无需改写。

## 实施前方案

1. 在.tmp-product-iteration/native-query-stream-522新建私有Rust副本，仅复制490 manifest/lock/source，独立Cargo target、locked/offline编译；不覆盖旧helper或生产二进制。新原型只保留新的增量scope响应，旧490二进制/客户端仅用于before反例控制，非生产fallback。普通单请求模式仍运行相同原native core，用一项正向合同确认。
2. 先buffered-control：一个真实自有Bun命令写early字节后等parent ACK文件，再写late和返回7；独立3秒fixture边界明确返回23。旧客户端不会提前交付，预期新正向合同失败；先写真实结果/完整结算再抛断言，保留原exit1，不靠标题或计时器声称流式。
3. 新contracts-a验证：真实early回调/ACK发生时target exact_live且先于terminal；Unicode/二进制双流精确；并行快peer不被慢peer EOF持有；明确CreateProcess错误与peer成功；真实data后只取消该query且同scope可继续；静默inactivity错误和真实间歇字节刷新；上限精确retained bytes及原Job结束；接受查询后输入EOF仍join原查询、双流和请求；原Process.runHost单请求双流。核心断言是明确bytes/错误/身份/状态，不写负向调用测试，无UI自动化。
4. lifecycle-a只对明确自有原owner做root-only退出故障（先核对实际PID/birth），观察其query helper/target/孙进程全部dead_or_reused和原Job active-zero。JS recipient已死时标记output recipient unavailable，不伪称正常JS交付。原outer413/446监管保留4分钟资源边界，不操作用户进程。
5. 固定process查询额度：control1、contracts-a最多14（含普通单请求）、lifecycle-a最多2，另预留失败工具/实现修复后全新contracts-b最多14，合计最多31；未启动部分退休，不重启活跃scope/覆写原日志。各scope4分钟/180秒无活动观察，超时不当终态；仍等同原handle/物理证据。模型0，没有额度挪用。所有CWD/标记/取消/清理路径都在对应自有runtime内，精确检查再清理。
6. 每个query逐流sequence/offset/end和末尾计数与实际收集bytes一致，ready/helper/physical marker验证后才清理原query目录；helper close及stderr/输出全部drain，原外层native/output/request/launcher和精确出生链完整。新原型不是public spawn流/consumer背压或完整新executor资格，不宣称原10/5秒已解决。
7. 归档实际源diff、编译/原反例/正向结果/失败/完整结算，三索引及当前docs/architecture/安全检查，范围提交、fresh fetch/merge/完整pending审查与正常push/fresh一致；生产未满足项继续，长期Goal active。

## 初次控制夹具修复（新scope前）

private Rust21227实际locked/offline release编译0/18.68秒，生产和490旧二进制未覆盖。首control e6a233 exit1、实际target23，原scope/helper/target/outer physical/output/request/launcher完整；但复核发现夹具没有传递observer，不能作为相同新合同的有效前后比较。原源/结果/日志/完整失败结算保留。改为before/after共用同一个真实early observer：提供回调、验证实际target exact_live、写ACK，旧客户端会忽略其不支持的观察选项；新客户端必须实际触发。

在原control已完全终止后，新增buffered-control-callback一个查询，**从未启动的conditional contracts-b14中扣1，contracts-b剩13，总上限仍31**，不扩活跃scope/模型预算。先以新scope保留有效原反例，再继续contracts-a；首次夹具错误不冒充原型故障。

## 实际结果与结算

- 有效旧版控制59f8f3原exit1：确实传入同一observer，但旧buffered客户端只在整包终态返回，因此target等ACK到期返回23，stdout为`early\n`、stderr为`ACK deadline\n`，未达到预期7/完整双流。原结果、observer和旧客户端均保留。
- 新contracts-a 3f333f原exit0：10项正向合同、12个scope查询加1个普通公共Process.runHost。首early回调315.4519ms在精确target存活时写ACK，terminal348.4326ms；最终7/`early\nlate\n`及`done 中文\n`。受控命令只能在ACK后继续，这一因果约束独立于时间测量。二进制/Unicode双流、快慢peer、明确CreateProcess错误后的peer、真实输出后取消、700ms静默超时、实际间歇字节刷新、1024 retained-byte上限、普通单请求和stdin EOF收尾均通过。逐流帧计数/offset与实际字节相符；原helper close0、12个query目录在durable marker核对后退休。
- lifecycle-a ca2d0b原exit0：1项正向合同、2个查询；只终止明确自有owner，owner/helper/两target/孙进程共5个精确身份都dead_or_reused，两Job实际active_processes=0。owner死亡导致原JavaScript接收端不可用；不宣称正常逐查询输出交付完成，也不据此归因单一watcher或宣称公共orphan recovery合格。自有fixture在复制原物理标记并验证后清理两query目录。
- 四个原scope的ready/settled/launcher身份与exit相符；physicalCompletion、outputDrainComplete、requestCleanupComplete均true，再观测外层8个精确host/target都dead_or_reused。所有原exec已终止；Cargo原21227已join。累计17/31个process query attempts（包括首夹具错误、有效before合同失败和明确启动错误），剩余14退休；未启动contracts-b。模型0基于纯进程fixture、实际输入与调用图，未安装RealProviderAudit或网络审计；auth/catalog从未复制/绑定，未运行Provider、业务数据库服务或18571。
- 复核`process-occurrence.ts`实际Windows分支：读取出生时间后通过`WaitForSingleObject(handle,0)===WAIT_TIMEOUT`确认仍活着，`exact_live`并非只比较旧出生标签；未观察到新的共享收敛异常。候选Rust只替换私有490的collector/scope响应段，普通run_request核心保持原来源，完整diff和source归档；生产package源码、本地正式构建和schema均未修改。

本批资格仍是私有增量观察并收集输出。未实现/未资格：公开consumer背压、流式stdin、一般env、worker与协议故障、公共错误投影、detach/转交/全部生产入口恢复。没有新的全量配置耗时数据；521保存/恢复13–14.3秒，原10/5秒仍未满足。不得投产此原型或通过新的配置旁路绕过公共Process合同。下一轮先补公共输入/背压和故障收尾合同，再决定是否有资格进入真实全量配置路径。

归档与验收见[产物索引](../../artifacts/2026-10-22-native-query-stream/README.md)。实际`bun run docs:check`通过345 ops/26 groups，`bun run check:architecture-index`通过20文档；范围diff check通过。归档完整候选源码、原始结果/log压缩字节及物理结算，当前所有产物/record/三索引含解压payload的实际凭据值扫描0匹配、原auth bytes/mtime保持。仅spec交付，生产未改；正常提交与upstream merge/pending审查/push后以fresh远端一致作为Git交付证据。
