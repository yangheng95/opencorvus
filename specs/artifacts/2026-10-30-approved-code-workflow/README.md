# 批准后提交与选择控件布局

2026-10-30，单 Codex agent。独立开发服务与复制数据库；用户18571页面、进程和真实数据库未操作。完整流程使用授权的真实 `gpt-6.1-sol`，UI（User Interface，用户界面）通过实际键盘、点击、截图及人工查看验收；没有运行或增加 UI 自动化测试。

## 结果

共享 Checkbox、Switch、Radio 根元素建立局部定位上下文，隐藏输入的焦点随可见控件定位。长 Mission 表单从搜索框 Tab 到复选框、空格选择、再移至末项时，内容正确滚动，标题与页脚保持。搜索结果行高改用现有正常正文令牌；CSS（Cascading Style Sheets，层叠样式表）检查器补登记 Kobalte 实际写入的可用高度变量。

- [12：真实键盘复现原故障](801-12-long-form-keyboard-tab.png)：标题滚失、页脚升至中部、大片留白。
- [14：候选首次 Tab](14-keyboard-tab-candidate.png)、[15：选择与末项](15-keyboard-last-option.png)、[16：短表单](16-short-form-candidate.png)。
- [17：真实开关](17-switch-keyboard-off.png)：实际关闭，再以空格恢复原值1。
- [18：真实单选](18-radio-keyboard-choice.png)、[19：模型收到乙并结束](19-radio-answer-completed.png)。
- [20：最终搜索结果](20-final-conversation-search.png)、[21：定位原消息](21-search-original-message.png)。该只读服务未复制认证，模型不可用提示是当前隔离条件，实际请求为0。
- [22：最终发布的长表单](22-final-keyboard-form.png)：`main-BXyKvkH6.js`，实际 Tab/空格通过，外层 dialog 的滚动位置为0。

[13号旧发布图](13-old-publication-retained.png)是仍加载旧 `main-Dk8FSgd1.js` 的诊断现场，不是修复截图。服务在启动时冻结前端资源字节；磁盘替换没有改变该页面。保留这次真实失败尝试，另启动独立服务加载新构建完成验收，没有绕过资源所有权或重启用户应用。

## 完整真实代码流程

新 Task `tsk_g00VZT7V7400TdQ2J6Sj`、Mission `19467ea3d5e810a6` 完成修改、实际两例测试、完整差异展示、等待批准、限定提交、独立验收及交互交付。QA（Quality Assurance，质量验证）仓库的真实提交为 `a6d424e29eca2edbc2fc027d51d102a106c55d2c`，父提交 `109735578eb9d43659ac6cdf85c1bf5c67457f8d`，仅包含 counter.py/test_counter.py。不是本次产品源码交付提交，QA仓库未推送。

原两个 question 超时记录保留，均未当作批准。随后真实 User Part `prt_g0VZT9Vrp00jiUgWcIRp` 明确批准，早于实际 Bash commit Part `prt_g0VZT9dVr00fh8eGSRlB`。备注的 HEAD、暂存、working 三种内容分别保全。项目 bootstrap 在 Task 前补入两份既有 Git metadata 规则，已由独立原件调用真实生产 writer 精确核对，Task 未将其纳入提交。

- [01：真实 Sol 预检](801-01-sol-preflight.png)、[03：等待批准](801-03-pending-approval.png)、[04/05：实际差异](801-04-review-diff.png)。02也出现长表单问题；06时原问题随后过期，不能当作已发送批准。
- [07：Task 完成](801-07-task-completed.png)、[08：Mission 完成](801-08-mission-completed.png)、[09：真实交付工作区](801-09-delivery-workspace.png)。
- [批准/工具/Git原始链](approval-chain.json)、[批准前Git](before-approval-git.json)、[批准后Git与提交对象测试](after-commit-git.json)。独立检查实际提交的两份 blob，运行两个正向 Python 用例；未用工作文件结果冒充提交对象。
- [正式完成决策](mission-final-decision.json)：当前 Task 完成决策精确指向实际 complete_task Tool Part；Mission completed，真实交付结算 passed。
- [真实单选请求/回答/模型正文](radio-real-chain.json)，来自独立新普通 Chat，不重开已完成业务。

旧793的提前 Host 提交失败仍保留：其 HEAD `1b6ae6e649db0022aa197592e5a7c8f24d264ef8`、六份文件和原暂存语义精确保持。新成功不能追认或回填旧历史。

## 验证与资源结算

原生构建、类型检查、最终 CSS checker 通过。CSS checker 实际处理8937引用/2个文档、268全局令牌、60应用样式表、396 TS/TSX文件。首次检查遗漏 Kobalte token，下一次才暴露1.55行高，两份原失败输出及最终通过输出均保留。补齐完成决策的私有 checker 曾误用 TaskRow；改用真实 viewTask 后原合同通过，原失败也保留。所有日志以 JSON 无损保存 UTF-8 原文，没有清洗输出来伪造通过。

| Scope | 实际 Sol 请求 | 固定上限 | 物理 admission | 结算 |
| --- | ---: | ---: | --- | --- |
| approved-code-801 | 87 | 96，余9退休 | 原75min | 原exec/native/launcher均正常结算；认证/目录副本退休 |
| approved-code-801-ui | 3 | 6，余3退休 | 独立30min | 同上；真实单选完成 |
| approved-code-801-final | 0 | 0 | 独立30min | 未复制认证；原handle结算，目录副本退休 |

所有90次实际请求均为真实 Sol 流式、HTTP200、EOF（End Of File，读流完成）；累计从993至1083。每个诊断服务只使用自己的原生身份、公开 shutdown、同一原始 handle 和截止；没有延期原任务额度。原认证 metadata 与模型目录字节/metadata 保持。详见三份 `*-retirement.json`、`*-provider-audit.json` 和 `*-shutdown-plan.json`。

[数据逐行核对](data-qualified.json)：178233→203134→203936；仅逐条核证的3/2个过期物理容量 slot 被本 scope 精确 owner 重用并释放，其他全部旧行相同，schema9、完整性与外键通过。[最终只读核对](final-ui-final-data-qualified.json)：203936行前后全同，六处附件副本17/10/16/24/6/2逐字保留，原QA Git和文件保持。凭据、完整模型目录、数据库及私有全量行未导出。

[方案与完整 Recall](../../records/2026-10/2026-10-30-approved-code-workflow.md)。整体持续产品迭代仍为 active；本轮结果不代表所有产品页面均完成验收。
