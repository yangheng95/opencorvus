# 固定业务起点：可行的返工诊断与不能识别的监督收益

## Recall与结论

本文件保留G16设计时点。G17已实现共同API会话、显式开发输入和SampleSetup；
本地检查使用新test-driver合成记录，不使用B1活动快照，不代表模型纠错。实施与验证
状态以主记录G17为准，下文“尚未实施”等文字描述原设计时点。

承接[H-E结果](he-01-results.md)、[归档入口审计](archive-review-ingress.md)和
[主记录G16](../../records/2026-09/2026-09-25-supervision-causal-iteration.md)。用户要求真实
业务纠错，不能把只读文字判断降格成成功标准。本轮源为`e90bc09b`，只审查、落盘设计及
执行一个无世界构造的纯函数检查；没有创建新的world、Task、模型请求、服务器或包。

**固定一份自然错误的业务状态，在原API上开展新的返工任务，数据层面有可行方案；
保持原`.13/.14`流程同时让两版verifier收到相同完整待审输入，目前没有合法现成入口。**
后者受executor先行、实际派单和真实交接影响。复制世界只固定任务开始时的状态，不能
固定之后的参与者行为、读取次序或verifier上下文。因此不登记另一个H-E对照来宣称
分离了锚定/表示/能力，也不把这一边界当作所有纠错研究无解。

本设计选择的唯一后续方向是**明确标注的固定状态业务返工诊断**，回答整条链能否从
既有错误记录出发取得来源、改变业务值、复核并如实结算。它需要一个很小的环境适配，
尚未实施、未验收、未取得新的运行冻结收据；它不是原官方案例、旧Task恢复或进化收益。

## 原始材料和责任边界

固定源为原B1 `.eval`的`automationbench_snapshot`；当前只读展开可通过
`.tmp/supervision-causal-20260925/he-01/audit/B1-final-chain.json#/official/snapshot`
定位。未来制作fixture前须再与该原eval逐值核对，不能只信派生文件名。

| 对象 | 事实来源/作者 | 新诊断中的意义与可见边界 |
| --- | --- | --- |
| 原完整业务状态 | B1真正结束时的上游WorldState快照 | operator明确复制的开发初态；完整状态仅环境持有，模型通过真正API搜索/读取 |
| 目标错误记录 | B1事件17实际创建的Opportunity `286317e840bd486090` | 初态中已有的业务对象，Amount=20000；不是新Task执行者创造的结果 |
| 记录中的错误说明 | 同一记录的580字节description，包含`4 x $5,000 = $20,000`及旧来源坐标 | 原样保留。它是真实历史业务文本、可产生锚定；不能删掉后声称保留同一起点 |
| 邮件、价表、联系人、账户、case及噪声 | 同一B1快照中的原来源 | 保留全集及次序；B1没读过价表不代表环境没有它，不用T1/Cycle3材料补题 |
| 旧Task/Artifact/Message/Tool IDs | B1原运行归属 | 仅留在operator来源记录；不导入新Task表、不当新read-ref、不伪造当前producer |
| 新请求 | 当前operator公开提出的返工义务 | 属于新的Mission输入；不冒称原USER仍是“创建”指令，也不把原SYSTEM伪造成新的system消息 |
| 新Tool/participant/Artifact | 未来新Task的真实调用与作者 | 新API输出由当时的模拟业务引擎计算；新事件从1开始，不能接上旧27条假装同一次执行 |
| 真值和判定理由 | operator评估侧根据原业务来源独立审定 | 仅检查器持有，不进Task request/附件/MCP描述/模型探针；不是运行时Host决策 |

复制的业务record ID可在新模拟世界内部保持不变，以维持业务关联；新runtime/Project/
Mission/Task/Session身份必须新建。这个业务坐标连续性不授予任何旧Host身份或跨Task读取权。
同一个错误说明已经存在于业务字段中，故本方案明确包含历史解释曝光，不能宣称盲审。
G15的归档报告不作为额外附件输入；这与G15“闭卷读27条事件”是公开不同的信息范围。

