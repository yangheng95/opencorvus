# 文件发布效果与回执恢复

## Recall

- 用户要求：横向审计持久投递中“效果已发生但缺成功回执”，覆盖删除重建、重启、并发和升级；真实故障注入，先分析再修复，独立子 agent 裁定，直到有界范围没有新明确缺陷。
- 主方案：[持久投递审计](2026-10-24-durable-effect-receipt-audit.md)。本委托负责 Worktree readiness、Skill catalog replacement、MCP 配置及 Expert Squad 文件 publication；不再次委托，不修改索引、数据库迁移或 Git 提交。主 agent 汇总、提交、推送及独立裁定。
- 已读：AGENTS.md、主方案 Recall、02-data、04-extensions、Worktree create/readiness/ownership/Git lock、Project DirectoryAdmission 的物理 occurrence、Skill manager/replacement publication、DurablePublicationStore、Config mutation authority、MCP configure/auth、Expert Squad manager/registry/install lock，以及相应后端测试与进程 fixture。
- 全仓搜索：DurablePublicationStore 所有生产使用者；WorktreeReadiness 的 begin/resume/markCreated/markPopulated/commitReady/forget；Worktree.create 的 Build、Workspace、Automation、Orchestrator、HTTP 调用点及 Info/Event schema；Config 所有全局写入的 catalog owner；MCP staged credential/Project generation；Expert Squad receipt 与 journal 清理生命周期。
- 初始工作区的 171 项无关删除、577 索引条目、主 agent 本轮改动全部保留。仅在 `.tmp-product-iteration/durable-effect-receipt-audit/publication/` 创建自有隔离 probe，未使用真实凭据或模型、未发网络请求、未操作现用服务/窗口、未运行 UI 自动化。
- 原始证据：`full-red-results.json` / `full-red-probe.log` 是正确 canonical `opencorvus.jsonc` 的全红例；`worktree-red-results.json` 是有效相对路径启动命令红例；`concurrent-recreated-results.json` 是并发及真实 Git 物理重建；`old-publication-runtime.json` 与 `old-publication-process-copy/` 保留未恢复的旧 v6 数据库、journal 与 worktree 原件。初次带引号 Windows 命令及误写 `.json` 的运行失败另留 `initial-command-failure-*`，不作为成功副作用或合法配置编辑验收。
- 后续状态说明：本记录早先 21-case/current 8 的通过属于当时矩阵。随后完整 algorithm 实证发现首次 Task-scoped 父目录被 comparison key 改成小写的生产回归，独立 judge 暂撤该分区通过；当前根修、扩展矩阵、旧合法 marker 升级和重新裁定以末尾新增记录为准，不用历史绿色覆盖新红例。

## 深度分析与已证问题

1. **已完成 population 被重放。** 正式 Worktree.create 在启动脚本产生一行真实文件效果、phase 2 `populated` 已持久后，于 Store `terminal-temp-synced` 切点退出 23。新进程正式 reuseIfValid 返回成功，同一个 occurrence 最终 committed，但效果文件从一行变两行，切点后的 tracked 用户编辑被 `reset --hard` 恢复成 Git 原文。直接触发是 isReady 只读 terminal；resume 返回旧 ID 后调用者无条件重复 populate，未消费已有 populated 事实。旧测试只验证裸 no-checkout 与正常 READY，未命中已完成效果缺回执。
2. **真实重建被旧路径回执冒认。** 已完成 worktree 经真实 `git worktree remove --force` 删除，再同路径 `git worktree add --no-checkout`。Git linkage 有效，Worktree.create reuse 返回成功，tracked 文件仍缺失、启动效果零次。receipt 只绑定 path 摘要，无物理 directory occurrence、Project generation 或数据库 authority。路径复用不能证明同一资源。
3. **并发 live owner 重复效果。** 第一个正式 create 在 populated phase 持久后保持存活；第二进程 reuse 在第一 owner 释放前已产生第二行启动效果。释放后 first 成功、second 因 terminal 时间不同报 immutable 内容冲突。Store 锁只包单个事实写，Project Git 锁只包 Git 注册；整个 create/resume→population→terminal 未由同一跨进程 subject 准入拥有。process-local ownership acquisition 不串行跨进程 population。
4. **明确启动失败仍写 READY。** 正式 extra startCommand `exit /b 17` 产生真实失败日志，Worktree.create 返回成功并 committed。runStartScripts 忽略 extra runStartScript 的 false，旧测试甚至把此行为标成 fire-and-forget；这是错误的公共契约，须同步更新测试与文档。
5. **无关配置编辑永久堵塞 Skill 恢复。** 正式 SkillManager.importFile（configuration.kind=none）在 configured phase 后退出 23。停止态用户只给 canonical jsonc 新增 username，新的 SkillManager.installed 报 configured revision no longer matches its effect，旧 occurrence 仍 open。整个可变配置摘要被误作 Skill 真实 effect 身份；正常 Config API 已先取得 catalog owner 并恢复，故不能把普通 MCP 并发写入当成此红例。此例是合法直接文件编辑，不是 malformed 配置。
6. **MCP 将已提交配置失败误当未提交，删除唯一恢复 stage。** `mcp-red-results.json` 使用正式 MCP.configure、disabled remote（不连接网络）及人工合成无效值。Config 原有 beforeProjectRuntimeSettlement 在实际 jsonc persist 后抛错；真实 definition 已落盘，catch 却删除 stage，立即及新进程 MCP.status 均是 hasStaged=false/hasActive=false。第二层根因是 Config.onWritten 中 reset 与该切点位于成熟 ProjectConfigCommittedReconcileError 包装之外，实际错误是 plain Error。旧测试只模拟 precommit rejection，没有证明真实 postpersist 边界。合成值未输出；不把旧代码已经删失的真实 secret 说成可重建。
7. **并发 MCP 配置彼此销毁在途 stage，成功返回却无可用凭据。** `mcp-concurrent-results.json`：预热 B 后，A 在实际 definition persist 后保持 owner，B 成功写入自己的 stage 后等待 Config owner。A 的 reconcile 把身份不同的 B stage 当作废弃数据清除；两者之后 configure 均无错误返回，新进程当前 header definition 有效但 hasActive=false。同一 auth store 的单个写锁不等于完整业务 occurrence 所有权。现有 withRuntimeControl 仅进程内排队，stage 在跨进程 Config owner 之外。跨 server 的 orphan/stale cleanup 同样共享该缺口，不能只为同名 server 加新锁。
8. **物理路径有效不证明返回的 Git branch 身份。** isValid 只核 directory 在 worktree list；create reuse 与 recoverRecorded 原先直接返回 caller 希望的 branch，用户实际改名或重建为别的 branch 时会形成错误返回/回执。应复用现有真实 registered-worktree reader 精确核对 branch，既有资源原样保留，输入映射明确 CreateFailedError 或 unrecoverable 结果，不冒认/切换分支。验收使用真实 Git branch -m，检查保留内容与准确错误身份。
9. **独立裁定发现首版 MCP cold-init 反向锁序。** judge 的 `automation/mcp-lock-boundary.log` 经真实 API 与原 Lock.read 精确观测确认：Config writer 已持 mutation owner，独立 MCP.status 先拿 generation read 再等该 owner，writer 又等 generation write，双方不结算。warm backend 的并发通过不能排除此窗口。修复必须将整个 MCP state 入门改为 owner→generation read→冷初始化；已有 owner context 重入，不在 generation read 内再申请其前置 owner。
   经同一 judge 复核，MCP read 入门只需共享现有最外层 durable catalog owner；不用把读操作提升为两个 reference write。state 在 generation read 前调用 SkillManager.withCatalogMutationOwner 完成恢复/准入，configure 的完整写操作继续 Config.withMutationOwner。它们共享同一个跨进程 owner，真实 reference-read scope 可按原 context 重入。
