# Provider Test 证据

对应[第13批方案](../../records/2026-10/2026-10-14-provider-test-observation.md)。用户要求停止全部子agent后，Root独立复核实现、重跑检查、操作真实`/ui`及亲自查看全部24张桌面原图。最终84项正向业务/后台合同、219断言通过；类型、SDK生成与Node最终构建通过。详见[原回执](qualification.json)。

`previous-batch-delivery.json`和`previous-batch-push.log.gz`承接第12批实际提交/索引结算/上游同步/全部正常hook及push0。两个独立agent报告保留完整源码与历史边界；第13批调查不反写第12批交付事实。

`inputs/`保留执行输入、初始审计与Root核对的共享机制横审。`checks/`保留原始退出码及完整压缩日志，包括旧合同、部分流fixture期望、错误TypeScript路径与文档再生成失败。修正后重跑原checker，不把失败隐藏为通过。

`runtime/before/`与`runtime/after/`分别保留实际authority、完整配对目录projection、preflight、Provider observer、公开前置合同、正常物理退出、完整pair清理和实际凭据字节安全扫描。前态3条、后态6条真实`gpt-6.1-sol`请求都为streaming HTTP200/reader EOF；两次preflight各实际产生memory与chat两条请求。其余是页面Test，原直接Test合同没有Session context。两个完整原日志集合在实际flush/exit后扫描，归档只用已脱敏副本；Auth/models原凭据文件不入库。

`screenshots/`包含5张前态与19张后态原图。Root亲自验收空声明继承、英文/中文实际模型回复、零模型HTTP400原错误、长诊断展开/收起、接受配置/Key后的观察退休、真实Sol在途保存、项目Test、目标模型刷新与其他结果隔离、全目录刷新、返回全局，以及实际接受的自有样例删除。原生Details已通过Enter/Space操作。长诊断HTTP参加者仅资格受控真实网络输入和页面布局，不当第三方认证或Sol成功。

原图名称不替代事实：`after-inherited-testing-en.png`捕获时已是成功；`after-sol-accepted-save-retired-zh.png`仍是Saving表单，完成行见`after-sol-completed-save-row-zh.png`；`after-project-delete-retired-zh.png`是确认超时的失败资格，原结果仍在，后续`after-global-delete-accepted-zh.png`才是真正接受的删除。

在途证据见`runtime/after/inflight-save-observation.json`：全局配置实际mtime1791925065620.5562处于原Solreceived1791925065287与EOF1791925066376之间，随后公开200读取到新名称且真实行保持已接受配置。`route-facts.json`只从完整原server日志派生，保留两scope实际Test路由及结束码，不伪造请求关联。

未资格范围明确保留：fresh OAuth认证变更、不同Provider同时在途、在途删除重建或Key保存、重启/authority替换/完整多项目共享调度与capacity矩阵、外部窗口配置传播。已有源码横审不是这些矩阵的运行证明；持续迭代下一批优先处理余下验收，再选择自动ID候选。本批不宣称整个产品验收完成。
