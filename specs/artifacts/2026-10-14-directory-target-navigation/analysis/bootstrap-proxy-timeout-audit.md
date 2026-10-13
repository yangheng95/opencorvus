# Bootstrap system-proxy timeout：只读横向审计

术语：CLI（Command Line Interface，命令行界面）；SDK（Software Development Kit，软件开发工具包）；HKCU（HKEY_CURRENT_USER，当前用户注册表根）；PAC（Proxy Auto-Configuration，代理自动配置）；FFI（Foreign Function Interface，外部函数接口）；POSIX（Portable Operating System Interface，可移植操作系统接口）。这些名称描述代码公开对象，不表示此次读取了其环境或私有值。

## Recall 与执行边界

Root 在已授权的 dot Native Prepare 原轮次发现 Host stderr 的 72 字节：

```text
[opencorvus bootstrap] detect system proxy: spawnSync reg.exe ETIMEDOUT
```

该轮 fixture 六例准备完成，Target 自然 exit 0；不能因此称 Host 无错误或将其 bootstrap reg 子进程算入 Target 的结算。此次任务仅审查源码、已有持久证据和官方资料，覆盖生产启动、Task/Mission/Session、native/service/tool、恢复重试及正常/受控终态；不运行 reg，不读取当前环境变量值、registry、auth 或凭据，不启动实例/API（Application Programming Interface，应用程序接口）/模型，不操作用户进程，不改产品/工具/测试/正式规格/Git，不再委托。唯一新增文件是本 scratch 报告。Root 继续此前已授权的同 fixture 32 项文件只读调查，其结果由 Root 独立判断，本报告不代替它。

已读：本批正式 `specs/records/2026-10/2026-10-14-directory-target-navigation.md` Recall 及新增 timeout 段；本 scratch `run-dot-native.mjs`、`native-host.ts`、`dot-mixed-qualifier.mjs` 和 inputs；dot-native-prepare-node 原 input/parent/ready/settled/两级 stderr、Target JSON Lines；`runtime/system-proxy.ts`/`shims.ts`/`bootstrap.ts`/`binary-launcher.ts`/`process-occurrence.ts`，两产品入口及 artifact entrypoint；现 ProcessFacade/ProcessSupervisor、Node adapter、server runtime/readiness/restart/shutdown、project bootstrap/recovery、SDK launcher、Tauri sidecar owner；共享网络代理及 shell/browser/package-tool 环境生产者；8 月 ARC-024 历史决定。

搜索边界：在全仓当前非 generated/dist/node_modules/历史 artifact 代码中搜索 `SystemProxy`、`system-proxy`、`installProcessShims`、`installProcessBootstrap`、`runtime/shims`、`runtime/bootstrap`；在全部 opencorvus 生产目录搜索同义 process entry、supervised Host/Task、`execFileSync`/`spawnSync`、代理环境和 recovery/settlement；专门检查 SDK、Tauri、build/launcher、测试目录与现架构/记录。没有运行任何测试。无当前 Git 状态/提交查询，因为本次精确授权禁止 Git 操作。

## 可确认结论

1. **真实现象是 Host 的操作系统代理发现超时后继续启动，且探针的详细事实未保留。** Native Target 的创建、输出和结算成功是另一对象的正确证据。已证明的直接路径是 Host 显式调用同步 shims → SystemProxy.install → Windows defaultExec → execFileSync(reg.exe) → shim catch/message-only warning；不是 Task/Mission 队列调用，也没有模型参与。
2. **造成 reg 超时的底层原因未知。** 已知当前生产查询的超时输入是 2000ms，但这次没有 reg PID（Process Identifier，进程标识）/birth/实际 executable/原 error 字段/原 stdout/physical exit 事实，不能区分执行、启动、安全软件/资源/registry、宿主实现或其它原因。不能称偶发，不能以最后 ETIMEDOUT 反推 registry 错误或 Native Job 错误。
3. **共享影响在 process bootstrap，不在单一 Files fixture。** 两产品入口和本 Native Host 显式安装它；同进程安装一次，失败也保持 installed=true。所有 Project/Task/Mission/Session 使用该进程已有环境；新后端、SDK 启动或 restart replacement 新进程再次安装。恢复扫描/HTTP 请求不会单独重查。
4. **当前信息不足以宣布 reg 泄漏，也不足以证明其精确整个树已结算。** 官方同步 API 有返回前子进程关闭的契约；本轮实际 Bun 1.4.0 的返回可据此理解为同步调用完成。该 API 契约并不提供本轮 exact reg 身份、其 descendants 或包含 Job 的实证。Target Native settlement 不补足这一缺口。
5. 8 月架构债收敛已明确将 system-proxy/process-occurrence 平台探针置于 ProcessFacade 之下。不能把这个既有适配器边界当成新旁路或立即迁移 facade。可以在本地修复**诊断和启动结果契约的证据丢失**，但本次不是已经证明的 checker 语法/运行器故障，尚没有依据修 reg 的底层 timeout。不得靠 disable、增加 timeout 或屏蔽 warning 制造 clean。

