# 首页目标表单与预算校验实页

对应[规格与 Recall](../../records/2026-11/2026-11-06-home-goal-validation.md)。本人单代理在原生开发 `/ui/` 的隐藏独立页面、1280×720 桌面实际交互，以下 27 张截图均本人逐张查看。没有运行界面自动化、DOM（Document Object Model，文档对象模型）断言或截图基线。长度只读观察辅助说明预填数据，不代替截图和实际焦点。

| 图 | 实际观察 |
| --- | --- |
| [01](01-before-project-home-english.png) | 现有项目首页的目标入口、真实输入框及模型上下文。 |
| [02](02-before-required-objective-english.png) | 空目标的原生必填提示本来正常，未误判为产品故障。 |
| [03](03-before-collapsed-zero-budget-submit.png) | 原令牌 0 校验自动展开预算，聚焦错误字段。 |
| [04](04-before-reopened-draft-chinese.png) | 中文取消重开保留原目标与预算草稿。 |
| [05](05-before-zero-budget-chinese.png) | 原预算错误已有正确中文提示。 |
| [06](06-before-guide-chinese.png) | 现有目标说明与其他入口分层正常。 |
| [07](07-before-guide-return-draft-preserved.png) | 说明往返保留字段及预算。 |
| [08](08-before-whitespace-objective-feedback.png) | 三个空格的目标被正确拒绝，但错误及焦点落到表单底部反馈块。 |
| [09](09-before-whitespace-completion-feedback.png) | 完成依据存在同样的纠错位置问题；实际完成判断未提交。 |
| [10](10-before-goal-reason-code-in-chinese.png) | 中文工具摘要仍显示已知系统代码 turn_budget。 |
| [11](11-before-original-read-content.png) | 原读取工具内容仍可查看；本图没有到 Goal 原结果区域，不作为其视觉证明。 |
| [12](12-after-inline-objective-error-english.png) | 英文目标错误紧贴字段并聚焦。 |
| [13](13-after-corrected-objective-and-budgets.png) | 输入修正后字段恢复正常，预算内容保留。 |
| [14](14-after-collapsed-budget-error-preserved.png) | 原折叠预算校验继续正确展开和定位。 |
| [15](15-after-inline-objective-error-chinese.png) | 中文语义空白目标同样使用字段内提示。 |
| [16](16-after-corrected-draft-guide-return-chinese.png) | 中文修正、三轮预算和键盘返回表单均保持。 |
| [17](17-after-inline-completion-error-chinese.png) | 中文完成依据错误紧贴输入框，焦点直接返回字段。 |
| [18](18-after-completion-draft-corrected.png) | 修正输入后错误清除；随后取消，未更改旧目标。 |
| [19](19-after-goal-reason-chinese.png) | 已知系统原因在中文摘要内解释清楚。 |
| [20](20-after-original-goal-result-preserved.png) | 原结果仍保存 budget_limited/turn_budget 等技术字段与原文。 |
| [21](21-after-goal-reason-english.png) | 英文同步使用原有原因解释；长摘要遵循既有省略布局。 |
| [22](22-after-completed-evidence-verbatim.png) | 已完成目标的依据原文、用量与预算保持。 |
| [23](23-after-global-home-context.png) | 从新对话进入真实全局首页，未创建工作。 |
| [24](24-after-prefilled-length-error-preserved.png) | Composer（输入框）预填 16014 字符时，原 16000 上限仍显示字段错误并保留草稿。 |
| [25](25-final-objective-error-english.png) | 预留最终隔离阶段重新呈现英文错误与字段焦点。 |
| [26](26-final-objective-error-chinese.png) | 最终中文错误与字段焦点确认。 |
| [27](27-final-goal-reason-chinese.png) | 最终中文工具原因仍正确，原目标仍暂停。 |

after 的两项业务检查因验收脚本旧检查点引用而未完成，不能冒称通过。已修正本轮检查器，预留 final 从最新完整 after 数据复制，在同一原截止和零模型额度内重新完成全部九项真实接口检查、两 Goal（持续目标）与三 Tool（工具片段）读回；初始和结束各通过一轮。中间失败日志保留；最终阶段初次还发现 Sources 检查器跨批引用，修复后沿原存活实例重跑，没有重启、伪填回执或改弱合同。

纯界面改动复用原校验和语言表，已知未完成系统原因共享唯一格式器。完成依据、自由文字和原工具输入/输出不翻译。真实运行/完整保全与正常退役结果见 [qualification.json](qualification.json)。本轮没有有效创建或更改任何目标，没有新模型请求、模式恢复或发布；用户使用中的窗口、进程、18571 和真实数据库未操作。
