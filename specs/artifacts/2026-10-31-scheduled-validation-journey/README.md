# 计划任务校验实页证据

对应[根因与方案](../../records/2026-10/2026-10-31-scheduled-validation-journey.md)。单agent操作两个独立原生开发服务的 `/ui`，桌面1280×720隐藏内置页面；下列18张截图均实际呈现并人工查看，没有运行UI自动化测试。

修复了日历错误直接露出英文异常和`API 400 … undefined undefined`的问题。现在本地化摘要解释需要检查的日历字段，提交失败后焦点进入该摘要；完整机器原文保留在现“详细信息”中。英文和中文均实际覆盖缺少锚点、本地校验通过但后端拒绝的无效频率、输入保留、详情展开。中文实际修正为2099规则后保存/暂停，并覆盖同一ID编辑失败、取消、重开和再保存。

| 截图 | 实际画面与用途 |
|---|---|
| [01](01-before-scheduled.png) | 基线计划任务入口与原空列表 |
| [02](02-before-anchor-error-en.png) | 英文基线直接显示机器错误 |
| [03](03-before-rule-error-en.png) | 英文基线直接显示API400和undefined诊断 |
| [04](04-before-anchor-error-zh.png) | 中文基线仍露出英文机器错误 |
| [05](05-before-rule-error-zh.png) | 中文基线仍露出英文API错误 |
| [06](06-before-corrected-paused.png) | 基线修正为2099规则、实际保存并暂停 |
| [07](07-after-anchor-error-en.png) | 修后英文本地校验摘要和折叠Details |
| [08](08-after-rule-error-en.png) | 修后英文后端拒绝摘要与保留的名称/规则 |
| [09](09-after-rule-details-en.png) | 英文展开HTTP、Request ID、堆栈与原响应 |
| [10](10-after-anchor-error-zh.png) | 中文本地校验修正说明 |
| [11](11-after-anchor-details-zh.png) | 中文页面展开原本地Error诊断 |
| [12](12-after-rule-error-zh.png) | 中文后端拒绝摘要和保留输入 |
| [13](13-after-rule-details-zh.png) | 中文详情保留原400响应与原无效规则 |
| [14](14-after-corrected-paused.png) | 修正为2099/COUNT=2后保存并暂停 |
| [15](15-after-edit-error-preserved.png) | 编辑提交失败仍保留未保存的新名称和规则 |
| [16](16-after-cancel-original.png) | 取消后显示原名称、原提示词和COUNT=2 |
| [17](17-after-reopened-original.png) | 重新编辑恢复原已保存字段 |
| [18](18-after-edited-paused.png) | 同一ID保存新名称、提示词和COUNT=3，仍paused |

[verification.json](verification.json)记录冻结入口、检查、数据和运行结清。两个真实400 writer辅助检查均返回InvalidAutomationRecurrenceError及精确原输入，前后已存定义保持；它们不是网页或视觉验收替代。取消编辑前后的完整公共定义相等，最终保存仍同一ID、当前第3版；基线定义各字段保持。

schema9/92表，216584→216589→216595，全部原行各列保持。增量是两个本人定义的5条版本、两个2099年未来发生槽及两次runtime activation lease/grant；未来Fire不是实际执行Run。75附件、十三Git项目/28 tracked、十三+三十九旧文件、空QA22原文件及828三份D107/D107/E128完整；全部原Task/Mission/Chat/Work、Goal、Sources和报告公共响应保持。

两个服务均public shutdown200，原exec/native/launcher退出0，物理/输出/请求/OS出生身份结清，四个配对auth/models副本清退，源元数据及模型目录原字节保持。模型新增0、累计1118；用户18571和真实用户数据库未操作，schema未变，没有迁移或版本发布。前端build、typecheck、两语言2671键及docs检查通过。

实际范围为桌面日历作者流程；列表、Provider、历史、运行、删除和结果打开等其他错误摘要调用点已按同一表示代码复核，没有声称对其全部进行了新实页故障注入。不提交认证或原业务全量快照。