## 原轮次完整输入与结果

根目录：`.tmp-codex-directory-target-01a133/dot-native-prepare-node/`。原 occurrence：`directory-target-dot-prepare-node-dc2d31af-ae0b-4bc2-955e-e122bc0abd59`。

| 原对象 | 持久事实 |
| --- | --- |
| Parent | PID 88764，birth `win32:639275173496851665` |
| Host | PID 82320，birth `win32:639275173505049918`，实际 Bun 1.4.0 |
| Target | PID 88796，birth `win32:639275173568449257`，实际 Node 25.7.0 inputs/target executable；ready targetBirthAtMs=1791920556844 |
| Host executable | `D:/myhexin-local/opencorvus/.tmp-codex-directory-target-01a133/ui-bundle/bin/bun.exe` |
| Target executable | `C:/Program Files/nodejs/node.exe` |
| Target argv | dot-mixed-qualifier.mjs `prepare --host node`；并未执行生产 CLI 或网络/provider 请求 |
| admitted | `2026-10-13T19:42:30.498Z` |
| original deadline | 1791920580498，原 30000ms；Target run 无活动输入 3000ms，printLogs=false |
| ready | `2026-10-13T19:42:36.880Z`，比原 admitted 晚 6382ms，距离原 deadline 尚 23618ms |
| Native settled | `2026-10-13T19:42:37.102Z`，原 Target reason=exited、exitCode=0、signal=null、runOutcome=returned |
| Parent joined | `2026-10-13T19:42:37.141Z`，admission 至 join 6643ms，Host code 0/signal null/parent errors=[] |
| 原 Target bytes | `evidence/native-host-stdout.bin`=76484B；`evidence/native-host-stderr.bin`=0B；原 ProcessRunResult complete=true |
| 原 Parent bytes | `stdout.bin`=76484B；`stderr.bin`=72B，即所列 bootstrap warning |
| 原 joins/publication | terminal/settled/outputSettled 三 fulfilled；stdout-file/stderr-file/stdout-parent-forward/stderr-parent-forward 四 fulfilled；physicalCompletion/outputDrainComplete/requestCleanupComplete=true，均针对原 Target handle |
| fixture | Target 最后一条 JSON Lines 原记录 completedCases=6，fixtureID=`df2ea0df-f134-4503-aea1-a2597ff25c9e`；runRoot 为已声明的新目录 `.../2026-10-14/directory-target-dot-mixed-01a133` |

原文件不可替换：`original-input.json`、`parent-joined.json`、`stdout.bin`、`stderr.bin`、`evidence/native-host-ready.json`、`evidence/native-host-settled.json`、`evidence/native-host-stdout.bin`、`evidence/native-host-stderr.bin`。stderr 本身没有单独 wall-clock timestamp，因此“reg 精确耗时 6 秒”不成立。源码顺序证明 warning 在 Target physical spawn 之前；6382ms 还包括 Host loading、后续 import、occurrence/Native helper/admission 等，不能都归到 reg。

原 inputs 只持久 environment **名字**。run-dot-native.mjs 代码只从 Parent 继承 PATH/SystemRoot/WINDIR/ComSpec/PATHEXT/语言这组 runtime 名称，并映射隔离 HOME/USERPROFILE/APPDATA/XDG 等目录；此次审核只读这些原名字和已声明目录，没有读当前值。原名单没有显式 proxy 变量，源码也没有复制它们；这是原 caller 投入事实，不是已经观察到 registry/代理值为空。Host 的 SystemProxy 恰可能补充 OS（Operating System，操作系统）代理环境，或如本轮查询失败而保持未投影；实际 registry 值始终未知。

## 真实控制流与错误保留边界

`native-host.ts:63–69`：先动态 import shims 并调用，再 import Filesystem、physical、ProcessFacade。`host=currentRuntimeProcessOccurrence()` 位于之后；run/handle/onSpawned/ready 又更晚（93–110）。因此 reg 是 Host 的 bootstrap 操作；此次 Node Target 的 qualifier imports 仅标准 fs/path/assert/crypto/url 和既审 native metadata reader，不安装生产 shims。

