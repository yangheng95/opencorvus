# 配置保存成本与模型服务商加载反馈

本轮最终产品改动是首次读取服务商信息的中英文等待反馈。原界面在真实配置保存期间只有破折号和空白；当前版本显示实际读取状态，读取完成后恢复完整目录。使用原 Feedback 组件、原请求和作用域，未增加缓存、自动重试或第二份目录。

- [原界面等待](after-providers-during-write.png)：06:57:27.921Z，处于原真实保存窗口。
- [英文等待](final-en-loading.png)与[英文目录恢复](final-en-loaded.png)。
- [中文等待](final-zh-loading.png)、[中文目录恢复](final-zh-loaded.png)与[先询问保留](final-zh-ask.png)。
- [全部 12 张截图及人工观察](manual-ui.json)：1280×720，CUA 实际点击和截图，已人工查看；未运行 UI 自动化测试。
- [真实性能](performance.json)：原全部项目与原 10s/5s/20s 门槛保留。最终 123 项目，首轮保存 15094.236ms、恢复 14655.331ms；中文复核保存 14663.340ms、恢复 14158.764ms。并发四读均 200，最长 15260.600ms。保存与恢复性能仍失败。
- [被动调用计数](passive-summary.json)：完整原调用测量，首写 lookup 的 realpath/stat 各 28798 次，原 spawn 同步累计 4723.402ms。并发累计时间不等于墙钟。诊断 scope 带插桩，其绝对时长不是最终性能资格。
- [原进程结算与真实 Provider](native-settlement.json)：四个服务 scope 正常关闭、三个观测工具失败 scope 明确退出。原句柄、物理进程、输出、请求及 launcher 均结算；总计 8/12 个实际 gpt-6.1-sol 流式请求，均 200/eof。失败工具的空 audit 不冒充成功预检。
- [只读历史核对](history.json)：schema 2，123 Project/165 Session，七份原快照的全部身份、归属和目录保留；[七套私有复制对已退休](private-pair-retirement.json)。原 canonical 完整 parsed 对象恢复，Ask 保留。

扫描有界并发实验的 18 例/29 断言及类型检查通过，但完整无插桩保存 13453.278ms、恢复 15675.397ms，没有稳定总收益；精确撤回生产实验与其专用测试。归档 [实验前失败](test-scan-before.log)、[实验后局部通过](test-scan-after.log)仅解释取舍，不宣称该实验交付。最终后端与原实现相同。

最终正式前端构建见 [build](ui-build.log) 和 [typecheck/两语言校验](ui-typecheck.log)。它们不能替代截图验收。未在本轮重新验收新 Task Goal 执行、原生目录 picker、Sources 或侧 agent 直播 Rendering；完整配置保存性能继续待修。
