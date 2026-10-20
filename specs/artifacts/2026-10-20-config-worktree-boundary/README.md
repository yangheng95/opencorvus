# 配置快照的真实工作树边界

450单agent证据，见[方案与Recall](../../records/2026-10/2026-10-20-config-worktree-boundary.md)。

- `before-contracts.log`：原代码4个实际失败。普通子目录因误用父Git边界而报NonCanonicalConfigFileError；损坏local.git未给出错误；Git缺失返回普通Error/500。
- `after-contracts.log`、`regression-contracts.log`：51个正向后端用例/149断言、2个POSIX特殊路径skip，覆盖明确边界与错误、main/linked/alias、配置层级、所有Project候选、Skill来源、物理身份及原lease保留。
- `results.json`与`after-cost.json`：完整88项目性能轮次，实际gpt-6.1-sol流式预检、25个全部真实并发GET、完整canonical恢复及原native物理/输出/请求/launcher结算。baseline来自已交付449的87项目完整轮次，未重写历史结果。
- 冷保存16.790→13.159s，恢复17.368→12.380s；本轮最长并发GET10041ms、全部HTTP200。10s/5s保存门槛仍失败，页面读取20s门槛通过。页面请求到达由真实手动交互决定，不把不同轮次的请求等待差直接当作全部代码成本。
- `http-boundary-contract.json`：性能日志冻结后，同一真实服务补测普通child及其配置dynamic/full_access的父Git目录。GET/config、全局保存、GET/config、恢复均200，子项目仍base/ask，完整canonical还原。新增父fixture和child保留于原QA历史根，最终只读数据库为89项目/schema2。
- `after-home.png`、`after-chat.png`：真实页面交互及人工视觉复核，Goal入口、实际OK、精确模型和Ask可见。没有UI自动化、截图基线或像素断言。
- 类型、格式、文档、架构索引与OpenAPI路由检查日志保留。`private-pair-retirement.json`记录全部原句柄结算后完整临时auth/models配对退休；源授权metadata保持，归档文本已扫描实际敏感值。

本轮没有验证POSIX平台分支。保存性能仍未达原门槛，持续迭代目标保持active。