`runtime/shims.ts:13–22`：module-local installed 先置 true，之后应用 embedded env、declareNativeTaskProcessDeployment、cwd restore、process markers、SDK warning 静音、代理发现。declareNativeTaskProcessDeployment **只设置默认 native 字符串**（task-process-deployment.ts）；不创建 Job、scope、Task lease 或 reg owner。

`runtime/system-proxy.ts:19–24,240–249,278–282`：defaultExec 是同步 `execFileSync(file,args,{encoding:"utf8",stdio:["ignore","pipe","ignore"],timeout:2000})`；Windows 固定 args 为 `query` 和本地 HKCU Internet Settings；无 shell、无递归 /s、未指定实际 reg executable 绝对路径、cwd/env/windowsHide/maxBuffer/killSignal。其解析只在调用成功后运行，discover 抛出则 install 未走 apply。此次不能把 Windows parser/关键词匹配当作超时原因。

`runtime/shims.ts:15–17,68–78`：catch 只格式化 error.message 到 Host stderr，吞掉原对象的其它字段并继续；没有 status/result return，没有 owner receipt。plain warning 不进入随后 installProcessErrorLogging 的 uncaught/unhandled 路径，亦不形成 startup failed receipt。installed flag 不回退，之后重复调用直接 return，同进程不重试、不轮询 OS 更新；新 process 会再执行。这解释“bootstrap warning + 后续 success”，不是 Target error 被后态掩盖。

**stdout/stderr 三层不可混淆**：reg stdout 是读取 registry 用的私有缓冲，stderr 被 ignore；Host warning 是应用自己的 message；Target stderr 是 qualifier 子进程输出。本次 Host warning 已被 Parent 原样完整保存，Target 文件 0B 只证明 Target 那一层。不能为了补证把 reg stdout 直接全量写日志，内容可能包括私人代理/URL（Uniform Resource Locator，统一资源定位符）；任何后续诊断必须先设计脱敏/只保 identity、exit/cause 与 byte-length，而非保存值。

产品 `index.ts:1–3`、`overlay-server.ts:1–3` 在入口 body 调用 shims，middleware/Log.init/serve recovery 更后。它们还有静态 imports，ECMAScript 的静态依赖 evaluation 先于入口 body；不能凭“第1行”或注释宣布代理投影早于全图所有 client creation。本轮 Native Host 是明确动态顺序，当前证据可精确定位该路径；产品静态 import 图是否有提前网络副作用尚非本次实测结论。不要通过延后到首个 network request 创建第二份代理事实。

## 平台与官方 API 契约

