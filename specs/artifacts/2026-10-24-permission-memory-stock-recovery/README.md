# 旧权限记忆恢复的原件审计与升级证据

[方案、边界和验收](../../records/2026-10/2026-10-24-permission-memory-stock-recovery.md)

- `evidence.json`：只读存量汇总、隔离真实升级和故障/并发结果；不包含原用户正文、凭据或真实数据库副本。729个路径包含大量克隆，不能当作729个独立用户。
- `upgrade-probe.ts`：从指定原SQLite只读一致快照创建自有测试库，经正式Database opener升级；逐表、逐原行和rowid核保留、逐原备份核相等，再经真实Bus和Organizer提交路径及新human Message核恢复。它不运行模型，Organizer提交验收不能冒充真实语义生成。
- `concurrent-probe.ts`：在同一受控gap快照上注入prepare后真实事务异常，核90张表3044行整体回滚和原备份，再启动三个真实开库进程，核同一个当前数据库、1个inbox/1个success及两个原件备份。
- `old-source-probe.ts`：放入原v4源码package，用旧真实HTTP/Bus/Organizer事务生成受控缺回执状态。`old-pending`捕获后改Task标题且在receipt前退出；`old-covered`消费后在receipt前退出；前序`old-gap`还消费501个后来输入。退出23是明确故障切点，不是自然用户事故。
- `old-project-deletion-probe.ts`：在同一原v4源码中真实Project.delete，保留原数据库与原清理manifest；`old-project-recreated`随后实际重建同ID项目并接收新human Message；`old-project-subdirectory`先注册父项目和子sandbox、在child产生原回复、释放子sandbox再删父项目。没有改原publication来制造目录身份。

探针使用package别名，执行前复制到`packages/opencorvus`，完成后删除该临时副本。`upgrade-probe.ts <absolute-original.sqlite> <absolute-owned-evidence-directory> <gap|ready|pending|known-covered|covered|business-v3|business-v5|default-v3|project-retired|project-recreated|project-descendant|project-wrong-directory>`；Project模式需同原SQLite相邻的原`project-deletion-cleanup`，重建与子目录模式还核同目录`before.json`。`concurrent-probe.ts parent <absolute-gap.sqlite> <absolute-owned-evidence-directory>`。原v4源码来自前序受控快照`permission-upgrade-old-source`，不能在当前v6源码运行旧状态生成器冒充历史。

旧源码生成器用`old-pending|old-covered|old-project-deleted|old-project-recreated|old-project-subdirectory`和绝对自有证据目录。运行前将`OPENCORVUS_PROCESS_SUPERVISOR`明确绑定本地已验证的native helper绝对路径（本次使用当前仓库既有helper），防止旧源码尝试重新构建；无服务、凭据或模型用途。

严格子目录结果来自`project-strict-descendant-current`，不是早先仅嵌套命名、实际独立根的样本。`project-strict-prefix-current`只修改自有manifest，登记根basename少一字符，核startsWith为真且相对路径越界，验证正式完整性错误和原库/备份保全。并发首次结果包含一次实际SQLITE_BUSY；全部初始进程退出后由新进程重开该调用者，最终三个读取者同identity、v6、一次恢复。初版checker的错误覆盖声明和红日志均保留在私有证据目录，未计为最终通过。

原件只读审计报告及全部诊断日志留在仓库自有ignored目录`.tmp-product-iteration/permission-memory-stock-recovery/`。报告对原目录逐路径使用SQLite readonly/create=false/query_only事务，未通过应用初始化、恢复器或HTTP。默认用户库、保留业务运行、工具探针、受控案例及备份分别记录；实际业务命中0，受控gap同一publication的原库/快照/三备份共5份命中。没有恢复不可证明的旧消费事实；未知输入只声明本次实际重登记。
