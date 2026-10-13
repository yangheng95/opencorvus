# 385 权限续行所有权与消息结算修复

本轮单 agent 按[方案与Recall](../../artifacts/2026-10-05-connection-workspace-authority/permission-message-settlement-plan-385.md)修复384的两个共享缺陷：权限恢复改写live peer的Message，以及其他Tool尚未结束时过早完成Message。

恢复复用现有物理Prompt所有权，按原Message的已批准请求收敛；释放后重读新决定，覆盖并行reply与物理释放之间的交接。原权限身份上下文只包住一个恢复调用，新模型轮可合法执行自己的新工具。规范Message writer验证当前generation和全体结果后结算，等待其他Tool时保持开放，park/handoff来自整条消息；已死亡Provider的中断保持真实。

Task真实进程测试还发现已批准请求重放会重复写requested，继而把同一成功receipt误判为多次成功。首写与身份校验现已放入同一事务，读取按真实request identity计数，完整历史保留。成功续行在Message完成后才退休，Tool到Message之间退出仍可通过正式启动扫描恢复。

Mission继续使用既有process-recovery协议，先保留并消费它自己的死亡owner/frontier证据，再按原Tool结果收尾权限请求。初版实现触发的owner证据丢失已由真实双进程测试发现并修正；没有另建Mission状态机或放宽原围栏。

去重72项后台合同、289断言通过。包括真实Read/权限/数据库、受控流式协议中新的read调用、释放间隙批准、并发、live/dead进程、Task两处真实退出、Mission待批准边界、项目隔离、失败事实及Source恢复。类型检查、当前docs:check和check:architecture-index通过；23份完整日志/脚本归档解压核对通过，完整文本与归档的凭据扫描为0。完整成功与失败日志、原始状态及checker见[证据目录](../../artifacts/2026-10-05-connection-workspace-authority/permission-message-settlement-385/README.md)。

本轮没有界面修改、界面自动化、真实Sol请求、凭据复制、schema修改或用户实例重启。受控HTTP流式协议不等于真实模型端到端；真实MCP长期任务/各插件和真实Sol崩溃恢复的完整旅程尚未逐项验收，前轮明确未完成项保持。