10. **reset 成功效果缺回执阻断整个 Project 重启。** `reset-red-results.json` / `reset-red.log` 保留正式 create→reset startup 后硬退出 23 的原件；旧 reset 只有冻结 target 的 reclamation admission，没有 checkout/startup/populated/terminal。新进程在 Project.fromDirectory 注册 primary 时被其子目录遗留 reclamation 拒绝，甚至不能读恢复事实；在存活 Instance 中重试又会重做 reset、sweep 与启动脚本。旧 creation READY 不能证明本次 reset 成功。影响整个共享目录准入，不能只改 HTTP caller 吞错。

### reset 补充方案（实施前）

- reset 使用同一 WorktreeReadiness subject owner、物理 occurrence、数据库 authority 和 Project generation；当前 v3 新 reset occurrence 显式引用被取代的唯一历史 leaf，记录 exact reset operation 与 admission generation。依次持久 created、checked_out、startup_started、populated、terminal；不得借 creation 的 populated 解释 reset。
- Project.fromDirectory 在身份候选发现后、注册 admission 前恢复属于同 Project 且重叠的已死亡 reset。完整 exact owner 的 populated 只补当前 terminal；其余缺 phase、已 checkout、startup_started 和旧无 generation admission，保全原件为 startup_outcome_unknown，不重放未知脚本。新保全 occurrence 明确标明 historical_unknown，不伪称过去 reset 属于新 generation 或成功。
- 复用 DirectoryAdmission 原始 exact row（directory key/path、generation、operation、kind、owner PID/process instance/OS occurrence）；仅当真实 OS（Operating System，操作系统）观察为 dead_or_reused 且事务中精确复核相等，才可在域 terminal 落盘之后结算旧 fence。exact_live/unknown_live 以及其他 admission kind 不处理。目录已删除或 symlink replacement 时只记录旧资源退休，原 journal 保留，不触碰替代目录。
- 公共 reset 的未知结果使用现有 WorktreeStartupOutcomeUnknownError，HTTP（Hypertext Transfer Protocol，超文本传输协议）409 公开 directory/recovery；Project 仍能打开和读取。正常 reset Boolean success 保留。重试与新的显式 reset 的同目标歧义另核公开请求身份，不用时间猜测或永久短路所有后续 reset。
- 全仓生产 caller 仅 experimental route，没有实际 UI reset caller。主 agent 裁定公开 ResetInput 必填 `operationID`：同 ID 只能恢复其原 physical/baseRef occurrence，不同显式 ID 才能开始新的 reset；服务端不能默认生成 ID 冒充安全重试。既有 algorithm-batch-one 后端约七处调用同步迁移，OpenAPI（Open Application Programming Interface，开放应用编程接口）和 generated SDK（Software Development Kit，软件开发工具包）由主 agent 统一生成。旧无 ID 的持久 admission 仅作 historical_unknown 原件解释，不保留旧无 ID 调用实现。
- 已全仓读取 DirectoryAdmission 的 registration、reclamation、promotion_restore/publish/workspace 入口、settle、process occurrence；仅 reset 能解释其 own operation namespace，其余保留各自域 authority。独立 judge 要求 populated 匹配 exact reset/physical/DB/generation，历史引用唯一 leaf、旧无 generation 保全，已纳入本方案。

### alias 请求身份的后续真实红例与根修

首版十二个原件/重启/并发/普通删除重建/junction 退休/HTTP 409 case 全绿后，root 要求继续核同请求 path 改指。新增 `reset-request-alias-red.log` 正式生产调用证明：A 的 reset 已产生效果、退出后，将 A 原 path junction 改指真正独立 managed Worktree B；原 path+同 operationID 重试被重新 canonicalize 到 B 的 kind。请求返回成功，真实效果计数 3→4，B 的 operator bytes 变为 Git 原文。目录普通替换“只退休原 fence”的绿例不能证明这次重试安全。

根因是 request 的稳定 logical identity 和资源的 canonical identity 共用 namespace。只把 kind 改为 raw path 会让 alias 下新 unknown 与 registered path 下旧 READY 分裂。未发布的新格式因此统一改为稳定 Project ID + DB authority 的单一 journal scope，intent 同时冻结原 Project generation、logical requested directory 和 canonical physical occurrence；request 按 logical path+operationID 解析，current resource 按 exact physical occurrence、当前 generation 和显式历史引用解析。独立 judge 又指出 scope 不能含“当前 generation”，否则删除重建会丢原请求 lookup，已纳入设计：同 Project 历史 generation 可读，旧请求在新 generation 返回明确保全错误，新显式 ID 才开始新操作。所有 alias 使用 constant shared lock kind + canonical resource subject，仍复用同一 Store，不加平行 request index/current 状态。v1 及本次实验 v2 原件仅保留为历史引用。

