# 历史 Automation 执行轮次保留升级验收

## Recall

- 父任务承接用户要求：继续横向修复持久效果已发生但缺成功回执，覆盖删除重建、重启、并发、升级，独立子 agent 裁定。Channel 当前21项/111断言全绿后，root 明确委托本子 agent 对独立 judge 的四个真实旧 Automation 原件做当前 v7 升级/正式恢复验收，并补旧 Bus 无 delivery、phase 已完成来源的有界可读证明。
- 范围仅自有 `.tmp-product-iteration/durable-effect-receipt-audit/channel/` 探针及可交付后端测试/验收记录；不改 root 的 Automation/Bus/迁移运行代码、不动索引、不提交推送、不再委托、不操作现用服务或凭据/模型。
- 已读 AGENTS.md、父持久投递审计 Recall、Channel 恢复 Recall、独立 judge `automation/README.md`、`independent-probe.ts`、`message-case/independent-verification.json`、当前 `scheduler/automation-service.ts` 的原 Fire claim/execute/target resolution/reservation/receipt、`scheduler/project-owner.ts`、Automation 表和 root 的 PublicationRead。
- 四原件仅采用 `automation/message-case/{before,deleted,recreated,resumed}.sqlite`，均修复前真实 v6 源码生成。原控制流程是正式 runNow→真实 wake Message 提交→硬退出23；正式 Project.delete→同ID新generation；原 lease 真实到期后同 Fire 正式 SessionWake 重建原 Message/Session→硬退出24。原件读取只使用 SQLite readonly/query_only 事务，绝不应用 opener。

## 分析与验收方案

原直接触发是 Automation Run 只冻结 Project ID，删除重建后同 ID 的新 occurrence 被当作原 owner。原 wake effect 与 Run receipt 分离，重启找到/重建 deterministic Message 并不证明它仍属于原 Project occurrence。root 当前 v7 新 Run 冻结 generation；旧 Run 新列NULL，无历史证据不得按当前Project/路径/时间猜补。当前 production execution 在原 reservation 再读取原 Run，先结算 owner_unresolved，再考虑原 SessionWake，保留原 Run/Fire/Message/Session。

验收逐案：读取全部原表/原行/rowid并一致 serialize 到新隔离runtime；正式 Database.Client 6→7，核全部原字段/rowid保留和原备份完整；核旧Run generation确为NULL。通过正式 AutomationService.runDueNow 恢复原 Fire（不是新建runNow或模拟executor），要求原Run得到当前真实 disposition/owner_unresolved，原效果事实与原Run/Fire保留，lease随receipt结束；重开authority与terminal一致。

同时从真实旧源选出无Bus delivery且三phase receipt都完成的旧outbox来源；升级后走实际 PublicationRead.list/read 分页读取元数据、原属性字节和全部原phase，证明 source不是依赖pending delivery才可见。若原件没有该类来源，明确报告未覆盖，另用旧源码真实产生，不能修改原版本号或捏造旧事实。

这是后端持久化/升级验收，不是模型语义验收。新旧均不复制凭据、不调用Provider，不把旧模型引用当成要执行的授权。所有原字段比较使用真实行及rowid，不用源码摘要或自算哈希替代功能正确性。任何新明确异常交回root按共享机制修复，保留原红与修后重跑，最终由独立judge反证。

## 实际结果与独立复核

四案均由当前正式 opener 完成 v6→v7，再调用正式 `AutomationService.runDueNow`，逐案命令 exit0。原90表保留的原行及 rowid 分别为 before54、deleted46、recreated47、resumed86；原整库 backup 与实际 v6 原件一致。旧 Run 的新 generation 保持 NULL，正式执行处置为 `disposition / owner_unresolved`，不是报错挡升级。原 Run/Fire/Message/Session 在正式恢复后逐行及 rowid 仍精确一致；重开 authority 与终态保持一致，实际 Provider 请求为0。

这里的全表/全原行保留是**迁移完成、恢复运行之前**的合同；正式运行允许派生的 fire frontier 等当前状态按真实处理更新，不把派生状态误称永不变化。按独立 judge 要求，探针在正式 opener 后、runDueNow 前导出只读事务一致 `after-upgrade.sqlite`，另保留最终运行库及 migration-backups。四个 after-upgrade 原件已由独立 judge 直接读取，确认90表54/46/47/86原行及 rowid 保留，backup 全 schema/全原行与最终 Run/Fire/Message/Part/Session 也通过独立比较。

四个原件都真实存在无 delivery 且 exact/global/wildcard 三 phase 完成的 Bus 原 source。当前正式 PublicationRead 的 list（每页1项）、read（原属性4096字节页）、phases（每页1项）完整读取该历史来源，原属性字节重组与原存储字符串相同，原 owner generation 为NULL，实际每个 read 输出小于32768字节。没有借 pending delivery 推测历史可见性。

可交付探针见 [Channel验收产物](../../artifacts/2026-10-24-channel-effect-receipt-recovery/README.md)。本地逐案证据为 `.tmp-product-iteration/durable-effect-receipt-audit/channel/automation-upgrade/{mode}/result.json`、`after-upgrade.sqlite` 与 `automation-upgrade-{mode}-staged.log`。原件仍只读保存，不提交数据库、私有路径或原文。此追加范围未发现新的产品缺陷；独立升级保全矩阵已认可。

## 最终版本8复验

上述 v6→v7 是真实历史阶段。随后 Expert Squad 长期 mutation receipt 追加迁移8后，原四份 v6 master 全部保持只读，再以当前正式 opener 完成6→8并正式 `runDueNow`，四案 actual exit0。新原件在 `channel/automation-upgrade-v8/{mode}/after-upgrade.sqlite`、`result.json`，日志在 `channel/v8/automation-upgrade-{mode}.log`。迁移阶段仍逐表保留原90表54/46/47/86原行及rowid，正式backup与旧原库全schema/原行相等；恢复阶段旧generation保持NULL并真实结算owner_unresolved，原Run/Fire/Message/Session保持，Provider0；原无delivery、三phase来源仍由有界PublicationRead完整读取。独立judge已重新raw核对并认可最终8四案；旧7结果保留，不冒充当前交付。
