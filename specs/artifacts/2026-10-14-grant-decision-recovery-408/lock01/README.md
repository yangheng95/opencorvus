# 第一WAL文件锁机制原件

197 original captures，共20582581原bytes；[manifest](manifest.json)保存源地址和存储映射。gzip字节还原仅验证档案存储身份，不是功能检查。[Recall](../../../records/2026-10/2026-10-14-grant-decision-recovery-408.md)记录授权输入、真实结果和剩余范围。

lock-process-01原80885 join38ca9d exit0，28.8秒；两case/11worker和outer真实exited/0、physical/output/request全闭合，两个managed runtime正常删除。Bun1.4.0/SQLite3.53.2：actual生产cached idle和readonly idle均阻止文件exclusive，原SQLITE_BUSY/errno5；旧owner正常关闭后同handle实际backup、验证、commitv2；持锁readerBUSY，NORMAL真实访问释放后新readerfrom2/to2、旧生产v1 opener返回明确SCHEMA_VERSION_AHEAD。原完整schema/rowid/正文及backup实际readback比较保存，未写业务index。

driver和所有worker均保留原Bun tsconfig目录内部诊断，工具链尚未clean；原exit0和真实机制结果没有被重写。正在调查现启动override/cwd并准备同验收新scope重跑。双升级者、失败释放、rollback journal、alias、compiled旧runtime、历史业务迁移及UI/模型均未资格。

[original outer owner](original-run/owner.json.gz)、[driver及11原子回执](original-run/driver-owner.json.gz)、[original stderr](original-run/stderr.log.gz)、原actual sources和所有phase JSON按源名保存。cleanup-before三原像及限定patch、[UI只读完整plan](ui-preparation/production-scope-and-desktop-plan.md.gz)、初始正常commit/push原回执同步承接。原准备输入与运行结果分目录，未把expected当observed。

没有复制DB/runtime/auth/models、用户应用、私有bundle或Provider正文；不包含任何新生产修改或UI自动化验收。
