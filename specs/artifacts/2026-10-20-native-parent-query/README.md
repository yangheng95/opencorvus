# Windows 父进程查询与 owner 拒绝的结算

对应[Recall、官方依据、共享审计及实施前方案](../../records/2026-10/2026-10-20-native-parent-query.md)。[完整结果](results.json)保留35个用例、实际helper路径、完整请求及原生结算。

原helper为读取自身父进程而枚举全机进程。改为动态绑定系统点查询，保留SDK结构、状态/长度/自身PID和原owner PID/出生时间验证；后代终止仍读取其真正需要的进程图。系统查询失效时明确拒绝，不增加备用查询或新协议。

同时修复owner PID/出生时间等目标创建前的拒绝未发布原终态事实的问题：一个准备边界统一发布精确的target_not_created/active0事实，原错误及发布错误完整保留。原生正向用例先失败，修复后两种owner错误与真实请求事实精确匹配；实际Process入口保留原错误并完整结算，然后成功执行下一条正常命令。

- [12次真实点查询诊断](probe-samples.json)：24.7–42.8微秒，对比同进程独立Toolhelp全快照21744.3–25168.5微秒，父PID均一致；不是完整保存性能资格。
- [原native失败](before-native-contract.log)、[最终6个原生用例](native-contracts.log)、[后端合同](backend-contracts.log)、[最终owner/control-plane合同](control-contracts.log)：去重29个后端用例、72条后端断言，加6个原生用例。
- [原构建故障](backend-build-failure.log)、[精确缓存修复](cargo-cache-repair.json)：用锁文件的官方不可变发布包身份确认缺失模块，再由Cargo重新提取并重跑原checker；无cargo/rustc运行时才隔离该仓库的临时缓存目录。
- [发布构建](release-build.log)、[类型检查](typecheck.log)、[只读数据](data-verification.json)、[私有授权对退休](private-pair-retirement.json)。

完整78项目、初始loaded2，真实生产Config service→HostTransport→HTTP：冷保存19395.34ms、恢复5234.71ms、保存中真实GET16166ms/200，canonical完整还原，Ask保持。原10s/5s性能门槛仍 **failed**，不以点查询快、样本数/构建条件变化或部分合同通过宣称整体提速。schema仍2、78项目历史保留。

实际gpt-6.1-sol流式预检、[完成会话截图](after-chat.png)及[恢复后首页](after-home.png)均由真实页面人工检查；没有UI自动化。本批原生/后端原句柄全部结算，临时授权对退休，源授权metadata未变。完整开发日志、配置与Provider正文保持私有。

[归档路径修复](archive-path-repair.json)记录collector误写旧artifact目录后的完整保存与精确恢复；旧445证据已恢复原提交，本目录保留真实446输出。
