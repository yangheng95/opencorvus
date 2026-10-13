# SQLite 当前基线与后续自动迁移

## Recall

用户要求「以后数据库schema要自动迁移，防止数据兼容性导致打开失败」，随后明确「你先把旧数据都删了，从当前版本开始做迁移」。最终支持范围为当前版本新建的版本1基线及之后的版本化升级；不承接未登记版本的历史数据库。只使用单agent，无委托。前一轮MySQL转换逻辑删除已由71b155a3ef28cc28b617395536c31f5a43266cbe正常推送main；本轮不恢复该能力。Sources视觉问题保留在持续迭代目标中，本批优先完成用户明确的数据要求。

验收指标：原旧库从运行路径移除；新用户库由生产Database入口创建为版本1，Project、Session、Message、Task均为空；凭据、配置、项目源文件保留。未来版本升级在业务访问前完成，保留原行和身份，升级前备份，失败或进程中断后保持可恢复状态；同库并发开库收敛，独立数据库隔离。新库、当前库复开、未来结构及语义升级、外键与业务校验、版本保护均需真实SQLite与生产入口证据。

硬约束：不停止用户进程、不创建额外分支或工作树、不使用或记录凭据、不启动模型、不增加兼容reader或自动reset；不执行UI（User Interface，用户界面）自动化。后端验收走正式测试runner；完成范围提交、fresh fetch/merge、待推送集合审查及正常push，保留其他任务的工作区改动。

已读AGENTS、Database.Client/init/close/reset/数据完整性检查、schema-contract、schema注册与DDL（Data Definition Language，数据定义语言）、当前02-data/task-control-plane、安全权限和专家团架构、schema-contract测试、CLI（Command Line Interface，命令行接口）初始化与import/export入口。全仓检索SCHEMA_RESET_REQUIRED、DATA_RESET_REQUIRED、迁移/备份、错误投影与调用点。各服务、CLI与子进程均经唯一Database入口打开规范路径。没有公共接口形状变化，只有明确错误码更新。