- Windows 一次 reg 本地当前用户键；macOS 一次 scutil --proxy；GNOME 分别同步读四组 gsettings 后 join 文本；KDE 同步读六个键。任一查询抛出会停止整个 discovery，未成功产出完整 projection；顺序调用不是并发队列。其它 OS/未选 Linux desktop 返回 undefined。每命令 2s 不等价整个 bootstrap 2s，Linux 多命令之和、同步终止等待均可占更长时间。
- [Bun 1.4.0 的官方固定 child_process 源码](https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.0/src/js/node/child_process.ts)：execFileSync 调 spawnSync，后者调用 Bun.spawnSync，将 timeout/stdio/env/cwd 传入；原 `exitedDueToTimeout` 产生该 ETIMEDOUT message，checkExecSyncError 给 error 附上 ret 的 pid/status/signal/output 等。本项目只保存 message，丢失这些返回事实。这些源码关系支持错误层级判断，不能证明本轮 native底层实际 kill/整个树结果。上游源码不等于本轮 reg receipt。
- [Node 同步 child_process 官方契约](https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options)和 [Bun 对应 API 文档](https://bun.sh/reference/node/child_process/execFileSync)：同步调用阻塞事件循环，超时终止后仍等子进程关闭；不应把 timeout 当外层严格 wall-clock 上限。timeout/nonzero error 含底层返回资料。当前 Node 文档版本与本轮 Host Bun 不同，使用的是公共语义，未声称 Node 25.7 实测 reg。
- [Microsoft reg query](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/reg-query)：不带远端机器名时为本地查询，其正常返回码是 0 成功/1 失败。ETIMEDOUT 是宿主 subprocess error，不是该工具定义的 registry 失败码；不证明 key 缺失、access denied 或 invalid config。
- [Microsoft predefined keys](https://learn.microsoft.com/en-us/windows/win32/sysinfo/predefined-keys)：HKCU 映射基于 process/thread security context 的用户 hive。隔离 HOME/USERPROFILE/APPDATA 没有把 registry 切到 fixture。代码读取 Windows 当前用户配置是产品原行为；未来真实 probe 若访问它，必须单独明确授权/私人数据处理，不因目录隔离称其为虚构 test registry。

官方文档没有证实本輪进程延迟、reg binary 路径、PID/birth、同包含 Job、子孙数量或输出内容。这些全部保持未知。

## 全生产入口与共享机制横审

| 入口/生产者 | 代理发现与生命周期归属 | 当前影响/证据边界 |
| --- | --- | --- |
| dev CLI：package dev → src/index.ts | 一个同步 shim caller；run/task/mission/session/serve/acp/mcp/debug 等 command 共用 | 即便 attach 型 task/mission CLI 只发 HTTP，也先承担本机代理 discovery；原 warning 不设置 nonzero exit。未实测它们的此类 timeout |
| compiled CLI / overlay-server | launcher/overlay-launcher → binary-launcher → index/overlay-server；内部 work-artifact renderer/inspector 单独分支不加载产品入口 | 两普通产品 root 同一 shim；内部 renderer 不能仅因相同 binary 就算已执行 SystemProxy |
| Native foreground Host（本轮） | Native Host 显式 shim 在所有原 handle 前；Target独立 run 之后 | Host 已有 72B warning；本 Target完整 success。reg 没有 native request/ready/settled 关系，不能挂到 Target occurrence |
| direct Server/Session module consumer | server/server、session/loop 仅 import muteAISdkWarnings；SystemProxy 模块 declaration 不自动 execute install | 单纯 import Server/Session 不新增 discovery；caller是否显式准备shims须分别记录，不能以模块名字判断已投影 |
| SDK createOpenCorvusServer | SDK 本进程不装 shims；NodeProcess owned_tree spawn opencorvus serve，新 child 走产品入口 | 默认启动预算 5000ms、独立 framed receipt。bootstrap同步耗时占 startup预算；SDK失败路径 dispose+原 pipes/diagnostic tail。这里更强外层树owner与本轮 raw Parent→Host不同，不能互证 |
| Tauri 本地 sidecar | 后端 child compiled overlay-server 会装shims；原sidecar stdio在Log.init之前已进per-launchlog | Windows kill-on-close Job在child.spawn之后分配；Unix新processgroup。源码有早期diagnostic保留，实际reg出生时是否已被assigned Job未知，不能由Target证据推定。附着远端backend不创建本地shim child |
| server restart replacement | 当前process release/quiesce→supervisor spawn replacement executable，继承restart environment，新的entry重装 | 同process重试不重查OS；新successor重新discovery，仍需原replacement ready/failed/transfer；旧Task/Mission恢复receipt不成为regreceipt |
| Project bootstrap、Task/Session/Mission正常执行 | InstanceBootstrap绑定Task ingress、scheduler SessionWake/Task delivery、恢复/收敛；全仓无SystemProxy.install caller | 同进程共享已确定process env；不会因不同Project/队列并发重复装或修复失败。项目 `network.proxy` 保留其单一Config/instance transport owner，不与OS discovery混为同义producer |
| Task/Mission/Session恢复、周期wake、重试 | host-recovery、Project bootstrap、post-bind recovery沿现各scope的Task/Session/Mission lease/driver；无proxy重查 | warning发生在这些恢复进入之前，本轮没有这些业务请求/模型；不存在据当前证据将其归到共享恢复队列的理由。未来effect是继承同一个未投影环境，不能据此说模型请求必错 |
| native工具/Host/Task process capability | util/Process与supervisedFacade、Shell、rg、MCP、browser node、plugin commands等沿原adapter；Task native/Capsule scope仍当前合同 | 普通工具exec没有SystemProxy lookup；shell/native browser可继承host env；package-tool native精简env只SystemRoot、Capsulefiltered env是独立设计，不保证继承proxy，更不能把comment所有spawnedtools share proxy当实际全量合同 |
| package-tool / browser / artifact子host | Node worker source/script/require指定包，不调用应用shims；compiled artifact特殊分支前述 | 产品host自有proxy投影与子host能力环境分离，没找到第二OS proxy事实源；不可为本次补证给全部worker额外启动proxy |
| process-observation / native helper适配器 | process-occurrence Windows走FFI（Foreign Function Interface，外部函数接口），其它平台ps同步；ProcessSupervisor内部平台helper/编译/ps有自己的既有低层调用 | 说明不能用“原生subprocess未facade”泛判所有adapter。具体职责和读不到identity的error合同不同；本次不扩改这些已有适配器 |

重要历史界限：`specs/records/2026-08/2026-08-25-architecture-debt-remediation.md:1437` 在 ARC-024 收敛中明确 system-proxy/process-occurrence 等 probes 是 facade 下平台适配器；`specs/current/architecture/server-runtime-readiness.md:18–55` 定义 public ProcessFacade/Host/Task的argv/byte/deadline/inactivity及原terminal/output/request结算。当前 timeout 不能自动推翻历史适配器划分，亦不能据历史例外免除这次bootstrap错误的真实保留。

### 串并行、多项目、环境和恢复

同步 install 在一个进程一次执行，installed 在调用开始已true；它没有队列、waiter、worker pool、跨项目FIFO（First In First Out，先进先出）或lease。因此同process两调用无并行reg，后来调用也不会修复失败。不同新process各读同current-user源，可能同时query；本轮只有一个Host proxy查，无并发registry实证，不能以并发可能归因。

process env是该发现唯一写面；OS源优先补缺失，显式uppercase/lowercase proxy值保持权威。但 Windows/Mac discovery **先查询**，并未因显式env已有值就短路；不能通过灌显式proxy变量保证消除query，也不能伪造空/无效值躲probe。discover失败则apply不会运行；如果原env已有代理值，它们不会由catch删除。实际网络影响依赖外层输入/OS配置，当前未知。

不同Project现Config的network.proxy.llmProvider/webResearch由resolveNetworkProxy/proxiedFetchInit管理；Node transport的dispatcher由instance-state owner按scope回收，Bunexplicitproxy沿当前transport。OS环境一份按process，不因Instance切换重装。重启的新process不是同一个installed boolean；恢复仅消费新process环境，与durableTask/Mission/Session occurrence保持原分界。禁止据此额外建每Project代理缓存、自动重试队列或影子fallback。

### 普通与受控终态

defaultExec只有库内部同步timeout，无外部AbortSignal、绝对deadline、onSpawned、treepolicy、publicterminalreason、原outputSettled/requestcleanup promise。正常命令成功只返回stdout用于parser；nonzero/timeout抛出后shimswarning并继续。缺少managedcaller result不证明底层没有收wait/kill。

本轮原 30000ms deadline在Parent投入，Host先检查未来输入，**ProcessFacade的controls直到shim之后run/spawn才建立**；原3000ms inactivity在Target handle投入后观察其bytes，不观察Host bootstrap。同步事件循环时Host里的异步abort/timer不能及时推进；父级原进程owner若有独立杀树能力是另一authority。本run-dot-native Parent代码只rawspawn/collect/close，没有外层deadline/inactivity driver，不能拿尚未开始的Target timer宣称bootstrap已有3s活动保护。

ProcessSupervisor.liveHandles只登记该supervisor创建的handles；Task mandatory/auxiliary settlement和runtime/recovery会处理这些登记对象，reg defaultExec未进入表。recoverOrphanedWindowsRequests也只读取原managedrequests；没有本轮regrequest。正常Server shutdown/Session cancel/Task cancel是后续owner路径，不存在可按reg未知PID重建的receipt。外部SDK/Tauri已有ownedtree/Job可能物理覆盖应用早期child，属于各启动事实，必须独立核；本轮不是它们。

如果日后用成熟facade承载bootstrap探针，应保持deadline_exceeded/inactivity_timeout/exited/nonzero原reason、bytes（脱敏边界）和cleanupcause，不将物理settled改成exit0。本次Target ordinaryexit0已经真实完整，但scope只覆盖Target，不改写Parent72B或宣称注册表查询成功。

## 测试、工具链与信息不足

当前全仓没有找到SystemProxy discover/parseWindowsRegistry等独立聚焦测试引用；test/task-process-deployment-bootstrap.test.ts 真子进程调用shims，却只验native/capsule配置stdout+exit0（非zero才汇stderr），不会把warning保为测试失败；它不是proxy行为验收。本次未运行/修改该测试。network-proxy-fetch-init/credentials等测试服务现explicittransport，没有OS读取资格，不能代替此probe。测试preload独立runtime的隔离目录也不改变HKCU。

工具已经真实完成 sixfixtures、类型资格后才出现本审计，没有证据说明standalone qualifier或Native run wrapper本身坏。最小“本地可修”事实是shims错误资料丢失、warning状态不进入可审查bootstrap结果，和caller对qualification文字过宽可能误读为所有Hostchildren已受一条handle覆盖；但原receipt明确authority就是Target，不可覆写原输入文字或补造第二条regreceipt。

未满足的资料：reg实际PID/birth、完整error status/signal、stdoutbyte长度/私有内容边界、executablephysicalpath、进入/离开时间、whole-treephysicalclosure、真实securitycontext、宿主原sync底层返回事实和包含Job。没有足够证据排除Bun宿主问题或宿主环境慢执行，亦没有证据肯定其中任何一个。原72B warning不可反解析出这些对象。SDK/Tauri/readiness风险为源码影响分析，未新增真实资格，须按此标注。

只读工具输出注意：第一次PowerShell把ConvertFrom-Json自动转换的DateTime再字符串parse，输出将毫秒截断，还试将Target JSON Lines当一个JSON而报Additional text；这些派生值**不采用**。重读原bytes并用`ConvertFrom-Json -DateKind String`，逐line解析，所得6382/6643/23618ms和completedCases=6才是此报告计算。原生产文件从未修改。若目录/文件search的不存在路径产生rg exit1/2，它们也是读工具错误，不构成产品negative proof；本报告以已读确切路径和全仓matching结果为准。

## 安全的下一步及修复范围建议（尚未授权执行）

1. 本轮可继续已审的纯文件32项，只将其合格对象限定为真实fixture、文件观察及原Target Native owner；保留Host bootstrap warning为独立未关闭项。没有网络/provider/模型依赖，所以不必为了这项未知重开、停掉或扩载文件轮次。不能写“全部共享启动无错误”或改原terminationreason。
2. Root若要另批定位proxy，先落正式bootstrap结果/平台适配器规格，完整审读一个有限新checker，再另授执行。优先用**已有的同期原process诊断**（若Root持有）补exactreg事实；本次不存在可以通过当前用户进程追踪可靠补回过去birth的动作。禁止据当前PID扫描、后来reg探针或成功重跑把本轮标green。
3. 正向资格最小输入须明确新owner、真实Host/runtime、platform、原deadline/stdio/maxbytes、current-user读取授权/输出脱敏、成功projection或精确failure合同；原command需要actualexecutable/argv/parentPID+birth、probePID+birth和主因/cleanupcause。retain首failure；正常/超时/取消各有实际terminal与outputclosure，不复用本次receipt、不冻结流、不注observerhook、不假设只是2s太短。不得保存actualproxy地址/用户名/密码/PAC值到report。
4. 最小产品方向需在两入口与所有显式shimcaller保持**一个bootstrap事实源**，每次process得到“OS discovery成功/无可用projection/明确失败”之一；失败与无需代理不是同义值。原installed-once对新async方案应转成真实同一次owner Promise/结果（若改变API，删除旧sync调用源），并在clients/children需要它之前显式await，不建立每request或每Project重试队列。
5. 若正式目标扩到owned子进程，优先既有runtime-neutral `packages/util` NodeProcess/ProcessFacade适配层，而非给Host脚本单独写kill树；但它是异步API，Windows owned_tree需要原nativehelper，opencorvus supervisedFacade又按首次spawn动态import带Global/Config/Task binding的ProcessSupervisor。不能在现同步shims里硬塞它或制造bootstrap循环。需先核cold-start/packagedhelper可用性与所有entry调用次序；平台probe既有例外可以保留同步读取契约并改明确信息保留，**没有依据在本次直接选迁移**。
6. 若改Windows源为成熟registry/nativeAPI以避免subprocess，先核与当前ProxyEnable/ProxyServer/ProxyOverride/AutoConfigURL、HKCU视图和当前用户语义是否同义，POSIX（Portable Operating System Interface，可移植操作系统接口）仍现OS分支；现仓无matureregistryreader搜索命中。Tauri/Rust上游依赖不等于TypeScript/Node/Bun已有可直接复用primitive。不能用另一个OS来源与reg双读fallback，不能把首个超时当选择实现的充分依据。

目前建议先由Root将**Host bootstrap discovery failure的原facts和未恢复信息**落正式记录，与Files后端基础修复分开收敛；无需重开本轮实例。尚未实现任何proxy修复，未做真实proxy测试、网络/模型端到端验收或进程实验。本报告只完成规定的源码/原事实横审。