Store 在原 list 增加 immutable intent predicate，先校验原 intent/path identity，再只读匹配资源的 phases/terminal；损坏 intent 不吞掉、不当无匹配。每次仍扫描当前 Project scope 各历史 generation 的 intent 数量，不声称 constant bounded；别的 Project/DB scope 不读取。验收补同 Project 历史规模的真实耗时与实际读取次数，记录 O(当前 Project intent 数) 边界，不能用测试夹具小规模通过掩盖该限制。

### 独立末审新增 entry alias 红例与同 owner 根修

独立 judge 指出首次新 reset 的路径仍可能在“已捕获 canonical subject→真正进入 callback”间改指，不同于已修的同 ID retry lookup。`reset-entry-alias-red.log` 已用成熟 Store `subject-queued` 切点真实复现：初始 junction 指向 A，捕获 owner A 后改指另一真实 managed Worktree B，首次请求成功返回、效果 2→3、B operator bytes 被 reset 为 Git 原文。原因是 withOwner 丢弃其捕获的 key，callback 自行重读 path 并在 begin 内嵌套 owner B。

根修沿同一个成熟 owner：withOwner 将捕获的 directoryKey 显式传 callback；reset 的 canonical/Ownership/physical 观察必须等于该 key，acquire 使用 expectedDirectoryKey，begin 使用同捕获值，markCreated 继续精确 physical 复核。create/reuse 同样把捕获 key 贯穿 resume/begin，不允许共享 primitive 的同窗口变成新的 resource owner。改变路径得到对应 typed reset/create error，保留新资源，不新增锁层、流程 gate 或平行 journal。

原红与相关同请求/并发/已完成 create 的聚焦 `reset-entry-owner-fixed.log` 为 4 pass / 8 assertions；横向共享 create/reuse 同入口换指 `create-entry-owner-fixed.log` 为 1 pass，映射 WorktreeCreateFailedError、真实 B bytes 和两次已发生效果保留。生产源在此修复后冻结；最终 `entry-owner-typecheck.log` 已完成 exit 0，`git diff --check` 通过。

独立 judge 再核 actual effect cwd 后要求补最后 observation→spawn 的窗口。`reset-late-alias-red.log` 包裹原 ownsCurrentOccurrence（完整调用原方法，仅在第二次 positive 返回之后实际改 junction），已证效果仍使用 raw Git registry entry.path：B 用户字节被 reset，A-original 用户字节未变，实际 afterResetHard 观测 cwd=raw alias，接口却成功。此前入口 key freeze 不能替代真实效果目标冻结。

同一根修的最终落实：reset plan 返回 canonical(entry.path)，Git reset/clean/gitlinks/startup 全部只消费该 frozen physical path；v3 intent.directory 也是 captured canonical physical directory，requestedDirectory 独立保留原 logical request，create checkout/startup 从同 receipt 的 physical directory 执行。bootstrap 观察原 source.directoryKey 的 physical occurrence，不把 raw alias 改指误当原 A 消失或拿 B 补过去成功。没有新增 state/lock/format authority，也不依靠反复 precheck 教模型流程。

`frozen-effect-fixed.log` 五个聚焦原红/完成/并发合同 5 pass / 13 assertions；`frozen-effect-late-recovery.log` 进一步真实执行 late alias 改指、原 A 完成效果后 exit 23、新进程恢复，3 assertions 通过：A 原编辑保留并只补 terminal、B 字节保留、效果三次（两个 setup 加这一次 reset）、原 fence 结算，直接读 A 的当前 physical receipt READY=true。`frozen-effect-typecheck.log` 已完成 exit 0；其后独立 judge 发现以下同根首次 create 遗漏。

### 首次 Git create 的物理目标遗漏（实施前）

独立 judge 发现 checkout/startup 已读冻结 directory，但第一次 `git worktree add` 仍使用 raw `info.directory`。`create-physical-parent-red-evidence.log` 用正式 Worktree.create，在成熟 Store `occurrence-published` 后真实将 parent junction 从 A 改指 B；A 的 child 缺失，B 的 child 实际出现 `.git`，调用最后 AggregateError，rollback 还留下 Git diagnostics。这证明最终错误不能消除错误资源上的既成效果。原 entry guard 与 reset late-window 绿例未覆盖首次 add 的 raw 参数，因此旧路径未根治。

影响面全仓核 create 的 reclaim、process ownership acquisition、Git add/checkout/startup、Project.addSandbox、Ownership.Worktree.record、失败 converge、公共 Info 与 readiness resume。同一个捕获的 resourceOwner.directoryKey 必须用于所有实际 effect、cleanup 和返回目录；logical intended directory 只保留作 request identity、诊断和精确旧 v1 journal lookup。Readiness.resume 第一次 observe 后的 current lookup 同样消费 frozen key，避免再次解析 logical alias 换资源。begin 仍接原 logical 请求，但它已把 intent.directory 固定为 physical key，不新增事实源/锁/格式。公共 Info.directory 将明确返回实际物理目标，原字面大小写/junction 不作为资源身份；相关正常 caller/Workspace 合同一并复验。验收用原红的实际 A checkout 与单次 startup、B operator bytes、返回 Info 物理路径及首次 Git metadata，并补 completed/recreated/reuse/并发合同。此轮无数据迁移或 UI 改动。

`create-physical-parent-fixed.log` 当前 7 pass / 16 assertions：同一个正式切点，A child 实际含 `.git`、`effects.txt`、`tracked.txt`，Info 返回 A physical key、startup 一次、B operator bytes 保留；同物理 alias、completed receipt、新物理重建、两 live backend、未知启动与 branch 身份同轮通过。`create-physical-readiness-contract.log` 3 pass / 5 assertions；旧 Windows 字面目录大小写断言按当前物理 key 契约替换。`create-physical-typecheck.log` exit 0。此前全套 `worktree-all-final.log` 20 pass / 54 assertions（不含随后新增的首次 Git case）；后续最终当前 21 case 与最新迁移版重跑由 root 统筹。

