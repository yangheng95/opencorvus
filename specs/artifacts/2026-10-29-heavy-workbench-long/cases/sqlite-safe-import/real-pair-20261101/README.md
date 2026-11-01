# SQLite安全导入：两份真实交付及其边界

这一次完整仓库任务的fresh Codex和OpenCorvus均自然交付了实际源码、CLI（Command Line Interface，命令行接口）、文档和本地验证记录。两份未改源码在新目录进入同一冻结消费者，均native0、60函数通过，真实子进程CLI与独立SQLite数据/schema观察相符。**这不是整题满分：两者都未满足原任务无条件的“任何safe-mode失败恢复准确调用前状态”保证。** 两原交接均披露的嵌套事务全回滚边界，已由主方对相同输入实际验证。

完整原根为`D:/opencorvus-benchmark-runs/sqlite-safe-import-pair-20261101`。本轮不是作者参考、第二次候选或官方DeepSWE成绩；没有总100、强制胜负、整体模型排名或有效小时资格。总体十题/有效候选小时仍0/10，benchmark心跳保持ACTIVE/20min。

## 原任务、同输入与自然终态

来源固定`datacurve-ai/deep-swe@0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea`的`sqlite-utils-safe-import-checkpoints`，完整上游`sqlite-utils@8d74ffc93292c604d5827e2b44fffedca0c28c19`。两方同a65cd910已推冻结的95个base成员与5个公开文件，声明的独立Python3.12.14原生runtime相同。原prompt新分支要求公开改为当前main；没有私有测试、solution、参考、旧答案、Recall或凭据提供给候选。来源和平台适配不能证明污染免疫或官方Docker/网络锁定协议。

| 实际对象 | Codex | OpenCorvus |
| --- | --- | --- |
| 自然交付 | `/root/codex_sqlite_import_fresh`，fork none/无override | 原Task `tsk_g00VZikJoh00dTqYpNPB` completed，全部occurrence inactive |
| 源码commit | `cb9517ac51b56bb5292bc53eaaa0de678bb0208a` | `947ce5c177b57645747d252407d41ffc6529a58e` |
| 先封完整project ZIP | 1,528,850 bytes / 593 files | 1,171,553 bytes / 300 files，另正确SQLite backup |
| 原公开5文件 | 原字节相同 | 原字节相同 |
| 原Git状态 | clean | Inspect预存`.gitignore`改动和未跟踪`.gitattributes`/`.opencorvus`保留；功能源码已提交 |

成员数和字节只说明归档范围，不是质量/难度/工时。完整原项目、Git、生成的DB/zipapp、测试日志先封，之后才做外部评测；通用runtime外置且不纳入project ZIP。OC持久化事实中94个tool_part_request均有outcome：90completed、4failed、pending0；原失败保留，不能把Inspect的完成分当功能质量。

OC实际97次Provider请求均gpt-6.1-sol、streaming true、HTTP200。97条usage事件共9,408,371 recorded tokens，其中task lineage95条9,374,685、preflight2条33,686；cache-read9,161,344。内部cost0不是外部免费；Codex底层actual model/usage未知，因此不做同模型、同资源速度/费用因果排行。生命周期、缓存和评估侧计算不当有效活动小时。

原Task/所有工具和自有子进程终态并先封后，仅通过现有stop primitive正常释放这个新实例；server-result明确runtimeDisposed/credentialsRemoved true，2026-11-01T12:08:22.026Z结束。62289/30468/22608/16848及本轮服务退休，不再请求或重启；源auth/models未动。

## 冻结功能消费与真实源移交

从各自已封ZIP抽取原tracked源码、文档、测试及同public，保其实际实现组织；排除生成的数据库、缓存/自测结果和私有评分资料。未修改候选、添加wrapper或替换报告。两者都从这个新source目录运行原先冻结的`consume_native.py`，同一声明runtime，无新依赖下载。源码消费本身就是纯Python应用的实际重建/执行；不是冷OS、wheel或Sphinx认证。

| 预登记消费 | Codex | OpenCorvus |
| --- | --- | --- |
| Python父进程实际退出 | 0 | 0 |
| 原60函数结果 | 60pass / 0fail | 60pass / 0fail |
| 真实CLI全链 | 完成 | 完成 |
| 独立SQLite用户state差异 | 0 | 0 |
| 真实写入/错误回滚/list/validate/disable | 所测合同相符 | 所测合同相符 |

实际argv、每一子进程native码/输出、JUnit、数据库和逐项assessment保留。消费者里的历史标签`status=committed`只代表该子进程0；最终是否提交仍由用户数据确认，validate0没有被说成数据提交。原消费者不作任何交付后修正，没有把之后发现的问题倒填成原60项失败或重跑模型。

## 完整产品质量分列

