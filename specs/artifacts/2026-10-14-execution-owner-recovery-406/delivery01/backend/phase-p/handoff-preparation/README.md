# 406 Phase P 实现与新过程 checker 首次运行前交接

当前 production `permission/authority.ts` 已冻结，Root UI scope期间不会修改。新正式过程test与唯一worker仅准备，**一次也未执行**。本目录完整源为待审快照；`implementation.patch`与`focused-test.patch`是相对当前HEAD的明确本任务差异；`manifest.json`记录四源与原检查。上一错误prompt_async稿在`../process-before-public-route/`，发现于首次运行之前，没有HTTP 404或虚构运行失败。

首次预算审阅原像在`../process-before-outer-deadline/`：当时README声称受更早wrapper约束，但case代码没有取得那个deadline。现`run-formal.ts`只为这个唯一process test注入本次真实`OPENCORVUS_PERMISSION_OWNER_DEADLINE_AT`；测试必须取得该明确值，不能自行缺省成新600秒。集中tests/typecheck没有新增此配置。修正前从未执行process case，不能把它记成运行失败或通过。

## 已完成的正式检查

- `../red01`：原生产、23 tests，17 pass / 6 fail / 67 assert，原exec2283 join1。
- `../green01`：当前生产、23 pass / 0 fail / 92 assert，exec82791 join0。
- `../related01`：permission-continuation-recovery8/25、permission-message-settlement10/22、permission-message-recovery6/39、process-liveness-owner4/11；共28/97，exec79068 join0。
- distinct后台合计51 tests / 189 assert，不累加红态和重复类型检查。
- `../types01`包声明core typecheck（node max-old-space8192本package TypeScript）exec65133 join0；`types02`含新process稿exec18367 join0；`types03`含公开message入口修正exec38082 join0。类型通过不证明任何未运行HTTP输入。最终helper仅另补Provider公开请求元数据记录及资源setup失败收尾，最终`types04`见manifest/原owner文件。

以上正式wrapper固定600000ms，原child/physical/output/request全部闭合，原stderr/stdout/owner和各检查当时两tracked源完整保存。生产source在green01以后未变；本轮没有SDK、Question、UI、genericlease/liveness、schema或Providerfixture改动。

## 实现主要边界

唯一authority登记现成physical liveness reference；新execution_started和effect lease同原immediate writer。normal success/failure沿用未过期fence；恢复只按exact Project+start+lease+owner/OS+outcome CAS写真实unknown，dead自然expired保持原expiry，未expired同事务release。MCP只有same current lease的expires小于immutable latestGrant才是明确handback，或原physical owner确死；接续只同attempt/taskId。ref覆盖全部await、结果序列化与commit/handback，finally成对release。本代码没有删除唯一约束、覆盖旧unknown、恢复无owner旧记录或新增接口/配置。

## 新过程源

- `permission-execution-owner-process.test.ts`：四个case的父owner、双独立受控流式Provider、自己的真实CSV HTTP资源、NodeProcess owned_tree、正向完整事实与关闭。
- `permission-execution-owner-process-worker.ts`：正常`listenWithRecoveredServerRuntime`、public Session create→**POST /session/:id/message** owned pending Promise、自然webfetch→exact Permission public allow_once→真实资源请求；只读exact start/lease/grant/runtime/OS/result；正常stop/DB.close。
- `run-formal.ts`：原集中检查已用的600秒薄owner，调用唯一正式`bun run --cwd packages/opencorvus test ...`，不绕内部runner。没有新runtimefactory。

三个worker输入模式来源全是父明确argv，runtime/evidence必须绝对路径，自己的global config只启两个公开fixture Provider，apiKey是公开字面量`local-controlled-provider`。Base/Ask明确；不读真实auth/models、不开真实Provider、不用Task/Mission派发、不创建假消息或完成Tool。

### 四case与期待

