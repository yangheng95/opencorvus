# 持久投递横向审计独立裁定

## Recall

- 用户要求横向调查“效果已发生但缺成功回执”，覆盖删除重建、重启、并发和保留数据升级；先分析后修，真实故障注入，由独立子 agent 裁定，继续追查新明确问题。
- 主方案为 [持久投递审计](2026-10-24-durable-effect-receipt-audit.md)，分区为 [Channel](2026-10-24-channel-effect-receipt-recovery.md)、[文件发布](2026-10-24-publication-effect-receipt-recovery.md)、[旧 Automation](2026-10-24-legacy-automation-upgrade-acceptance.md) 和 [专家团安装回执](2026-10-24-expert-global-receipt-lifetime-audit.md)。公开复跑入口在 [验收产物](../../artifacts/2026-10-24-durable-effect-receipt-audit/README.md)。
- 独立裁定者 `/root/independent_judge` 不修改实现、不提交、不再委托。它独立读取生产调用、原 SQLite 行及 rowid、完整原备份、实际目录树、原工具/消息记录和进程日志，追加真实反例。实现分区 agent 的自述不作为通过依据。
- 当前数据库版本8；1–7迁移保持不变。保留旧原件与历史失败日志，不手改版本号、不对原库运行当前 opener、不使用真实凭据/模型、不操作现用服务、不运行界面自动化。

## 裁定与证据

独立机制裁定：**本轮已声明的有界矩阵通过，暂无新的明确机制缺陷。** 过程中完整 algorithm 追加发现首次创建把 mixed-case Task/Session 目录变成小写、owner marker 真实身份冲突，裁定者确曾撤回 Worktree 分区通过。根修后，它直接核对新旧目录、marker、完整37项/21项及旧版升级，再恢复该分区通过。历史未知结果保全，没有伪造过去成功；任意外部副作用的恰好一次保证始终不在声明内。最终暂存范围及正常推送另按真实 Git 结果结算。

| 范围 | 实际验收及独立核验 |
| --- | --- |
| Bus / Event | 两进程争用在取 lease 时重验终态，实际 Session 效果一次；原受理 Fire 集合及空集合冻结；warm 子目录、硬退出及 cold 恢复进入同一真实目标目录；合法 Project promotion 保留原 source，恢复使用同代次当前目录。 |
| Automation / Mission / Session | project/session/global 在真实 wake Message 提交后退出23，原租约自然到期后恢复原 Run/Message；正式删除重建不跨 generation 重造效果。global 分配 Project 后、Run 预留前退出23，两个真实后继只产生一原 Project/Run/用户 Message/流式回复。Mission 普通 Tool 步骤不能充当最终回复，真实 accepted-input 批次可结算非 parent 的调度输入。 |
| Channel | 正式 Permission、Question 与直接 activity 效果后中断，利用原始 causation/outcome 恢复；原 accepted/outcome 在正式 Project 删除后保留；旧 Instance、长效果租约和并发终态均受原 owner 约束。缺原始因果的旧记录继续明确 unknown。 |
| 文件发布 | 最终8完整 alias/crash 21项/56断言、原 algorithm 37项/98次Bun断言、新Task-scoped 1项/5断言、Workspace 4项/11断言。一次解析冻结保case物理路径及比较key，精确保Task/Session目录身份；覆盖 population 后中断、startup 未知、删除重建、并发、reset fence、alias排队及firstGit/最终效果换目标。最终Skill scope4项/16断言及MCP真实进程恢复通过。 |
| Expert Squad | 原真实版本7成功 receipt 随 Project 物理删除造成全局包退回的红例已闭合。最终8的 global/project × promotion/restoration 四案真实 receipt→退出23→正式 Project 删除后，原报告0、长期 receipt1，原包仍 v2；原 envelope 字节及时间一致。普通 Task 墓碑保留原报告与长期 receipt。四保全过程切点退出24、两进程竞争、早期目标缺失、后续新明确安装及完整树/链接证据均核验。 |
| 唯一 Artifact writer | 最终9项/208断言：writer 1/23、现用 browser-preview 持久化后端2/4、授权 Evolution 5/151、Manager compare-and-swap 1/30。真实动态 WHERE 在 revision 分配后更新零行时，返回原合同 undefined、原报告及原 authority 集合精确保留；成功登记/报告/Protocol 同一保存点，冲突为明确类型错误。两个 where writer 暂无生产外部 caller，不称已有业务事故。 |
| 真实升级 | Channel 四份原6：90表、原行9/8/60/56；Automation 四份原6：90表、原行54/46/47/86；Expert 三份原7：91表、原行75/69/72。最终6/7→8正式 opener 的原列/原行/rowid逐一保留，原备份 schema/版本/行精确一致。Worktree/Skill 原6及 reset 原7也通过；不以原7中间结果冒称最终8。 |
| 新增旧scoped owner | 原6真实源码生成合法mixed-case Task/Session目录及marker；当前6→8的90原表4原行/rowid、原backup及marker字节逐项相等。当前reuse保原业务ID、用户字节和效果，unknown startup未重播，真实owner按原ID释放。它覆盖Worktree公开owner边界，旧原件无Task业务行，不冒称完整调度或模型验收。 |
| 检查器与失败证据 | 原完整九文件在native pending `rejects.toThrow`卡住，原70条采样首条准确定位native matcher。改真实JS await后同步检查原Error/消息，保原调用/超时，原九文件35项/161断言和Channel三文件23项/127断言均通过。两个runner只在完整成功且physical/output结算时清理；清理helper之后真实工具10项/40断言通过。另5个失败CLI的6份原synthetic SQLite、BLOB和binary逐字节冷核，原失败ownerRoot保留。 |