`create-physical-callers.log` 的 Workspace 失败原因为 root 开发新 Expert schema 时尚未同步迁移 registry：`missing schema object index:expert_squad_mutation_receipt_task_idx`，之后 cleanup EBUSY 与 child barrier timeout 是该冷 opener 失败的派生症状。root 已撤下未同步 hunk 并确认 target 7 checker 通过；本 agent 仅精确核 PID/parent/cmd 后结束自己使用旧 schema module 的 worker 96928，用全新 runner 重跑。原失败保留，不能当作 Worktree 产品效果错误或成功验收。

全新 runner 的 `create-physical-workspace-fixed.log` 三项正式 Workspace pre-row、两 backend 与 post-prune 恢复 3 pass / 6 assertions；`create-physical-workspace-recreate.log` 正式 Project deletion→同 path 新物理 occurrence 1 pass / 5 assertions，均已完成 exit 0，证明公共 physical Info 变化未破坏这些成熟使用者契约。

## 方案与公共合同

- Worktree 的同一个物理目录 subject 应贯穿读取当前 readiness、决定恢复、Git population、启动脚本、phase 与 terminal；事实 Store 仍是唯一 journal，不添加另一份 processed 状态。复用成熟物理 canonical directory key/occurrence，冻结 database authority 与 Project generation。历史 journal 原样保留，版本化新 occurrence 必须明确引用原证据；不得通过删除旧 record 或只报错阻止升级收敛。
- 当前使用稳定 DB authority + Project ID 的 scoped kind（见 alias 原红根修）；历史 v1 及实验 v2 按原精确 path/canonical scope 读取作为原证据，不对其他 Project 的 journal 做全 kind 扫描。初版 canonical scope 已被真实 alias 红例取代，不保留为当前 authority。
- 完整 `populated` 且物理 occurrence 匹配时只写当前恢复 terminal，保留全部现有文件，不 reset、重跑启动脚本或补造过去成功时间。新资源不能继承旧 READY。恢复检查必须读取真实 Git registration 和资源身份。
- 启动过程开始而成功未知的真实窗口不能自动重放任意外部命令。保全现有 checkout 和原始 evidence，公开 `startup_outcome_unknown`，使调用者取得真实可用的保全结果与诊断；不能假称完整 READY，也不能仅抛错使整个升级/打开失败。尚未开始的安全 checkout 与真正完成的 population 分开记录，避免物理注册等于 readiness。最终返回字段与所有调用者处理由主 agent 核对后落地。
- extra startup 明确失败应映射 StartCommandFailedError，并沿已有失败创建清理收敛；重试属于新的真实 creation occurrence，不能写成功回执掩盖失败。
- Skill 的配置恢复按精确 effect 的受影响字段判断，已落盘 configured phase 是本次效果发生过的原始事实。无关字段编辑保留；用户后来改变受影响字段时，不得重新 apply 旧配置覆盖用户。目录按已有精确 before/after tree 身份保全与收敛，terminal 可记录当前处理完成及被后续编辑取代，不伪称旧配置当前仍生效。
- Config.writeProjectPatch.onWritten 的整个 postpersist 范围统一按已有 ProjectConfigCommittedReconcileError 携带真实已提交 candidate，保留原 typed error 及原始 causes。MCP.configure 仅在该 typed committed error 且其 exact requested definition identity 相等时恢复 stage promotion，仍向调用者抛原 settlement 错误；真实 precommit failure 继续移交 stage。硬退出窗口在新进程由现有 startup staged settlement 读取原 stage 恢复，不增加第二份凭据状态。旧代码已实际删失且无原 stage 的 secret 无法猜补，定义与诊断保留，需显式新 credential 输入；不得伪造或访问用户凭据掩盖。
- 从 Config 当前唯一 mutation authority 抽出已有 outer owner（durable catalog owner、Skill/conversation 引用锁），Config generation 写继续只在实际 Config writer 内进入。MCP.configure 的 stage→definition→promotion 和 startup staged settlement 使用这个同一 owner，后者在持有 owner 后重读实际 definition；不新建 MCP 锁、journal、凭据副本或第二套配置 authority。普通 Config 写的 cleanup 因此不能删除另一个尚在途的 MCP stage。新旧真实并发必须以两个预热后端重跑，不能依赖首次 state 初始化意外串行来证明安全。
- 初始核查已排除 Expert Squad 普通 Task.delete（tombstone）必然丢 Artifact receipt 的假设；后续物理 Project 删除与 global journal 的真实红例及当前公共 Store 保全实现，见本记录末尾及 [Expert 独立审计记录](2026-10-24-expert-global-receipt-lifetime-audit.md)，不以 FK 声明替代实证。

## 验收计划

1. 聚焦后端正向契约覆盖完整 population 缺 terminal、不同物理资源、两真实进程同时复用、明确 startup 失败、新创建继续可用，以及 Task/Project generation 及多项目隔离。
2. 用上述未恢复的旧正式原件在新进程进入正式 Worktree.create/SkillManager.installed；逐真实 file bytes、原 journal facts、原表/行及原备份核保留，不能用可变源码摘要作为验收。
3. 真实 fault cuts 分别覆盖 checkout、startup admission、populated、terminal。对未知效果公开保全诊断；已证完成只补 receipt。跨进程竞争应由同一整个 subject 准入串行，不用测试重试藏掉重复真实效果。
4. 当前 runner 只执行相关后端文件；源类型检查、相关 package checker 和 docs 检查由主 agent 统一执行。没有 UI 改动，不运行 UI 自动化。
5. 每个新增明确红例先补本记录，再根修并重跑；独立 judge 从原件、日志和当前代码裁定，不以实施者自述通过。

## 当前实施与真实验收记录

