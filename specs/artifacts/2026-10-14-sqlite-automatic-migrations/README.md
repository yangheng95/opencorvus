# 当前 SQLite 基线与未来自动迁移证据

方案与最终范围见 [实施记录](../../records/2026-10/2026-10-14-sqlite-automatic-migrations.md)。只使用单 agent，没有模型请求、凭据复制或 UI 自动化。原数据已按最新用户要求移入回收站；未承接版本0历史兼容。

- `old-data-removal.json`：10个原库/关联/实验副本文件的可恢复删除回执，合计581288592字节；没有数据库内容。
- `new-baseline.json`：通过生产 Database 入口建立的用户空库，版本1、Project/Session/Message/Task各0，凭据、配置和源码保留。
- `final-storage-tests.log`：最终20项迁移及14项现有schema合同通过；第三个命令误用不存在的transaction.test.ts，明确exit1。该命令错误由下一个独立日志纠正，不能把本日志称为整体成功。
- `final-transaction-tests.log`：正式runner执行正确的database-transaction-contract.test.ts。
- `data-contracts.log`：关联9套数据检查，前8套通过；Tool-result套件原2项断言与已经扩展的worker事实不一致。失败原文保留。
- `tool-control-after.log`：第一次修正验证了重复恢复相同，但误把正常追加的stale结算视为完全不变；两个失败保留。
- `tool-control-final.log`：按真实协议核对原请求/结果保留、唯一stale结算和重复恢复精确一致后的重跑。
- `final-typecheck.log`：包括新增数据库迁移checker的正式typecheck。
- `checks.log`：文档与架构检查结果。
- `compiled-check.log`：独立编译并运行迁移checker，验证SQL基线确实进入可执行文件并与当前对象一致。
- `storage-after-review.log`：删除已退役schema哈希辅助函数后的最终20项迁移、14项schema合同复验。

SQLite真实专项覆盖：当前完整schema及身份、生产开库/复开、版本0准确错误、1→2升级、显式改名、增加默认列、真实对象更新、外键关联、复合主键、Unicode/blob/rowid保留、WAL备份、唯一约束/业务校验失败原子回滚、较新版本保护、独立库隔离、同库真实多进程创建/复开/升级、强制中断自有子进程后的恢复、备份失败后重试。运行用户应用与模型未参与这些隔离测试。

日志从执行目录复制，仅统一换行并清理行末空白；没有省略失败或修改测试输出。早期版本0迁移实验已被用户最新基线要求取代，不计入最终升级验收，也未恢复已移除的旧数据。

冻结SQL基线保留原DDL三处行末空白，因为SQLite保存的对象定义也是迁移精确校验的输入；不为格式检查改写已建立的基线。其他本批文件通过diff空白检查。
