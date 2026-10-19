# 配置保存与首次能力初始化证据

[Recall与验收合同](../../records/2026-10/2026-10-20-physical-identity-scan.md)。只保存选定真实请求、阶段、正向合同与物理结算；凭据、数据库和完整Provider正文不入库。

- [真实结果](results.json)：扫描实验已删除；两个配置初始化循环修复。最终64项目保存/恢复成功，23.46s/21.45s仍不满足性能门槛；本轮concurrent page read尚未合格证明。
- [聚焦合同](validation.txt)：36例/88断言，包含两处修复、既有peer顺序、失败重试和credential恢复。
- [before首页](01-before-home.jpg)、[异常关闭后页面](02-unsettled-home.jpg)、[最终真实首页](03-verified-home.jpg)、[Goal说明](04-verified-goal-help.jpg)：人工真实IAB交互及视觉复核，无UI自动化。第二张记录异常后的离线状态，不作为保存中网络状态证据。

四个自有native occurrence均物理、输出与请求结算，运行凭据成对退休。after/final因公开关闭时listener timeout而exit1，before/verified正常exit0；失败不能标成正常关闭。原after username快照没有持久，恢复依据的限制详见Recall；final与verified都有完整私有快照。持续goal仍active，不宣称整体验收通过。