- Worktree 当前 v3 单一 journal 实施在 `worktree/readiness.ts`，`create/reset` 使用跨进程整个 canonical subject owner；物理资源、DB authority、Project generation、冻结 startup、reset request 与原准入在 immutable intent 中关联。`forget` 删除旧记录的路径已移除，旧原件保留；原始创建与 reset 的公共未知结果分开于完整 READY。
- Skill replacement 当前只核精确配置 effect 范围，保留合法无关编辑；已被用户改掉的 effect 以 superseded 收敛。旧无 beforeScope 且未证配置效果的历史按 unknown_preserved 保全，不靠新的全 config 摘要阻止升级。
- Config 所有 onWritten postpersist 范围统一已有 committed error；MCP 的 stage→definition→promotion 与 startup settlement 共享原 Catalog/Config authority；冷 read 先 Catalog owner 后 generation read，独立 judge 已真实反证和复验。
- `project-scope-final-cases.log`：16 pass / 47 assertions，正式 APIs 覆盖 created/populated/startup hard cuts、新进程恢复、并发、物理删除重建、junction 退役、原请求 path 改指、Project 正式删除重建、aliases 共享 current unknown、其他 Project 坏 intent 隔离及 HTTP 409。其后增加的双 cold recoverer/明确两 generation 计数在 `reset-final-cold-generation.log` 2 pass / 12 assertions。
- `intent-filter-regression.log`：intent selection 2 pass、原 Store 11 pass、真实多进程 Skill replacement 3 pass。`publication-final-contracts.log`：MCP committed configure 3 pass、cold Config generation 2 pass、Skill scope 4 pass。`reset-algorithm-all-contracts.log`：既有 reset ownership/physical replacement/immutable target 四合同通过。
- `old-upgrade-project-scope.log` / `old-upgrade-results.json`：真实未恢复 v6 Worktree 与 Skill 两份原件经正式 opener 自动到 v7；各 90 个旧表、4 条旧业务行全部保留，迁移原备份旧行精确一致。额外新 authority 行是当前开户真实事实，不以“整表必须完全等于旧表”误判升级。Worktree 原 effect 一次与 tracked 用户字节原样保留，原 v1 journal 未改写，当前 v3 显式 unknown 保全；Skill 原 configured facts 与合法 username 编辑保留并结算。两组再开稳定。
- 上一条 v7 是保留的中间历史。当前 schema 8 完整同步后，`old-upgrade-current-v8.log` / 当前 `old-upgrade-results.json` 从同只读 pristine v6 master 新复制，两份各正式 6→8、90 旧表/4 原业务行保留、迁移 backup 精确、冷重复恢复稳定。旧 reset 私有 master 的真实版本为 7（本轮中间版本下原 hard-cut 产生），`reset-original-upgrade-v8.log` / `reset-original-upgrade-current-results.json` 从只读 master 新复制正式 7→8，6 原业务行与 backup 保留、原 effect/用户字节不变、admission 原 owner 全字段保全、unknown_preserved/fence 0、两次冷读稳定；没有 SQL 改 version 或原 master。精确原库/目标库/backup 私有路径在 `publication-current-v8-manifest.json` 供独立 judge 读验，私有 DB 不提交。
- 独立 judge 已核 Worktree/Skill 的 90 表/4 原行及 rowid、backup 的原 schema/rows/version 精确。另指出 reset 的恢复终态会合法结算原 fence，不能用恢复后的 live DB 声称迁移阶段原 fence 尚在。已从同只读 master 再新复制正式 opener，任何恢复前在 readonly BEGIN 内 serialize 出完整 `opencorvus.migration-stage.sqlite`，再正式恢复两轮；报告和 manifest 分开 migrationStage（6 原行、原 fence 1→1、backup 精确）与 recoveryStage（fence 0、immutable readiness intent 保留原 admission 全字段、原字节/effect 保留、unknown）。完整 SQLite 原件供独立 rowid 复核，公开 artifact 不含私有 DB。
- 独立 judge 随后已实核 reset migration-stage：7→8、91 旧表/6 原行含 rowid 逐列完整，原 fence 1；正式 backup 的全部原 schema/旧行/rowid/version 7 精确相等。当前三组升级证据独立裁定通过，完整当前 Worktree 21-case 结算另列，不能以升级通过替代它。
- 当前 8 的 `workspace-v8-final.log` 四个正式 caller 合同 4 pass / 11 assertions。第一次完整 21-case `worktree-v8-all-final.log` 20 pass / 1 fail；唯一 create-entry 的第二 setup child 空 stdout，被旧 checker 的二次 TypeError 遮住原 stderr，不能据此断言产品根因。已修 checker 直接保留异常 exit/stderr，待 root 全部 source freeze 后用 fresh runner 完整复验。此前 20-case 通过不替代当前 21-case 要求。
- 当前 8 最终 fresh runner `worktree-v8-final-frozen.log` 已完成 21 pass / 0 fail / 56 assertions，runner exit 0、201.62 秒，覆盖首次 Git、late alias、原件硬切/冷恢复、跨 generation、删除重建、并发、另一 Project 坏 intent 隔离与 typed HTTP 恢复。此前空 stdout setup 对应单项在 `worktree-v8-create-entry-diagnostic.log` 及本次完整轮都明确通过；保留原失败原件与 checker 修复，不能用“偶发”或新绿例替过去缺失的 stderr 发明根因。独立 judge 根据最终源、原件和完整 runner 另行裁定。
- 独立 judge 最终分区裁定：有界矩阵通过。其读取当前 source，实核 create 的 physical Info 从首 Git 到 effect/cleanup/public Info、reset canonical plan 到 Git/reset/sweep/gitlinks/startup、readiness logical request 与 physical owner，读取正式 21/56 runner 0、Workspace 4/11、三组原 SQLite/backup 的全原列与 rowid，未发现新的明确本分区机制问题。边界为固定 physical path 抑制 logical alias 改目标，不声称对任意外部 OS 物理资源置换提供绝对原子性；未知 startup 保全而不自动重跑。本结论只覆盖本分区，整体 Expert/Bus/Channel 由主 agent 汇总独立裁定。
- 最终当前 8 backend `bun run typecheck` 已完成 exit 0（`publication-current-v8-typecheck.log`，真实 runner session 72693）；生产与测试源此后冻结，主 agent 统一格式化、文档检查、提交与推送。
- `reset-original-recovery.log`：真实旧无 phase reset 的原 admission 全字段归档为历史保全，原 tracked bytes / 两次已发生效果保留，原 fence 结算后 Project 可打开，READY=false，重复两次稳定；旧原件副本留在私有 evidence。
- `readiness-scale.log`：真实 create 后正式 isReady，向同 Project 用 Store.create 追加 0/100/1000 条未匹配的合成 immutable intent metadata，各五次实测均 READY=true、原 effect 一次。平均约 5.97/430.33/516.31 ms；1000 的中位约 506.89 ms。每次 1 次匹配资源完整 phases/terminal 读取，加 1 次历史 v1 精确探测；metadata 仍为 O(本 Project 各 generation intent 数)，1000 意图约 0.5 秒是真实成本，未作常数或高规模性能承诺。
- 发布证据为 [脱敏公开 artifact](../../artifacts/2026-10-24-publication-effect-receipt-recovery.json)；本机绝对根、含路径的编码 reset identity 使用一致占位，私有原 DB/原件不提交。独立 judge 负责最终裁定，实施者不自行声明整体审计闭合。
- 工具与 checker 失误原件已分开保留：初次 Windows quoted 命令、误写 json 而非 canonical jsonc、无效 policy 值、旧升级 checker 误把新增 authority 行当数据丢失、reset checker 错读 worker envelope；均修 checker 后重跑正式原路径，不当作产品成功或产品根因。UI、凭据、模型及网络未使用。

