# Task 成员来源与 live epoch 证据

见[Recall、根因与结论](../../records/2026-10/2026-10-22-task-source-epoch.md)。单agent；本批修复私有观测器的cleanup响应式读取自扰，没有修改产品渲染实现。真实已完成Task的成员历史、同epoch空delta、同页断线恢复和旧epoch接管已复核；不扩展为全部活跃流式场景通过。

| 证据 | 范围 |
| --- | --- |
| [完整结果](result-observation.json.gz)、[资源摘要](resource-summary.json) | 5自有scope/10次实际Sol/20份配对退休、17实图与边界；全部原句柄exit0、shutdown200及物理结算。 |
| [原真实snapshot/delta检查](before-task-read.json)、[新进程旧epoch检查](after-task-read.json) | 当前生产parser/merge处理真实HTTP；原3消息、5542字元正文与ACL Source身份保持。 |
| [原自扰错误](05-workspace-error-details.png)、[实际重入栈](diagnosis/retirement-console.json.gz) | 诊断读取props.streaming触发失效Show/Index清理重入，不能算产品故障。diagnosis/builder是实际故障取证历史；根目录与corrected/builder使用修正后的当前观测合同。 |
| [正常退休](corrected/corrected-retirement-console.json.gz)、[实际新聊天](corrected/03-corrected-navigation-home.png) | 诊断退休只读普通快照；3正文/3Part/Source/group各一次正常释放。 |
| [正确恢复前](corrected/04-source-recovery-baseline.png)、[真实Offline](corrected/05-source-offline.png)、[原页自然恢复](corrected/06-source-natural-recovery.png)、[旧epoch接管](corrected/07-source-new-epoch.png) | 原正文owner6/7/8、Source owner2、读位0/6739/577持续。原页144不刷新；显式列表/详情后才实际请求成员旧epoch。 |
| [连续事件窗口](corrected/after-final-console.json.gz)、[恢复前](corrected/before-browser-observation.json)、[接管后](corrected/after-final-browser-observation.json) | 20→28→60→65精确前缀保留；截图为人工复核，JSON只是观察事实，不是UI自动化测试。 |
| [正式Sources](corrected/08-formal-source.png)、[默认页](corrected/09-formal-home-goal.png)、[使用说明](corrected/10-formal-goal-help.png)、[创建表单](corrected/11-formal-goal-create.png) | 独立145页真实载入无诊断正式构建。Goal入口→帮助→创建表单/初始焦点实际查看，未提交新Goal。 |
| [数据536](data-preservation-observation.json.gz)、[定位副本](diagnosis/data-preservation-observation.json.gz)、[最终副本](corrected/data-preservation-observation.json.gz) | 每scope90表/全部原行、源bytes/mtime、schema3、canonical保持；原2条容量租约自然更新。全DB与原行快照不提交。 |

时间均为UTC（Coordinated Universal Time，协调世界时）。初始01截图实际位于长文尾部，02才是来源区；两者不混称。corrected页144从Home URL启动时实际恢复保存Task，不冒称与141无保存偏好分支完全相同。所有17张归档图均实际呈现并人工查看，未运行UI自动化测试。来源题名、原用户/模型正文保留真实原文，产品界面使用当前en-US语言。当前没有非空自然delta，没有新业务输入/Task/委派或Goal执行；这些仍是后续资格边界。