| 原公开维度 | 实际结论与边界 |
| --- | --- |
| M01 checkpoint生命周期 | 两者所测enable/disable、嵌套、commit/rollback/cleanup与具名错误通过；都是连接内savepoint。直接调用者事务控制不具备恢复保证。 |
| M02 持久invariants | 两者注册/删除/list、SELECT首格和行/aggregate真实求值通过。Codex让SQLite返回行自然处理aggregate，OC用EXPLAIN识别aggregate；不因实现组织或opaque ID格式拉分。 |
| M03 原子导入 | 常规strict/non-strict、CSV/JSON、多批和DDL/user-state恢复所测通过；下述已披露嵌套全回滚会额外撤销外层先前行，原无条件保证未满足。 |
| M04 CLI | 两方六个管理命令和insert/upsert/bulk UPDATE实际工作，失败native非0，validate成功/失败均0并显示结果/ID。JSON/显式CSV合法；OC额外推断后缀，Codex文档要求格式flag，原prompt允许显式格式，不据此制造错误。 |
| M05 原有功能 | 同一普通insert/upsert、cached counts、按上游合同先删除相关index再rename列、update/delete及重开integrity均相符。未审未跑全base测试；不宣称全域回归通过。 |
| M06 完整源码/文档 | 两者集成原库并更新CLI guide/reference/API文档和HANDOFF，主方阅读新增安全实现、相关事务/CLI改动、完整交接与新增文档。两者都诚实披露事务边界，没有用复杂度或图/测试数量奖励。 |
| M07 可复现/证据 | 同声明依赖、已封源码在新目录真实执行成功。原自测和原失败保，全部自有子进程结束。缺wheel/Sphinx等未声明工具不能冒必需交付失败，也不能冒已完成对应build/render。 |

Codex原development记录471passed/1optional pandas-numpy skip，OC原43focused/114regression pass、2timing tests deselected。它们使用不同检查集合，不能当统一质量分或独立统计样本。主方不重跑两套自测/未审上游测试来凑计数。Codex额外zipapp是其真实交付，但本任务不要求wheel或同样产物数量；OC纯源码入口已由统一消费者真实执行。

## 两份交接共同披露的边界：真实同输入核查

这项核查**在交付后**由两HANDOFF及源码的savepoint处理触发，先保存`product-review-registration.json`固定相同完整工作流、独立预期和报告边界，再执行一次相同观察。不是候选前heldout/新阈值或新模型试验，也没有为了找失败换seed。

原任务要求嵌套checkpoint支持，且safe失败恢复准确调用前用户state。实际：先提交items行`(1,5)`和一个合法`RAISE(ROLLBACK)` trigger；外层checkpoint里写入`(2,7)`，内层safe_bulk_insert尝试`(3,9)`触发原SQLite错误。调用前预期由真实连接独立读取：`[(1,5),(2,7)]`。

| 同输入真实结果 | Codex | OpenCorvus |
| --- | --- | --- |
| 非strict返回 | success=false，原`scope-probe`错误，failures=[] | 相同 |
| 失败后实际用户行 | `[(1,5)]` | `[(1,5)]` |
| 调用前精确state是否恢复 | false | false |
| 外层checkpoint再finalize | CheckpointNotActiveError | CheckpointNotActiveError |
| 独立sqlite3重开物理DB | `[(1,5)]` | `[(1,5)]` |

表及trigger schema保留，问题是先前外层行也被撤销；不能把它抹成内层写入正确回滚。原因是两实现只持有SQLite savepoint；事务级ROLLBACK直接结束整个事务，之后清理失效checkpoint元数据并保原异常，不能恢复那条外层行。[SQLite冲突处理](https://www.sqlite.org/lang_conflict.html)和[savepoint语义](https://www.sqlite.org/lang_savepoint.html)解释这一观察。它不证明所有可能实现都无法满足要求；本轮没有新作者算法/快照恢复或补候选。

两方披露都正确，不能扣诚实说明或删原限制冒成功。冻结60项本身没有暴露这个原任务机制，故“参考/合法0、原候选0”只能支持有限覆盖，不能叫充分全题验收。原通过向量、这项实际缺口、来源任务可达性/协议范围须分列，不能合成两个100或简单单一失败分。

## 原件、工具问题和未满足项

完整原归档、原SQLite/Provider/tool事实源、所有dependencies/原自测、未截断stdout/stderr和source-only新目录在外部R保存。本仓库保存两原源码changes、HANDOFF/完整源码字节包、统一消费/观察结果和收据的小投影；投影scope逐成员列明，不冒全workspace。没有再次委托审查、模型/Provider调用或原候选修复。

首次root普通回归观察把有index的列直接rename，原base契约明确要求先drop该index，两原程序都正确抛TransformError；观察脚本native1并在嵌套检查前结束。原脚本/日志/DB保留，只按原base契约修观察步骤后重做相同计划，两份native0且ordinary预期相符。后者0只说明观察程序结束，上面的state不匹配仍是实测失败。一次读错不存在的helpers路径亦保工具输出；均非候选或共享调度异常。

本题实际成果对照已完成，未满足的是原无条件恢复保证、未测SQL/SQLite版本/崩溃并发与完整旧功能覆盖、独立职业/统计成熟及有效候选小时。它们不通过加时、循环自测、补代码或机械升版修成成绩。本pair不再candidate/独审/模型/重复checker；总体十题目标继续，下一须新的完整深度对象和有效产品比较。通用verification修正已实施，行为改善/根治仍未证。