## 共享 Store 全部生产使用者与审计边界

初始全仓清单有八处直接使用 `DurablePublicationStore` 的生产/交付调用者；当时 Expert Squad 使用原 mutation JSON/Artifact，MCP 使用 credential stage。本轮根修新增 `expert-squad/mutation-preservation.ts`，Expert 当前也复用公共 Store，直接使用者现为九处。下表保留初始八家并补当前第九家，区分本分区运行与其他分区证据；未运行的合同不能当本分区结果。

| 使用者 | 当前身份、效果与终态依据 | 真实合同与本轮结论 |
| --- | --- | --- |
| `worktree/readiness.ts` | 当前 v3 一份 Project journal；冻结 logical request/physical resource/DB/Project generation，整个 canonical owner，完整 populated 才补 READY | 本记录的 16 个完整 case 加 entry TOCTOU 原红/修复及两个增强 cold/generation case；当前仍交独立 judge 裁定 |
| `skill/replacement-publication.ts` / `skill/manager.ts` | 全 catalog owner，精确 before/after managed tree 与配置 effect scope，configured 原事实和当前 applied/superseded/unknown_preserved | 本轮 `skill-replacement-publication.test.ts` 三个真实 killed-backend/backup/scratch 合同 3 pass；`skill-replacement-config-scope.test.ts` 四合法编辑恢复 4 pass；旧正式 v6 原件升级通过 |
| `workspace/lifecycle.ts` / `workspace/workspace.ts` | DB+Project+Workspace 的唯一 occurrence；Project generation、冻结 named plan/removal plan 与 SQLite admission；行发布在实际 worktree READY 后，删除消费 exact frozen Git child | 已有 `workspace-lifecycle.test.ts` startup pre-row crash、two backends same identity、post-prune crash、same path new occurrence 与 Project deletion 子资源结算的真实 child-process 合同。本轮聚焦这些共享路径复跑到 `remaining-store-families.log`，结果另更新，不能用普通删除外键替代物理子资源结算证据 |
| `project/worktree-deletion.ts` | 同 DB/Project scoped frontier，冻结原 directory key/physical occurrence/Git registration；新物理资源不继承旧 delete intent | 同上真实 Workspace/delete/Project cascade、junction alias removed 与 same-path new occurrence 合同覆盖。`reset-project-generation.log` 本轮正式 Project.delete/recreate 也进入真实 managed-child settlement；已有物理计划而非仅 FK（Foreign Key，外键）声明 |
| `project/promotion-journal.ts` / `project/promotion.ts` | 原 Project generation、source/physicalSource/quarantine/staging/destination、完整数据库 source snapshot；published phase 决定 forward，未发布按原 snapshot restore | 已有 `project-promotion-journal.test.ts` 两进程同 generation、published crash forward、terminal→publication fence crash、source rollback 与 DB snapshot restore 等真实进程合同。本轮聚焦 published crash/fence 到 `remaining-store-families.log`，不以一个成功调用排除其他终态 |
| `project/implicit-project-creation.ts` | 创建前 intent+原 OS process occurrence+真实 directory ownership；recovery 先核 registry owner/physical，再按 exact admission 回收未拥有目录；已注册目录保留 | `project-implicit-creation-journal.test.ts` 与 `fixture/implicit-project-creation-child.ts` 提供真实 child-process 原件、physical replacement、活 owner/未知 owner 与 registry overlap 合同；本轮 root 的 global allocation 审计负责其实际生产 caller，未把这些既有合同冒充本委托新运行结果 |
| `bun/install-receipt.ts` / `bun/index.ts` | readiness 只声明 exact package dependency tree；适配器每次新 install 用 UUID（Universally Unique Identifier，全局唯一标识）staging/final generation，旧 preparation 仅确死可回收；消费前真实 verifyTree 验 manifest 与递归依赖，不把目录或旧 receipt 单独当完成 | 已有 `package-install-receipt.test.ts` requested/resolved receipt、真实 manifests/recursive dependency/新 attempt/resolved publication failure 合同。此领域的 external registry/lifecycle install 未在本轮无网络授权范围执行，不能宣称本轮验证外部 registry 或任意 package script exactly-once；它不是任意用户命令投递回执 |
| `sdk/js/script/generation-transaction.ts` | 仓库受控 generated artifacts 的可逆全代替换；open journal 先按原 target/backup 恢复整个旧代，再开始新的显式 build；terminal 才表示新代成功 | 交付工具而非用户 Task/Session 数据投递；本轮 root 的正式 SDK/OpenAPI regenerate 会进入该真实发布路径。缺 terminal 时回滚受控生成文件是当前原子 generation 合同，不需要凭输出文件存在补造过去成功。共享 Store 的 default list/read 原十一合同已本轮复跑 |
| `expert-squad/mutation-preservation.ts`（本轮新增，第九家） | 复用公共 Store，按原 operationID 与 installation subject 保全缺 receipt 的原 mutation journal、before backup 与当前效果证据；终态公开 `commit_receipt_unavailable`，不补造过去成功 | Expert 的已证根因、当前实现与真实故障/升级验收详见 [独立审计记录](2026-10-24-expert-global-receipt-lifetime-audit.md)，由主 agent 和该分区独立 judge 裁定，不冒充本分区新运行结果 |

