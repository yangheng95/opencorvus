# L04迁移能力微型构造（未冻结重型题）

这份输入先验证已有数据迁移/原子切换能力，不是正式数小时L04。所有数据是明示合成。`v1.sqlite`为关闭连接后的真实输入库；`v1-schema.sql`是其实际DDL导出，`authority.json`是唯一权威身份映射，`provenance.json`说明环境。只以该映射认定客户，不以邮箱/姓名合并。两个不同权威客户可同邮箱，两个旧ID也可合法指向同一客户。

schema_migrations最大version是唯一当前schema版本；control.epoch是写者generation。本输入version1/epoch3。legacy_writer.py只支持v1，它BEGIN IMMEDIATE后先检查epoch，再提交legacy_entries及write_receipts，只有commit后才返回accepted。相同op_key/相同完整请求返回duplicate及原收据，不同载荷返回operation_conflict；旧epoch必须返回stale_epoch/current_epoch。迁移后不让旧写者取得新token来继续业务。

两个当前写入口共用l04_request.py。请求必须为JSON对象，op_key/entry_id是非空、非仅空白的字符串，epoch为非负64位整数，不能用null/bool替代。v1 customer_id为64位整数、amount为非空原文字符串；v2 customer_key为非空身份，amount_minor为有符号64位整数、fee_minor为非负64位整数。currency为USD/CNY，reversal_of若非null须非空身份；未知字段不接受。身份/类型错误返回`invalid_request`和`field`，坏JSON为field `$json`，不是一次accepted操作。v1库仍保留原历史schema，不能改写输入来隐藏旧缺陷。

目标v2使用customers(customer_key/display_name/email)、customer_aliases(legacy_id/customer_key/raw_json)、entries(entry_id/customer_key/currency/amount_minor/reversal_of/fee_minor/legacy_raw_json)和quarantine(kind/legacy_key/reason/raw_json)。客户、entry及别名身份唯一；真实外键连接客户/退款。fee_minor为非负整数，新写允许非零，不能丢失这个v1不可表达字段。金额为USD/CNY两位最小单位：旧字符串格式为`-?[0-9]+(?:\.[0-9]+)?`；允许0，最多两位小数，精确转换、禁止float近似/隐式舍入。

未映射或不存在的客户为unmapped_customer；格式错误金额为invalid_amount，超过两小数为amount_scale，不支持币种为unsupported_currency。非负普通记录无reversal_of；负退款须引用有效正金额原单且同客户/币种，原单不能再是退款，否则invalid_reversal。隔离保留完整原行及稳定身份。有效客户别名/entry也保留raw原行，不能因规范化损失源信息。

版本1迁移史、write_receipts、audit_events全部保留；历史trigger产生的每个audit event是已存在的事实，迁移复制不能再制造一轮业务audit。新v2写应产生一次source_schema2 audit，重复op返回原收据。允许用事务暂停写入，迁移应将全部数据/目标约束、一次version2记录和epoch递增共同提交；重试已完成升级返回already_current、保留原epoch。

v2持久表的客户/entry/op字符串主键需显式NOT NULL及非空约束，不能只依赖SQLite普通TEXT PRIMARY KEY。已有NULL/空op收据无法凭空恢复稳定幂等身份，返回unresolved_receipt_identity；已有空entry身份返回unresolved_entry_identity；这两类应中止升级并保留原版本、epoch和全量源数据待对账，不能猜造身份或假报升级完成。合法已有收据在v2约束升级事务中原样保留。

建设性接口为JSON stdout CLI，upgrade接db/authority，write接db/request，get接db/entry ID，receipt接db/op_key。v2 write字段：epoch/op_key/entry_id/customer_key/currency/amount_minor/fee_minor，reversal_of可空。合法写返回accepted，重复返回duplicate，冲突返回operation_conflict，旧token返回stale_epoch/current_epoch。get返回ok/entry，receipt返回ok/receipt；数据/SQLite约束错误需具名。

评估侧控制的故障类别是本地子进程在before_commit或after_commit的中断、升级后响应丢失、切换期间旧token写入。参考调试接口`--pause-at`仅在真实提交前/后输出checkpoint(name,pid,transaction_open)并等待stdin换行；评估者读取独立数据库事实后只终止该自有进程。允许其他同等可观察故障接口，正式题冻结前将单一化完整执行合同。不是任意断电、内核/网络文件系统故障或零停机保证。

当前只使用本地SQLite rollback journal DELETE和synchronous FULL。迁移中断前提交的ACK必须在恢复后仍可按entry/receipt读取；不能用旧备份替代升级后数据。此小构造不提供已批准的降级/完整运维政策，不计小时级或十题完成。