## 已核对的代码与正向合同

以下路径除注明外相对`packages/inspect-benchmark/`。

| 边界 | 定义/消费者/已有合同 | 结论 |
| --- | --- | --- |
| 官方身份 | `automationbench/world.py::load_cases/official_case`；`task.py::opencorvus_automationbench` | manifest固定原domain/task/example，不能把派生fixture继续挂到sales/9官方评分 |
| 官方环境/评分耦合 | `task.py::sample_environment`构造OfficialWorld、结束seal、snapshot与rescore | 不能只替换initial_state后继续调用原official scorer |
| 可恢复状态 | `world.py::rescore`以`WorldState.model_validate(snapshot.world)`恢复，另恢复Sheets写入跟踪 | 证明有原引擎的状态表示/恢复实现；当前入口只重评分，不是活动fixture API |
| 真实API | `mcp.py::world_server`→`OfficialWorld.call`→上游`api_fetch`→Salesforce route/impl | 原四工具可服务真实模拟状态；不是旧Tool返回的录制重放 |
| 更新既有记录 | 上游`tools/api/routes/salesforce.py`的PATCH Opportunity路由、`impl/salesforce.py::salesforce_opportunity_update` | 确有按record ID更新Amount/Description等字段的代码路径，返回`{}`，故还需真实GET读回；本轮没有执行该路径 |
| 新业务入口 | `solver.py::build_opencorvus_solver(sample_setup=..., entrypoint="mission")`→`adapter.py::run_mission` | 已有环境资源作用域、真正Mission请求和Task生命周期；不必增加平台/角色/Task控制API |
| 固定verifier输入的限制 | 根`expert-squads/builtin/automationbench/expert-squad.jsonc`规定verifier依赖executor；scheduler读真实结果再派单 | 相同world不能保证相同executor材料/派单；不能把operator拷贝变成真实executor结算 |
| 可参考的正向检查 | `tests/test_automationbench.py::test_real_inspect_mcp_official_rubric_and_snapshot_contracts`、`test_sheet_write_tracking_survives_official_snapshot_restoration` | 既有实际MCP/官方状态保存路径，而非本方案已跑通。本轮未重跑旧检查 |

只读源码确认上游Opportunity更新最后调用`SalesforceState.update_record`，该函数重建原
model并写`datetime.now(timezone.utc)`到last_modified_date。它是API产生的实际修改时间，
不能伪造为业务clock，也不能因两次运行时间不同就判业务字段被篡改。

## 两个不能采用的快捷方式

### 完整snapshot不等于原始seed

本轮实际调用原`automationbench.runner.compute_allowed_services(snapshot.world, [], [])`，
没有调用WorldState/OfficialWorld构造器、API、scorer或Provider，得到下表：

| 项 | 只读实际结果 |
| --- | --- |
| B1原`meta.allowed_services` | `gmail, google_drive, google_sheets, salesforce`，共4 |
| snapshot序列化的服务字段 | 共48，包含没有连接的默认空服务 |
| 原helper按这些字段重新派生的服务 | 共48 |
| B1业务clock | `2026-09-25T11:15:25.718221Z` |
| Sheets写入跟踪 | 空列表 |

原OfficialWorld构造器会按initial_state键重新计算服务列表。直接把snapshot当seed，
就会把4项订阅扩大成48项；把allowed_services设为null还会关闭该上游权限检查。
这是拟议适配的反例，**不是发现当前官方入口已经做错了这种转换**。未来必须恢复
完整状态及其原allowed_services，不能用展开字段重新推定权限、裁掉默认服务再猜初态，
或另放一套覆盖名单。服务权限仍只由恢复后的原world.meta一处供api_fetch消费。

### 世界时钟不能重新取“现在”