原始证据位于忽略的 `.tmp-product-iteration/durable-effect-receipt-audit/`。其中 `automation/allocation-public-final` 是交付探针的实际复跑，7份快照的12表 JSON 与同事务 SQLite 精确一致；`automation/bus-promotion-complete` 独立核验4份快照12表；Mission 核验21表；Event 目录三案核验15表。Channel 分区的 `v8/`、`automation-upgrade-v8/` 与 Expert 原7保全目录区分原件、升级 stage、最终恢复和完整备份。

检查器最初的错误期望、参数、原生 helper 匹配器、模型引用夹具和快照竞争均保留原失败，修正后重跑原生产验收；没有把这些失败当产品红，也没有跳过原真实红例。一次完整 Worktree setup 子进程空 stdout 的原始原因未被证明，补齐 stderr/exit 诊断后，原单项及最终完整21项均通过，不虚构该次失败根因。

原97852停顿进程的完整数据库在旧runner结算后被删除，只有当时独立只读查询输出与失败日志；不能声称该整库被保存或恢复。后续同序停顿的70条新profile与正常await后的完整回归保留。另一轮algorithm回归的完整DB8、process tree及原marker在退出前已单独保全，明确区分原件。新增runner保全保护未来失败；synthetic保全验收不是对丢失原件的补造。

## 工程交付检查

实现及当前架构已提交为 `1c1343c7c`（`fix(runtime): preserve durable effects across recovery and upgrades`），86个文件逐项匹配独立审阅清单；Webfetch、Overlay、07-panel及原无关删除均未纳入该提交。本记录与可复跑探针另作证据提交，正常推送及其hook结果以最终交付时的真实Git结果结算。

最终版本8全仓 typecheck：8任务全部成功；数据库/迁移聚焦4文件52项/164断言通过。SDK（Software Development Kit，软件开发工具包）正式生成成功，API（Application Programming Interface，应用程序编程接口）文档350操作/26组与源码一致；路由、控制 lease owner、架构索引及 package topology 检查通过。暂存源码 module topology 实核1191模块、6106运行时边、4个干净 import，release mutation topology 5个权威入口通过。提交前继续核对暂存范围、文档与 secret scan；正常 push 的 hook 仍须实际完成。

历史目录元数据扫描仍为 O(history)，响应分页不表示常数扫描；未知外部 startup 不重跑，保全及新明确操作是实际恢复合同。未执行网络注册表/外部安装脚本或本轮真实模型语义验收。与本任务无关的删除、Overlay 和其他页面文档更改保留，不混入提交。Git 提交与推送完成状态以真实 Git 记录和交付消息为准。
