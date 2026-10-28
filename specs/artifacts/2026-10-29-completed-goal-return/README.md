# 已完成目标返回与下一目标草稿

对应[根因/实施记录](../../records/2026-10/2026-10-29-completed-goal-return.md)。单代理真实开发 /ui，28张原始JPEG全部人工查看；没有界面自动化或DOM/文案/像素断言，图片未裁改或重绘。

| 原图 | 实际步骤与结论 |
| --- | --- |
| [01](01-current-home.jpg) | 当前英文首页局部捕获；1119捕获/1280布局的既有表征差异不作为产品CSS故障。 |
| [02](02-completed-goal-summary.jpg)、[03](03-completed-details.jpg)、[04](04-details-guide.jpg)、[05](05-details-return.jpg) | 原自然完成目标摘要、完整证据/148493令牌/3轮、指南往返及原Objective焦点。 |
| [06](06-new-goal-draft-budget.jpg)、[07](07-new-goal-guide-return.jpg) | 新建草稿与12000/2预算，指南往返字段保留。 |
| [08](08-reopen-new-goal-from-details.jpg)、[09](09-reopen-via-composer-retains-draft.jpg)、[10](10-cancel-original-goal.jpg) | 修复前经详情重开清空，直接输入区入口却保留；取消仍为原完成目标。 |
| [11](11-after-creation-draft.jpg)、[12](12-after-original-budget.jpg)、[13](13-after-original-budget-visible.jpg)、[14](14-after-details-new-goal-retains.jpg) | 改后创建草稿12000/2与原完成Goal空令牌/3轮分别读取；经详情和指南重开创建草稿完整。 |
| [15](15-after-guide-draft.jpg)、[16](16-after-collapsed-draft-return.jpg) | 指南返回保留字段焦点，手动折叠后经取消/详情/重开仍保持折叠。 |
| [17](17-after-chinese-retained-draft.jpg)、[18](18-after-chinese-budget-retained.jpg)、[19](19-after-chinese-guide-keyboard.jpg)、[20](20-after-composer-same-draft.jpg) | 中文重复创建草稿/12000/2与折叠，真实Shift+Tab/Enter返回和另一输入区入口一致。 |
| [21](21-after-paused-original-budget.jpg)、[22](22-after-paused-edit-guide.jpg)、[23](23-after-paused-saved-two.jpg)、[24](24-after-paused-budget-restored.jpg) | 不同现有paused目标原预算1，编辑2/指南返回/真实保存仍paused，再保存恢复1；正式GET与追加事件对应。 |
| [25](25-after-home-draft-scope.jpg)、[26](26-after-home-guide-form-draft.jpg)、[27](27-after-home-original-composer.jpg)、[28](28-after-home-form-reopened.jpg) | 首页新范围从自身composer初始化；单独编辑Goal表单、指南/取消保留composer原文，重开保留表单文本。27为完整1280首页，标题/提示/输入/工具/建议区域可见。 |

[goals.json](goals.json) 记录原完成Goal的当前完整身份/用量，以及暂停目标真实预算1→2→1、两个200 PATCH（12/6ms）和两个追加事件；[data.json](data.json) 为两库92表、103482原行逐行保持、schema9/integrity=ok，新增仅两个规范continuous_goal.updated事件及五原输入字节/metadata。未创建新Session、Message或执行轮次。

[runtime.json](runtime.json) 保留两个原exec/native/launcher0、公开shutdown200、物理输出请求结算、精确出生身份、catalog退休与原截止余量，模型0/累计767；原认证未复制。[checks.json](checks.json) 仅辅助类型/普通构建/双语/文档结果，不能替代实页。

本批没有确认创建/恢复新执行，不将750既有三轮结果冒称新发送。Task/Mission/SideChat、全部冲突/重启和非桌面矩阵未实操；HTTP、SDK、数据库迁移与执行调度没有改动。