权威依据：[SQLite ALTER TABLE](https://www.sqlite.org/lang_altertable.html)、[事务](https://www.sqlite.org/lang_transaction.html)、[备份](https://www.sqlite.org/backup.html)、[Bun SQLite序列化](https://bun.sh/docs/runtime/sqlite)。变更表使用新表→显式复制列→删除旧表→重命名；不用writable_schema。版本与数据在同一事务提交。

## 根因、影响面与边界

旧Database.Client先只读比较所有sqlite_schema对象，任一差异即SCHEMA_RESET_REQUIRED。没有版本与升级步骤，新增索引/触发器也使数据库打不开。仅CREATE IF NOT EXISTS不会更新现有对象；跳过校验也不能保证数据语义正确。用户最新要求确定一次性重建当前基线，此后升级由版本化迁移负责。

共享影响面包括全部Database入口、物理数据库身份、消息/工具/来源数据、附件命名空间、FTS（Full-Text Search，全文检索）派生对象、Task/Mission/Session执行事实、跨进程启动及重启。升级在业务恢复前完成，不运行Task或修改调度轮次；不改变终态、队列、唤醒协议。以真实多进程开库、竞争升级、中断后恢复及独立库测试审计存储共享机制。界面布局、Provider和模型协议不在本批修改范围。

未登记版本的旧库、比当前应用更高的版本、未定义的有损转换、真实数据损坏返回准确错误并保留数据，不猜测或伪造权威。未来发布必须提供基线之后的完整迁移链；当前版本同一版本号下的意外schema漂移仍需修正声明或数据。

## 最终方案

1. 唯一迁移registry从1连续编号，以PRAGMA user_version记录已完成版本。0001-baseline.sql冻结当前物理schema；未来结构或持久数据语义变更追加版本，已交付版本不可改写。当前runtime schema仍为唯一reader/writer事实来源。构建和typecheck调用同一个checker，对比最后迁移目标与当前实际SQLite对象，防止忘记声明迁移。
2. 新库在事务中直接建立当前DDL和最新版本。现有库BEGIN IMMEDIATE取得writer后重读版本；同库并发者加入已完成升级。非空版本0返回SCHEMA_BASELINE_REQUIRED，高版本返回SCHEMA_VERSION_AHEAD；没有历史收编路径。
3. 对支持范围内的旧版本，在同一锁定快照serialize完整SQLite，写入data/migration-backups临时文件、fsync后重命名。包含WAL（Write-Ahead Log，预写日志）中的已提交行；备份成功后才更新结构和数据。
4. 所有待执行版本及最终schema、外键和现有业务数据校验在一个事务。每版声明完整目标DDL；可选同步语义迁移先处理明确的改名或格式转换，再按目标重建对象。共同列、类型及rowid完整保留，新列仅使用目标默认值；无法保证保留的变更要求显式迁移。失败回滚并报告备份位置，进程中断由SQLite恢复后重试。
5. 数据完整性守卫继续保护真实事实；错误改为DATA_MIGRATION_REQUIRED或DATA_INTEGRITY_ERROR，移除要求用户抹库的兼容性文案。显式管理员reset合同仍存在，正常开库不会自动reset。
6. 当前架构及AGENTS记录新演进原则；更新受影响后端合同和聚焦正向测试。无UI变化，不宣称界面验收完成。

## 已执行数据维护

批量永久删除被自动审批以blocked by policy拦截，未执行。随后按用户授权将原库、SQLite关联文件及本轮历史副本/备份共10文件、581288592字节移入Windows回收站，保留可恢复性；未永久擦除。删除前原库三个文件可获取独占文件句柄，未停止任何进程。原运行路径由生产Database入口创建新库：版本1，四类业务行数均0；凭据和配置未修改。

执行回执位于.tmp-product-iteration/sqlite-automatic-migrations/old-data-removal.json、new-baseline.json；新库初始化脚本不可重复用于已有数据。早先未登记版本历史库升级调查已被最新用户要求取代：实验曾验证90表279411行精确保留，相关旧库已按要求移除；这一实验不代表最终产品支持历史升级，不纳入最终升级验收数。

## 验证与状态

实施和基线维护已完成。20项迁移专项通过，其中包含完整当前schema的未来升级、物理身份保留、外键与复合键。14项现有schema合同、6项事务合同、120项相关数据合同和36项Tool-result协议检查通过，共196项不同后端用例。测试通过正式package runner执行，包含真实多进程及中断恢复，不冒充UI或模型端到端资格。

复核发现旧只读探针删除后，schemaObjectFingerprint/currentSchemaFingerprint/hasApplicationSchema/findSchemaDrift只剩测试或旧文档引用，已同步删除过期辅助路径；现有明确对象与字段行为验收保留，重建schema直接比较SQLite定义。当前文档与旧整改方案同步采用版本化迁移。

关联回归的两项原失败来自已提交e08017392扩充了worker快照的requestFacts/resultFacts/toolRequest，但父测试仍对旧对象做全等判断。真实assistant、Tool outcome和effect计数已正确；修复断言后进一步验证已有事实保留、唯一stale结算以及两次恢复全量事实一致。第一次补充断言误把正常stale追加当作完全不变，原失败保留；最终36项通过。没有改调度或权限生产逻辑。原命令误写不存在的storage/transaction.test.ts，已更正为database-transaction-contract.test.ts并6项通过；不把命令错误算作产品失败或成功。

根目录typecheck（8包）、docs:check（345操作/26组）、check:architecture-index（19文档）通过；迁移checker已编译成独立可执行文件并实际运行通过，证明SQL基线随包进入执行环境。最终证据见[验收入口](../../artifacts/2026-10-14-sqlite-automatic-migrations/README.md)。无版本发布、tag或安装包更新；准备范围提交与正常推送。