已读[新时钟审计](../../records/2026-09/2026-09-25-automationbench-environment-clock-audit.md)
和当前Inspect架构。`ba89e5cb`冻结缺失Case clock并使input/world/replay同源；它不改旧
H-E结果，也不能用旧fe233643启动脚本代表当前行为。开发fixture应沿用上述快照的明确
clock，不再以当前墙钟重新生成Case；请求公开显示同一业务时间。

原定价邮件标题写FY2026，正文条件为账户renewal落在Q4 2025，目标账户原renewal为
2025-11-20。这些原字节和日期都保留，不由harness修成“合理日期”。评估依据是正文
针对renewal的条件，不能增加不存在的活动失效条款；若模型提出新的日期/适用性争议，
单列原证据和判断，不能靠隐藏官方答案抹平。Salesforce等上游的wall-clock元数据仍需
作为环境限制记录，不能声称整个API已经时间确定化。

## 单一可实施适配：只分离环境运输与官方评分

当前没有这个活动fixture入口。必要实现的范围应限制如下，不新增通用fixture平台：

1. 把现有`OfficialWorld.call`中的三项调用调度、事件追加、sealed保护及原始状态导出，
   移到同一份不持有official case/assertions的模拟API会话组件。OfficialWorld继续负责
   原Case初始化和原官方评分，但消费该唯一组件；原call实现随迁移删除，不双写事件。
   第四个MCP工具api_catalog仍由原MCP层提供文档，不伪记为上游world业务事件。
2. 开发fixture只允许从明确标注的完整快照恢复该组件：用原WorldState validator、
   原allowed_services、原clock和原Sheets私有写入跟踪。保留全部business状态，当前
   事件列表为空。组件不附加答案、结果模板或任务语义判断。
3. 原`world_server`依赖这一个API会话，保留同一MCP工具定义、真实实现和资源清理。
   开发入口通过现有sample_setup配置真实loopback MCP和不可变包，再用原solver的
   Mission入口。没有“缺服务就用归档返回”的后备路径，不改变包的四工具授权。
4. 只用一个显式开发诊断入口/输入文件。其身份为operator-derived business-repair
   fixture，source_provenance可指向原官方运行；不得设置`benchmark=zapier/automationbench`
   或写`automationbench_score`。公开参数不增加到原official manifest，也不允许该
   manifest静默切换初始化策略。原official Case/score/重评分继续唯一原路径。
5. 评估在真实任务收尾后读取当前事件和末态，输出下述开发义务表、原生结算与成本。
   不调用原create-case的rubric，也不用`task_completed`/字符串includes作业务分数。
   没有必要新增judge模型或Host金额gate。

这是可审查的实现边界而非已实现的API。未来如实施，必须同步更新当前Inspect架构，
删除迁出的重复实现，并以模型无关的真实MCP Checker核对它；当前仅方案不改变架构事实。
同起点只用于材料和权限完整性，不能靠hash相同声称两个Agent的推理/曝光相同。

## 新的公开业务请求草案

下面是一份新的operator请求，供未来冻结收据审查；**本轮没有提交给任何模型**。
只有原请求中已有的人类业务名称，没有record/source ID、正确金额、公式或评分断言。
原SYSTEM约束若保留，应在冻结输入中逐字作为公开任务约束，不重新注入system角色。
新请求对“已有记录返工”的说明公开取代历史请求中的create动作。

```text
This is an operator-prepared development copy of an archived simulated business state.
Its existing records were seeded from that archive; they are not effects of this Task.
The simulated business current time is 2026-09-25T11:15:25.718221Z.

Review the existing Summit Industries - Analytics Module opportunity against the business
requirement below. Establish the applicable source facts, correct the existing opportunity
and its pricing explanation where supported, and verify the resulting business outcome.
Preserve the existing opportunity identity and fields already supported by the requirement,
as well as unrelated records and source facts. Work on the existing opportunity rather than
creating another one. Report any remaining uncertainty truthfully.

Business requirement: Summit Industries wants to add our Analytics Module, with appropriate
pricing based on their account size and tier, using the latest pricing updates and account
health policies.
```