`remaining-store-families.log` 已完成本轮额外聚焦回归：Workspace pre-row crash、两真实 backend、post-prune crash、同 path 新物理 occurrence 四合同 4 pass / 11 assertions；Project promotion terminal→publication fence death 和 published crash forward 两合同 2 pass / 7 assertions。未改这些成熟域代码；结果验证本轮共享 Store 与 Worktree 根修后它们仍从真实原件收敛，不能扩大为“所有未选 case 已重跑”。

### Expert 初始 publisher 移交与当前公共 Store 实现

Expert 普通 Task.delete 是 tombstone，真实 receipt 留存，已排除普通 Task 删除必然丢 receipt；但这不证明物理 Project.delete 安全。Manager 全局 `.evolution-mutation-*` JSON 的原 receipt identity 指向 source Project 的 EngineArtifact；`committedEvolutionReceipt` 只查该原 row；物理 `deleteProjectRows` 真正删除 EngineTask，之后 global journal 若仍在，可进入“缺 receipt→uncommitted rollback”分支。root 交另一独立 agent 用真实 Manager durableReceipt writer、commit 后硬退出、正式 Project.delete 与 global reconcile 验证，本委托移交原入口/切点/schema，不重复探针。

另一 agent 已回报真实红例 `channel/expert-global-delete-creator-correct/result.json`：原 Manager target v2 与 receipt 一条已提交→exit 23→正式 Project.delete committed、删除 Task 一条→Project/Task/receipt 均零但 global journal 仍 file 1366 bytes/target v2→正式 global reconcile 将 target/README 回滚 v1并删 journal。有效 source receipt 的保留对照执行相同正式 reconcile 则保 v2 清 journal；Provider=0。前几次 Task fixture creator 准备错误已排除。本项因此是独立原件已证缺陷，由 root 接手 Manager 根修与独立裁定，不再称“候选已静态排除”或把本分区绿例包装成整体闭合。

以上移交描述初始实现及其原红例。当前 Expert 已新增 `mutation-preservation.ts` 直接复用公共 `DurablePublicationStore`，是当前第九家直接使用者；其根修、真实验收及独立裁定以 [Expert global receipt 生命周期审计](2026-10-24-expert-global-receipt-lifetime-audit.md) 为准。本记录不继续沿用“Expert 不使用 Store”的当前实现描述，也不重复执行该分区验收。

## 后续检查器失败的原件保全

主方案“最终检查器停顿与证据保全方案”已先落盘并授权。`run-tests.ts` 原来把 physical/output settlement 当成验收成功，`result.failure` 抛错及普通 exit 1/7 后，finally 仍删除整个 ownerRoot；`run-with-inactivity.ts` 同型。子 test preload 本就把完整 ownerRoot 删除权交给父 runner，公共 `removeIsolatedTestRuntime` 的 authority 校验正确，故只修两个 runner 的本地完整成功事实，未改 primitive、超时或另建 archive 实现。现在只有全部选中文件正常 exit 0 且结算确认才清理，其余输出真实 ownerRoot 和 settlement bool 并保留同级 test-* 的真实数据。

- 修改前两个脚本与对应测试的 working/index 差异均已保存；本轮原本没有这些文件的额外差异，未覆盖 root 已 stage 的其他源。
- `runner-evidence/original-checker-red.log` 的五个真实 CLI case 全部在原实现失败：普通 exit 1、exit 7、实际原生 stdout observer 故障、实际 1 秒 inactivity watchdog、第一文件失败后第二文件成功，原合成 SQLite 均不能冷读（SQLITE_CANTOPEN）。原失败不称作已归档数据库。
- `runner-evidence/fixed-contracts.log`：failure 四项 4 pass / 22 assertions、selected-files 一项 1 pass / 8 assertions、成熟 command settlement 五项 5 pass / 10 assertions，三个原 runner 均 exit 0。observer 只在专用 preload 让实际 stdout callback 抛错，继续使用原 native supervisor 与真实物理结算；没有 stub 进程或修改产品 timeout。
- `runner-evidence/raw-acceptance-results.json` 另脱离外层测试清理运行五个真实 CLI，实际 exit 为 1/7/1/1/1，各 physical/output settled=true，六份原 SQLite 行/BLOB 与八字节 binary 全部冷可读；这些供 judge 的原 ownerRoot 保留。全部是明确标为 synthetic 的测试数据，不冒充用户存量或那次 Channel 失败库。
- 常规测试在正向读取原事实后，校验 exact manifest、物理 ownerRoot 位于当前测试自有根、runtimeRoot 位于 ownerRoot、ownerRoot 前缀及真实 settlement，再使用成熟 managed-directory primitive 清理自己已验完的合成失败 runtime，避免持续集成漏目录；raw acceptance 五组原件不由该测试清理。
- root 11:05 那次故障库没有归档，仅有当时只读查询输出和后续 70-sample 采样；不得称所有失败库均已保留。后述 algorithm 当次抢先保全的 DB8/两份 marker 以及 fresh Task-scoped 红例是另外的真实原件。

## Task-scoped 缺失父目录的后续真实红例与根修

