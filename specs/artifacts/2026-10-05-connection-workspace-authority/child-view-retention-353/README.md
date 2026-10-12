# 353 同目标子会话呈现保留

[Recall与完整方案](../child-view-retention-plan-353.md)。本轮修复同目标子侧栏在隐藏、成员列表切换时销毁正文的生命周期问题。历史与流中阅读路径已有真实实证；**完整Task验收失败**，失败事实与未完成范围保留。

## 实现与范围

唯一canonical target继续绑定API authority、parent source、child Session和directory。可见活动只控制resource读取、live/refresh入口与滚动controller；隐藏同目标不再清空已呈现内容，成员列表使用原DOM的hidden状态，真正换目标仍退休旧视图。live投影随目标更换重置，隐藏后重新显示沿原游标补读，不回退到旧HTTP内容。滚动controller在隐藏时清理，显示时从同一个32项读位Map恢复；保存其实际reading intent，包含尚未完成的恢复位置。没有新数据cache、历史DOM集合、第二套滚动策略、消息或Source。

改动仅SubagentConversationPanel、inspector.css与架构07。Markdown的32份/4000000代码单元完成缓存及worker未更改。依据[Solid resource](https://docs.solidjs.com/reference/basic-reactivity/create-resource)、[effect cleanup](https://docs.solidjs.com/reference/lifecycle/on-cleanup)和[HTML hidden](https://html.spec.whatwg.org/multipage/interaction.html#the-hidden-attribute)的现有合同。

## 真实历史复核

使用349原完整90表历史副本，没有凭据、新模型或新Task。前后45条Message、36条Source、45个持久化Provider请求身份完全相同。[生命周期汇总](diagnostic-summary.json)和完整诊断记录给出459条真实事件。child首批owner9—45在Dock、All agents和Add菜单来回保持，真实跨Session切换才退休。关闭Dock另有主会话长输入因虚拟布局创建1个owner，不把它误记为child重建。

| 图片 | 实际观察 |
| --- | --- |
| [01](01-history-before-hide.png)、[02](02-history-paused-prose.png) | 首次完成渲染，滚动到R06附近top1296 |
| [03](03-history-dock-return.png) | Dock关闭重开，仍R06/top1296 |
| [04](04-history-agent-return.png) | 成员列表返回，仍R06/top1296 |
| [05](05-history-menu-return.png) | 添加工具菜单打开/Escape关闭，仍R06/top1296 |
| [06](06-history-other-session.png)、[07](07-history-task-return.png) | 真实切换至预检Session，再回原Task，原child数据重新绑定并恢复top1296 |

数字仅作[人工读位观察](manual-positions.json)，没有DOM、组件、源码、截图或像素断言。7张图均实际呈现并人工查看。

## 正式版本流式复核与失败

新Task `tsk_g00VXqO7wS00Jmf0HdZh`，worker `ses_h9aQ1aKN0qHWqIOhZfo7`。授权auth+完整models分别预检usable/projected/实际gpt-6.1-sol streaming。原任务openedAt+900000ms、64请求均未延长。

开始发生三次服务过载，负责人自然稍候并恢复同一物理worker。后续又出现两条worker过载，实际研究员最终完成37段/5499字符及全部36题和36来源。最后负责人接续时再次收到结构化`service_unavailable_error`、`server_is_overloaded`，数据中的`isRetryable=false`，Task在14:14:55.847Z失败。原失败不是凭据、目录投影或64次预算用尽：62个实际Sol请求，exhausted=false。HTTP200且流EOF只证明传输闭合，不能说明模型回复成功。

| 图片 | 实际观察 |
| --- | --- |
| [08](08-live-provider-error.png) | 真实上游过载以错误反馈展示 |
| [09](09-live-resumed-early-prose.png) | 同一研究员恢复后正常输出 |
| [10](10-live-before-hidden-growth.png) | 停在R03/top792，正文高度4289，随后隐藏 |
| [11](11-live-after-hidden-growth.png) | 约65秒后返回仍top792、following=false，高度5986，已补入R21 |
| [12](12-live-latest-after-catchup.png) | 主动End后following=true，最新R24和当时过载错误可见 |
| [13](13-live-01-terminal-offline.png) | 已在原生服务退出之后，展示失败及离线；**不算在线验收** |

[实际后端检查](checks/actual-evidence.json)逐一核对36题、36次真实webfetch/Source顺序、完整持久化正文、42个公开text流的trimEnd对应与模型身份。09—12均匹配实际worker reader窗口，不能仅用Task Running判断。**负责人未核对全部36段原文、Task未完成，完整资格仍失败**；没有用研究员自述或局部UI通过替代这两个要求。

## 收尾、检查和剩余事项

历史原启动66890=0，Native261310ms，诊断asset main-6e97UgE-.js实际HTTP200；页146关闭。正式live原启动67543=1，API观察器81908=0，Task创建器0，Native735687ms后正常物理退出（Native exit0），完整output/request/端口与auth+models配对均清理，页147关闭。13图时间晚于Native14:15:01.447Z退出。任务资格和原生物理清理是不同事实。

临时text-part-model诊断已按精确patch移除，正式该文件diff为0。诊断构建63907/types27399、正式构建52430/types55660与CSS检查均实际exit0；正式main-sRwPZ07h.js由live实际返回HTTP200。真实截图共13张，全部人工查看，时间见[screenshot-times](screenshot-times.json)，流中动作见[live-action-times](live-action-times.json)。

未独立覆盖多个child相互切换、连接authority轮换、独立Mission、原Research Studio长期全历史；流中仅实际操作Dock隐藏/返回，All agents/Add菜单在完成态历史操作。接下来需核对过载错误的可重试契约，以及projectSubagentConversationCard从全历史选择最后failure并覆盖最新status的显示语义；目前只记录代码与实际错误数据线索，不把它们当作已经完成的第二项修复。

docs:check通过345操作/25组。[完整归档清单](checks/archive-receipt.json)保留118份原监督文本、完整日志、原脚本与patch，较大文件完整gzip且私有原件保留；117份文本含解压内容的[凭据扫描](checks/credential-scan.json)为0。所有字节比较仅验证实际归档完整性，不用源码摘要替代行为验收。