1. `live-same-project`：A真实webfetch进入HTTP资源持有期；B新backend正常同Project bootstrap，自己的第二Provider也发真实webfetch。父在双方ready后释放公开CSV；双方message POST最终200、自然assistant stop、原Tool.output与Permission durable result精确为CSV、各自same lease真实release，项目requested全集含两个实际request。
2. `live-two-projects`：B先开自己的独立Project再通过正常HTTP访问A Project；两Project各有真实Tool/Permission结果及精确项目ledger集合。不是只断言“未写other”。
3. `dead-unexpired`：A真实webfetch请求已到达，保存真实start/lease/grant/OS后自己exit23，父physical join后B正常bootstrap；同attempt真实unknown、同lease提前release时间等unknown记录时间。
4. `dead-expired`：同样真crash；父等待原120秒lease真实自然到期后启动B。没有改时钟/lease/grant；原expired值保持，OS dead单独证明，结果为原attempt unknown。

当前源码没有动态执行过以上四case。未知/opaque边界由已通过集中正向合同和现存process-liveness局部observer合同覆盖，**不称真实OS unknown_live过程通过**。MCP task上下文与handback是集中authority合同，**不称SDK远端task端到端**。Question及Task业务完工不在Phase P过程目标内。

### 原预算与收尾

正式外wrapper从自身setup开始整次600秒；仅此process test接收其原deadline。每case parent deadline=min(wrapper原deadline,case开始+600秒)，closeBy=该值-60秒；每child deadline=min(now+180秒,case closeBy)，worker再次核对它≤wrapper原deadline-60秒并给自己15秒关闭。每次最多两个child，后一case不从新Date.now()取得额外的外层预算。

父setup在创建runtime后、源复制后、资源和各Provider准入前后核原closeBy；child setup受原NodeProcess的更早physical deadline约束，并在runtime/listener/recovery阶段核本closeBy。每个HTTP的requestDeadline=min(now+30秒,child closeBy)，资源holdDeadline=min(arrival+30秒,parent closeBy)，文件等待和实际leaseexpiry等待也取该原最早截止。到原reserve只能收尾，不能新准入或续延。已批准message请求只是并发持有同一Promise，未增加HTTP期限。

父两个资源/Provider有明确正常close；resource handler本身有settled Promise并join，不把Bun.stop返回等同尚未结算的handler已完成。每child stop调用在任何Instance callback之外，避免403已排除的测试自锁。所有物理/输出/request/Provider/resource结束后才删除自己的managed runtime。

任一前置/模型fixture/类型/身份输入失败按原source/HTTP/stdout/stderr保留，先查工具，不换期待或延时。正式断言在双方完成与正常关闭后执行；真实Tool error只在完整快照中出现，不被helper改写成成功。

## Root批准后的精确首次命令（当前未执行）

```powershell
$env:PATH = 'D:\myhexin-local\opencorvus\.tmp-product-iteration\sse-compression-305\bun140\bun-windows-x64;' + $env:PATH
$env:OPENCORVUS_PERMISSION_OWNER_EVIDENCE = 'D:\myhexin-local\opencorvus\.tmp-task-question-recovery-406\phase-p\process-evidence01'
New-Item -ItemType Directory -Path $env:OPENCORVUS_PERMISSION_OWNER_EVIDENCE -ErrorAction Stop
bun .tmp-task-question-recovery-406/phase-p/run-formal.ts process01 test test/permission-execution-owner-process.test.ts
```

开始前必须确认`process01`和`process-evidence01`均不存在；只创建明确的新evidence目录，不能覆盖原失败。父运行时在每case保存actual test/worker/authority原源、spawn原argv/deadline、HTTP/ledger/result/OS facts、正常/失败/physical owners、metadata-only Provider实际model/stream/declaredTools与cleanup。不复制runtime数据库/auth/models，也不保存Provider全部请求payload。最后清理本进程设置的测试evidence环境变量即可；凭据未使用，无需任何用户凭据清理。