这段输入不命令scheduler先派哪个角色、必须发几次工具或制造一次失败。原Agent自行
读取、计算、派修正/复核；在当前包中executor先修正是合法结果。它仍可证明一次从
既有错误到业务修正的过程，但**不能**证明verifier先发现错误、同Task内部返工被触发，
更不能证明`.14`优于`.13`。若还要那个因果问题，须另提公开流程干预；本轮停止该子路径。

## 评估侧判定与反例

| 维度 | 真正要观察的证据 | 成功/失败边界 |
| --- | --- | --- |
| 初态身份 | 完整B1快照、原4服务、原clock、错误业务description原样；新会话事件从1开始 | 初态或权限不同就是fixture失配，不进入模型效果分析 |
| 原始事实→独立判断 | 模型真实读取来源、原账户/联系人集合、折扣及适用更新；方法/比较的真实引用与先后 | 来源在环境中存在不算已读；已有description曝光应明确记录 |
| 实际金额修正 | 当前Task作者的实际PATCH请求、真正API返回、同record后续GET和末态 | 评估侧来源推导为(40000+4×5000)×90%=54000；`{}`更新返回本身不证明结果 |
| 保持成功义务 | 原record ID/Account/名称/On Hold保持、其它字段逐项比对及改变理由、原机会集合与其它业务状态 | 新建正确记录但旧错记录仍在，不是修好；已正确字段/来源被改坏也不算完整成功 |
| 解释的一致性 | 改后description与原价表/邮件/计数一致，保留原错误说明的归档证据 | 只改数值却继续保留旧错误计算为当前解释，要作为剩余矛盾，不能靠匹配数字通过 |
| 监督→行动 | 先前错误仍在时verifier指出具体差异→真实scheduler continuation→原executor修正→独立再验 | executor首次就修好只支持修复交付；没有自然监督返工机会不补跑 |
| 结算 | 当前真实Task/Mission Tool及最终业务证据一致 | 正确报告但未实际修改、业务仍错却accepted分别列出；runtime缺分null不当0 |
| 成本/进化 | 所有角色/preflight/内部请求、完整可得usage/缺项、Tool和时长 | 一个诊断不支持推广父代、总体收益、模型优劣或边际成本因果量 |

expected金额和来源论证只在评估侧；不能复制本节进模型输入或在API失败时回填它。
保存逐字段结果，不把本方案的新保持义务追溯添加到历史H-E分数。
环境快照、评分依据和本设计文件应保持在sample project之外，沿原包工具权限提供
业务API。此处约束的是实际输入投影和访问路径，不把原co-located运行声称为操作系统级
安全隔离；未来仍需保留`comparable=false`及这一限制。

## 必要检查与停止条件

未来实现后、任何模型调用前，最小本地Checker应通过原MCP调用真实引擎。使用单独的
**显式测试driver**，给出其已知输入并验证目标PATCH→GET、末态、4服务与未连接服务的
精确401、导出/恢复、clock、Sheets跟踪和新事件序号。该driver的已知修改不是模型行为，
其运行状态和产物永不作为未来模型episode的起点；模型episode总从同一冻结初态开始。
官方现有checker仅因共享运输被迁移才需聚焦回归，不再把旧通过数累计为新的业务进展。

当前没有执行以上检查，也没有导出fixture文件。没有新模型样本数、目录、共同source
SHA、确切输入文件或controller。未来若仅验证这一全链能力，登记一次固定`.14`诊断就
足够回答是否出现所定义链路；不预定另一个无法隔离verifier的两臂试验，不补替失败。
这句话是测量范围建议，不是运行授权或冻结收据。

如果实现必须伪造producer、放开服务、隐去原description、修改旧world或调用官方
create-rubric冒充本次修复分数，应停止该实现并报告具体边界。若只有合规材料通道而
行为仍未发生，保留未知，不用协议通过替代业务纠错。整体业务可靠纠错和进化改善
仍未达成；本次交付只解决下一测量能合法问什么、不能问什么。
