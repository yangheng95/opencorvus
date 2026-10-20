# Goal 预算、暂停与恢复的实际体验

[Recall、根因与实施](../../records/2026-10/2026-10-20-goal-budget-lifecycle-review.md)。修复Goal表单长错误时标题/操作区随整个弹窗滚走，以及版本冲突不能在表单内比较当前保存额度的问题。沿用原Dialog和唯一HTTP projection；草稿、revision、累计用量与后端执行合同保持。

- [修复前展开错误](05-before-expanded-error.png)、[旧布局滚到底部](06-before-whole-dialog-scroll.png)：标题和早期表单随frame一起滚走。
- [修复后英文额度比较](09-after-saved-limits.png)、[完整诊断底部](10-after-diagnostic-bottom.png)、[中文额度比较](14-after-zh-conflict.png)：正文可滚，标题与关闭/保存固定可见，保留草稿与当前保存额度可直接比较。
- [保存保持暂停并刷新](11-after-paused-reload.png)、[明确恢复表单](12-after-explicit-resume-form.png)、[暂停后已接纳回复正常完成](13-after-paused-settled.png)、[真实完成依据](15-after-zh-completion-form.png)、[完成页](16-after-zh-complete.png)。
- [Home介绍](17-after-zh-guide.png)、[Home创建表单](18-after-zh-home-form.png)、[恢复原英文首页](19-after-home-restored.png)。介绍仍有确认前假设已存在会话/目标的文案，作为后续改进项保留；首页图的Settings悬停提示未遮挡Goal区域。
- [Goal事件、六条真实回复与累计用量](goal-lifecycle.json)、[UI操作与真实409](ui-checks.json)、[旧数据完整保持](history.json)、[9次实际流式请求及两个原native结算](native-settlement.json)、[凭据对退休](private-pair-retirement.json)。
- [类型/i18n/构建资格](verification.json)，[类型日志](typecheck.log)、[双语键检查](i18n.log)、[最终build](build.log)。19次截图全部人工查看，其中07/08为相同实际图片，原图复核纠正了最初的目视误读，两图都显示固定操作区。没有UI自动化或截图断言；公开构建日志仅清理行尾空白，完整原stdout私有保留。
- 最终源码[类型](final-typecheck.log)、[CSS token检查](css-check.log)、[当前文档检查](docs-check.log)及[架构索引](architecture-check.log)通过；静态检查不替代上面的真实页面资格。

同一真实有限QA Goal从原33733 tokens/1轮，明确恢复后至6轮/205123 tokens；第六回复已接纳后operator暂停，其完成时间晚于暂停事件，累计保持。随后操作员基于真实回复记录该QA目标complete。该状态不代表本线程持续迭代目标完成。

所有145 Project/194 Session旧身份和目录归属保留；最终147/196仅多两次preflight，schema3。目标原消息与旧Sources全部原行保持，canonical字节一致。无用户18571进程/窗口/数据库操作。原完整保存10秒/恢复5秒仍未达标；本批未执行新Task/Mission/SideChat或live Sources/Rendering，不扩大验收结论。