主方案“Task-scoped 物理路径的后续真实回归”先写分析、影响面和授权，才实施修复。原 algorithm 的 worker 74800 仍存活时，在应用 opener 之外用 readonly BEGIN serialize 保全一致 DB8，复制当时完整 process tree 和两份现存 ownership marker 原字节；私有 `runner-evidence/scoped-path-original-manifest.json` 精确指向它们。不能与未归档的 root 11:05 库混同。

独立 fresh 生产 `Worktree.create` 再证红：真实 Task 标识 `tsk_g00VYxuscu00kLX0t1YS`、Session 标识 `ses_g0VYxuscu00I92np3xg9`，实际 Dirent 分别全小写；create 成功返回，但严格 Ownership.snapshot 为 `invalid / path/content identity mismatch`。旧 21 case 只覆盖普通名字，未覆盖包含业务标识的父目录首次创建。错误由本轮防 alias 换目标的 `physicalInfo.directory=directoryKey` 引入；Windows comparison/lock key 可以折叠大小写，尚未存在的 typed suffix 不能。因此严格 parser 正确，禁止折叠业务标识、放宽 parser 或只改 filter。

当前唯一 DirectoryAdmission ancestor resolver 一次返回保真实 case/原 missing suffix 的 `physicalPath` 与原 normalized `directoryKey`；async/sync key API 仍消费同一解析结果。withOwner 同次冻结二者，create 的首 Git、reclaim、readiness intent、startup、owner record、cleanup 和 public Info 只用 physicalPath；锁、比较与 admission 只用 key。reset plan 直接消费同一个冻结 resource，Git registry 只用于证明原 key/branch，实际 cwd 不重新读取 raw alias。历史 v3 intent 原字节不改，read 按其 immutable key 校验并解析现存物理路径；schema/迁移 7/8、typed ID 和 ownership parser 未改。

- `runner-evidence/fresh-scoped-red.log` 保存上述明确红例；fresh 修后 `fresh-scoped-fixed.log` 的原生成 typed ID 与两级实际 Dirent 精确一致，Ownership integrity=complete，原 DB/tree/marker 均独立保存。
- 新真实 Task-scoped create/list/renew/ManagedSession release/Session.release→proveOwnerless 合同 1 pass / 5 assertions；readiness 常规三合同 3 pass / 5 assertions。最初新 checker 错把正常 Session.release 当成必须 abort signal，已依真实 API 改为公共 `proveOwnerless` 的明确 ownerless/complete，原错误日志保留，不改生产释放语义。
- `runner-evidence/scoped-algorithm-final.log` 原完整 algorithm 37 pass / 98 assertions；root 的成熟 Node assert 修改保留，原 owners filter 仍严格相等，lease-close 用真实 ownerless/complete 合同。首次新 remove 断言漏了实际 `receipt:{ok:true,status:removed}`，已补精确公共输出后重跑全文件通过，未吞字段或放松 parser。
- `runner-evidence/scoped-alias21-fixed.log` 当前全部 21 pass / 56 assertions，包括 first Git 和 late alias 效果后硬切/冷恢复。`runner-evidence/scoped-typecheck.log` backend exit 0。前轮 21/current 8 绿色保留为历史，不替代这次新增业务身份矩阵。
- 旧合法 scoped owner 使用真实 Git HEAD 的 schema 6 源在独立 artifact 中运行。初次 source fixture 缺 workspace 依赖、SDK source export 条件、tracked generated/builtin 组装失败均保留原 log；只按仓库现有依赖与 `--conditions=source` 补齐相同 HEAD 的实际运行布局，旧生产源码和 SQL 版本未改，也未创建分支/worktree 或平行产品实现。
- `legacy-scoped-create-v6.log` 的正式旧 producer 真正生成 version 6、严格合法 mixed-case marker 与同名 Task/Session Dirent。`legacy-scoped-upgrade-v8.log` 正式 6→8：90 原表/4 原业务行及 rowid 保留、backup 精确、migration stage 原 marker 逐字节相等；当前 reuse/renew/release 的 IDs 与原目录一致，原启动效果一次/用户字节保留，旧 startup 明确 unknown 而不重放。原6库/master/tree、migration-stage8、backup、恢复库和原 marker 均在 `legacy-scoped-{original,upgrade}-manifest.json` 指向的私有原件。前述真实旧7 reset→8原件仍独立有效，不把新 scoped producer 伪称为 version 7。
- `scoped-final-tests.log` 是 16:45 的旧阶段，mixed 两 case 的实际 stderr 为当时 global_creation_allocation DDL/registry 漂移，不是当前绿色；后续 17:51 `publication-final-contracts.log` 已 4 pass / 16 assertions。原失败保留，当前最终 scope/工具清理合同另用新 log 收口。
- 清理 helper 加入后的 `runner-evidence/final-tools-and-skill-scope.log` 当前四文件全部 exit 0：runner failure 4 pass / 22 assertions、selected-files 1 pass / 8 assertions、native settlement 5 pass / 10 assertions（工具合计 10/40），Skill scope 4 pass / 16 assertions；共 14 pass / 56 assertions。`runner-evidence/scoped-workspace-final.log` 在新 resolver 下四项真实 crash/concurrency/recreation 4 pass / 11 assertions，runner exit 0。`runner-evidence/final-typecheck.log` backend 已完成 exit 0。
- 独立 judge 已冷读 legacy scoped 原6库、migration8、backup 和 marker，认可该升级证据；其边界是实际 Worktree producer 的 Task-scoped 路径/owner 合同，原 Task 数据库行数为 0，不宣称 Task 调度、模型推理或完整 Task 执行验收。此前其他真实 v6/v7→8原件未重造或改版本。
- 脱敏公开 JSON 保留早先 21/current8为历史，追加 fresh Task-scoped 红与精确 ID/Dirent、resolver 根修、当前 37/98+21/56+Workspace4/11、旧合法 owner 6→8、工具五次真实 CLI/六份原 SQLite+BLOB/binary 及清理后最终 10/40+scope4/16摘要。未公开 raw 本机路径、数据库或 profile；root 11:05未归档失败库的界线明确记录。
- 本轮代码、测试和本记录/JSON 完成后再次冻结；root 统一最终格式化、全仓检查、独立总体裁定、stage/提交/push，本 agent 不操作索引或提交。
