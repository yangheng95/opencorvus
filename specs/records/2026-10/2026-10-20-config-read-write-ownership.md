# 配置读取写回与跨进程提交所有权

## Recall

持续单agent自主迭代，后续单agent要求覆盖旧goal的三个Astra，不委托。上一轮456是progress：b27be5156ac934d7b91eea4eb2608b444e8912fa已正常推送，fresh fetch HEAD=upstream；坏插件拒绝和同URI修复重试、67例/161断言、最终18个实际HTTP请求与精确gpt-6.1-sol流式预检通过。两个native scope/全部checker及runtime/private授权配对均完整结算退休。最终101 Project/134 Session/schema2保留。全量保存11881.957/恢复11464.019ms仍未达10s/5s，四读取20s通过。开始只有既有.bun/及packages/opencorvus/bun/未跟踪。

采用已应用benchmark-debug-template。当前浏览器被Work设置禁用，不绕过，不新增/运行UI自动化，不操作用户18571、进程、窗口或用户数据库。不新建branch/worktree，不清历史、缩项目或放宽原性能指标。真实Provider若用于交付验收，现有授权auth及完整models成对新复制，分别验证凭据、目录、实际gpt-6.1-sol与streaming；原物理/输出/请求/launcher和checker结算后精确退休配对，秘密不进入日志、spec或提交。

## 修改前分析与横向审计范围

已读456 Recall/失败schema-normalization证据，当前05-config/02-data的canonical-file owner、源generation与自动迁移合同，Config.load/loadFile/loadSourceSnapshot/loadStableGlobalState/loadStateOnce、显式Project/global writer与MCP source writer、migrateLegacyPermissionConfig、withSharedJsonFactLock/withProcessLock、原peer fixture/全部六个调用和peer convergence、layer inheritance、permission-two-mode相关合同。所有检索均后端，未发现或运行UI自动化。

直接触发点是非空、缺少$schema的物理文件正常读取，或含permission/tool_permissions旧字段的读取。load在解析过的旧快照上直接writeAtomic，没有canonical-file owner；readOnly及managed来源抑制该写回，非文件来源仅转换。普通writer本来在同一跨进程锁内读取/合并/提交最终schema正文。旧路径注释以“幂等”和“atomic replace”解释不加锁，但这只能排除撕裂字节，不能证明晚到快照不会覆盖peer已提交字段。实际跨进程丢失仍未知，必须先用原writer和物理文件复现。

全部读取入口为Project有效配置、global有效配置、Project/global source缓存、candidate/standalone只读snapshot、自定义和远端/inline/managed层；全部写入为Project/global patch/atomic callback、MCP指定源修改、首次默认文件/依赖文件及两条读取写回。依赖package文件不是canonical配置，必须明确排除。权限转换的映射与version1 audit metadata是已交付合同，不能改映射、丢用户字段或删除转换来掩盖所有权问题。现有逻辑可能在writer commit hook内读取同一或其他源，不能盲目套同一非重入文件锁而制造自锁或Project/global反序死锁。只删除schema分支不能排除另一条同根写回。

若复现并发覆盖，立即按共享数据机制横审：所有生产Config入口；新Task/Mission/Session的配置/权限投影与已冻结occurrence；正常/终态、重试/重启恢复；同/跨项目与同/跨进程串并行。重点区分源文件更新丢失、缓存发布拼接和执行终态问题。只有代码、持久字段及真实执行能排除后者，不能把peer最后报错或单场景通过当根因。当前没有新调度异常，不修改调度协议。

## 实施前方案与验收

1. 泛化既有peer writer fixture为显式JSON patch输入，同步六个调用，保留同一原Config域writer与输出/完整关闭；不另写简化writer。新增正向跨进程交错：parent在读取目标精确快照后暂停，原peer通过完整writer提交username/permission_mode等字段，parent继续schema/legacy读取。覆盖Project/global和两种触发，比较peer原响应、写入后的实际文件、最终reader投影与最终持久字段。parent使用原Process.runHost及无活动超时，所有接受进程先结算后清理，失败不留孤儿。先保留当前失败。
2. 按真实失败补齐根因、调用/公共约束、锁序和迁移机制后再改唯一实现。目标为正常读取的源generation不覆盖peer更新、当前显式writer一次提交完整规范格式、旧权限自动迁移保留原映射/字段/注释并通过真实owner提交。持久迁移不能继续在旧快照上无锁replace；需要同owner重入时复用确切活跃owner，不给晚到context、不同文件或不同进程伪造所有权。禁止第二配置缓存、revision sidecar、备用解析/转换或宿主专用路径。
3. 聚焦正向合同覆盖读取/写入交错、global与多个Project隔离、同文件commit hook与交叉source、显式writer的原子callback、旧权限audit/现有模式、校验错误后的当前格式源、peer恢复和occurrence冻结；消除本轮触及的过期断言，不保留旧实现迎合测试。不以hash或缺少/未调用为核心验收，不无目标运行全量测试。类型、API与当前文档检查只是补充。
4. 有生产修改后在完整QA历史的新自有开发/ui服务上，以原公共HTTP验证配置源保留、实际保存/恢复和授权精确模型流式预检；完整10s/5s/20s checker保留全部项目与历史，失败如实记录。浏览器仍禁用则明确最新视觉未达，不以HTTP或类型替代截图。
5. 全部原句柄和物理/输出/请求闭合，readonly SQLite比较全历史身份/归属/目录及schema；敏感值扫描后精确退休复制对。安全归档、三索引及相关架构、范围commit、fetch/merge upstream、完整待推集合检查、正常hook push与fresh fetch。持续目标保持active，不以单条配置race修复代替全部UI/功能/性能目标。

