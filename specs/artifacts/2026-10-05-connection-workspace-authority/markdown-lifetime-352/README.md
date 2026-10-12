# 352 长子会话 Markdown 生命周期

[Recall 与完整调查](../markdown-lifetime-plan-352.md)。本轮确认同一子会话隐藏/返回会销毁、重建全部正文；未修改正式渲染机制，未宣称原长期流式闪烁已解决。

## 直接实证

沿349真实完成历史：37份独立assistant正文、36次网页来源。隔离页145使用当前开发服务18332/ui和临时诊断构建main-BeV-vxc6.js，没有新模型调用、假消息或修改数据库。

| 画面 | 实际观察 |
| --- | --- |
| [01首次进入](01-first-open.png) | 冷载入时可见多处Rendering占位 |
| [02完成渲染](02-first-open-settled.png) | 已呈现完整末段R36 |
| [03早期阅读](03-early-prose-before-close.png) | 原生Home回到前言和R01 |
| [04 Dock重开](04-first-dock-reopen.png) | 截图时早期正文已经呈现 |
| [05成员列表返回](05-agent-list-return.png) | 截图时正文已呈现，读位保持 |
| [06任务返回](06-task-return.png) | 从真实预检Session返回原Task，子面板尚未打开 |
| [07再次打开child](07-child-after-task-return.png) | 截图时前言/R01已呈现 |

7图均实际呈现并人工查看；[动作时间](action-times.json)、[截图时间](screenshot-times.json)与[实际生命周期汇总](diagnostic-summary.json)分别保留。没有自动截图循环、DOM/组件/源码或像素断言。

| 动作 | 真实模型记录 |
| --- | --- |
| 首次child打开 | 37份正文排队，空模型到首块96—652ms |
| 关闭Dock | 同时dispose37个正文owner |
| 再开Dock | 重建37个child及2个主会话owner；32个缓存命中，前言/R01—R04等待193—261ms，2个主正文38ms |
| 进入All agents再返回 | dispose37、create37；30命中，R05—R11等待205—301ms |
| 跨Session返回child | create37；26命中、11再次排队315—422ms |

这些时间是临时日志记录的模型空内容等待，包含实际调度和日志负载，**不能等同于浏览器绘制占位的持续时间**。暖返回04/05/07没有拍到占位，不能从内部pending倒推画面。

## 根因范围与后续

当前requestKey将可见性active与实际目标身份混在一起，inactive时为null，显示分支因此卸载整份正文。外层forceMount只保住读位Map；All agents的Show同样卸载选中内容。32份缓存对真实37份正文产生轮流逐出，解释为什么无数据变化的返回仍重做渲染。下一批分开同目标呈现内容与活动请求/滚动所有权；继续在隐藏时取消请求，保留authority/source/session变化的退休边界，而不是扩大缓存或删除占位。

这里直接定位的是隐藏、切换与返回路径。真实流中保持面板打开时是否反复重建仍未被本轮覆盖。主/Side、多个agent切换、菜单实际交互、原Research Studio209来源历史均不能据此宣布通过。该只读历史未复制auth/models，模型配置提示是其实际限制。

## 数据与收尾

[真实运行检查](checks/runtime-qualification.json)：原349与完整90表副本在实际UI操作后，45条Message、36条Source、45个持久化Provider请求身份逐值相同。原349完整47个Provider流还包括预检，不能与数据库45条混为一数。本轮未发起新模型。原启动85478实际exit0，Native445410ms正常退出，Host/Native/端口/输出/请求均闭合，页145已关闭。

临时[诊断源码](text-part-model.diagnostic.ts)仅通过既有AppLog记录787个生命周期事件，未达4096记录上限；完整日志归档。精确原patch和当前差异逐字一致后逆向移除，正式text-part-model差异为0。诊断构建76195/typecheck9881和恢复正式构建21250/typecheck94517均actual exit0，最终本地恢复main-qcEW9nAj.js。正式机制未更改，诊断画面不能冒充新的生产修复验收。

docs:check通过345操作/25组。[完整诊断记录](diagnostic-observations.json.gz)、[运行归档](checks/archive-receipt.json)、[脚本与精确patch](checks/helper-archives.json)和[大文件清单](checks/large-archives.json)保留完整脱敏内容及私有原件；67份文本含解压内容的[凭据扫描](checks/final-scan.json)为0。归档字节比较只验证真实产物完整性，不以源码哈希替代行为正确性。