## 复现与实施决定

原 checker 61581 已结算，before.log 保留四例全部失败：Project/global × schema/legacy 在真实 peer 返回成功并写入 ask/peer-after 后，parent 返回 full_access/reader-before。相同旧快照无锁写回能回退权限，属于共享源事实所有权缺陷。

实施选择：普通 schema-less 读取只解析，不补写 metadata；显式配置/MCP writer 负责在其完整提交中保存 schema。旧权限 version1 转换保留，通过现有同一 canonical-file 跨进程锁执行：所有 writer 在入锁后、任何域 callback 前先正规化本文件；reader 仅请求 owner 重读最新物理文件再迁移，不使用旧快照写入。活跃 exact-file owner context 仅允许 reader 跳过重复迁移，不允许 mutation 重入；退出后 active=false，晚到继承不拥有旧锁。迁移函数只处理文件字节，不取得 Config/cache/catalog/generation 或另一文件的 owner，所以不会引入反序锁边。parser 继续消费原快照，原 source revision 循环负责变化后的重读。JSONC 注释/其他 authored 字段保留，literal legacy key 存在时才解析 env/file 值；已交付映射/audit version 保持。显式 patch 若带 legacy 字段也在唯一提交正文内正规化，不留下第二读取写回。

复核发现 raw JSONC key 检测会提前拒绝原 ConfigPaths 支持的未加引号 env 值，因此迁移文本统一使用原 ConfigPaths.parseText 后转换，不另建原文探测 parser；不会把展开后的其他业务值写回。新增真实 env 值正向合同。入锁准备会校验目标源的引用，这与正常 Config 读取一致；MCP 自有写入也遵循当前源解析合同。只读/managed/remote/inline不持久迁移。远端层原先人为注入 schema 只服务于已删除的读取写回分支，随该分支删除，远端业务字段与原文身份保留。

横审代码证据：task-api/index.ts:createTaskInExecutionDirectory 通过 EffectiveConfig.snapshotCurrent 捕获一次 clone，createTaskInner 把 snapshot 写入 Session metadata；Task profile/package revision 与 workflow-binding-facts 保持持久绑定。global-task-service 的独立入口使用 getGlobal 的同一 generation。Mission 创建/恢复使用原 Session 与 immutable squad snapshot，Session policyForSession 先读 PermissionPolicyTable，再在 immediate writer 中只创建一次 mode/revision；既有 Session policy 不被源刷新重写。Execution capacity 动态读取使用 EngineConfig.get/getGlobal 同一源。正常、终态、retry/restart不拥有另一配置文件 writer；本轮修改没有 scheduler/Task/Mission/Session DDL 或状态写入。permission-two-mode 实际数据库/执行、两项目隔离、恢复与终态23例已通过，Config peer exact-source/已提交事件重试/串并行与cache convergence亦通过。没有证据把源覆盖扩大为新的调度终态缺陷。

第一次 native 18723 原句柄4962已exit0，writer5507/reader84790及HTTP全部结算，公共shutdown200后physical/output/request/launcher和runtime授权对均已关闭；最终production parser调整后必须以新scope再验收，不冒充首次服务动态加载了新代码。初次HTTP checker错误地把本项目badRequestBody当NamedError读取；已保留原失败和恢复证据，按实际HTTP合同修正后六请求通过，未改生产错误响应。

扩展24例JSONC诊断检查捕获4个真实回归：锁内迁移准备先展开引用，使原 writer 对 malformed authored 文本的列号错误地变成 reader 展开后的列号。保留 final-contracts.log 的20 pass/4 fail，修复为显式 writer 入锁后先调用原 literal parser，reader迁移使用expanded入口；二者仍共用同一文件owner和同一迁移实现，不增加备用解析或重写测试期望。新增unquoted env迁移例已通过。第二scope仅做最终前preflight后已公共shutdown200、98994 exit0、physical/output/request和runtime配对退休，不对其宣称最终HTTP或性能验收。等原定向检查完成后再启动第三个精确scope。

## 最终结果与交付范围

最终 verified-contracts 原46516 exit0：11 ownership +24 JSONC diagnostics；首次focused原50533 exit0的其余七文件保留，九个不同文件合计117例/271断言。最终typecheck原56840 exit0。生产仅config.ts：删除无锁schema/legacy旧快照写回；显式MCP完整提交补schema；原迁移逻辑移入唯一file owner准备并规范显式patch正文；保留原literal writer诊断、expanded reader和version1映射。fixture只泛化输入并完整dispose/close，原六个调用同步。

最终18727原服务38531、实际六HTTP、writer73658和reader7718全部exit0/同步结算。独立auth可用、完整catalog投影、实际gpt-6.1-sol/streaming均通过。完整104项目保存12798.661/恢复12560.433ms仍不达原10s/5s，四并发读取最长12968.422ms达20s；保留全部历史和原指标，没有性能成功结论。公共shutdown200后physical/output/request/launcher关闭，再readonly SQLite逐一比较三份完整历史：schema2、104 Project/137 Session，所有原身份/归属/目录保留。三组runtime及private auth/models均在结算与实际敏感值扫描后精确退休，源未写入。用户18571、窗口与用户数据库未操作。

安全归档见[本轮产物](../../artifacts/2026-10-20-config-read-write-ownership/README.md)，保留原数据覆盖失败、checker形状误判、四诊断回归与最终验证。三索引与当前05-config同步。UI源码未改且Work浏览器仍禁用，没有最新网页/视觉资格；Goal入口/默认布局整体目标及全量保存性能继续active。文档、API、架构检查后做范围commit，fetch/merge upstream、完整待推集合复核与正常hook push；不发布版本、tag或Release。
