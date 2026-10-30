# 持续目标自然完成与后续动作实页证据

[完整调查和实施记录](../../records/2026-10/2026-10-30-goal-report-completion.md)。单 agent、原生开发服务 `/ui`，25张截图均实际呈现并人工查看，没有 UI 自动化。用户18571服务和真实数据库未操作。

## 真实目标流程

- [01 项目首页](01-project-home.png)、[02 目标与额度确认](02-create-goal-confirmation.png)：通过真实项目搜索选择 support-report，由 `/goal` 打开表单，确认200000令牌/2自动轮次。
- [03 目标运行](03-goal-running.png)、[04 自然完成](04-goal-completed.png)、[05 完成依据和用量](05-completed-goal-evidence.png)：模型实际读取输入、写入并复核两份产物，再通过原工具完成Goal。
- [08 报告阅读](08-real-report-review.png)、[09 汇总阅读](09-real-summary-review.png)：真实Review面板显示原文件差异，2文件/36新增行；不是渲染后的Markdown报告预览。

原输入为[项目说明](project-README.md)和[8条虚构工单](support-tickets.csv)，模型实际产物为[summary.csv](summary.csv)和[report.md](report.md)，均从原件逐字节复制。独立Python重算明确得到P1=3/170、P2=3/115、P3=2/35、TOTAL=8/320；两个输入原字节保持。

[完成归属](completion-proof.json)连接10条原usage关联，合计380471令牌，与Goal完全相等；会话11请求420939令牌，完成后的新请求单独计入会话。总13次含2预检，均为gpt-6.1-sol/streaming/HTTP200/settled/EOF；新目标只有真实goal-controller/work参与者。预算限制新自动轮次，已经接受的同一轮可完成并超过额度；本次1轮自然完成，不冒充硬输出限额。

## 已复现和修复的界面问题

- [05 初次完成详情](05-completed-goal-evidence.png)看不到下一目标动作；[06 Objective内部滚动](06-next-goal-below-fold.png)只移动原目标阅读区，[07 滚到正文底部](07-existing-next-goal-after-scroll.png)才出现原按钮。这些是修改前问题证据。
- [10 固定页脚](10-next-goal-fixed-footer.png)、[14 中文固定页脚](14-chinese-fixed-next-goal.png)、[15 预算展开](15-expanded-budget-fixed-action.png)、[16 预算值与后续动作](16-budget-values-and-next-action.png)：完成后“创建新目标”固定可见，长原文和预算在原正文阅读。
- [11 同一创建表单](11-next-goal-form.png)、[12 键盘/说明返回](12-draft-and-guide-return.png)、[13 取消后重开](13-cancelled-draft-reopened.png)、[17 中文草稿](17-chinese-next-goal-draft.png)：原创建入口、焦点和草稿保留。没有提交第二Goal或触发第二次执行。
- [18 已有完成Goal](18-existing-short-goal-footer.png)、[19 原暂停Goal](19-existing-paused-goal-controls.png)、[20 暂停详情滚动](20-paused-goal-completion-action.png)、[21 原未完成动作](21-paused-goal-original-actions.png)：原完成记录148493/3保持，暂停表单仍保留原标记完成、保存和恢复选择。
- 19/21原中文“所属会话已归档”与已恢复的真实Session不符。[22 最终英文原因](22-final-english-archive-reason.png)、[23 最终中文原因](23-final-chinese-archive-reason.png)、[24 最终暂停详情](24-final-paused-goal-details.png)改为说明历史归档导致暂停，恢复对话/任务后仍需显式恢复Goal。原reason/revision/36322/1和额度保持。
- [25 最终完整资源](25-final-completed-goal-action.png)再次确认自然完成Goal与固定下一目标动作。最后语言修改使用新的冻结实例，未以入口文件名相同或reload替代实际验证。

## 数据和物理收尾

[完整回执](final-qualified.json)和[检查结果](validation.json)保留三scope及纯UI/语言检查。原92表/schema9/204879行中的业务值保持；两条已过期物理容量slot按原同主键和fence换成本轮原native，分别在对应EOF后1ms释放，[逐条资格](capacity-qualified.json)与代码调查排除了业务终态异常。未用表名白名单忽略差异。

真实新消息、Tool、Goal、usage、Memory与Bus/control事实追加后，before为208561行；after208563、final208565。两个后续副本对其直接前像208561/208563行全部原值EXCEPT为0，包含这次完整执行，未清空报告或历史。原四类完整HTTP、原暂停Goal及本次12消息/完成Goal逐值相同；75附件、8旧项目28tracked/Git保持。

三scope公开shutdown200、原native/launcher/exec均0，物理/输出/请求结清；距同一固定截止分别余2711794/1280960/844859ms。三对auth/完整模型目录副本退休，源认证元数据、模型目录字节和元数据保持。模型13/0/0、累计1096，初始16次中3次未用额度退休，没有为后续UI复验重跑付费任务。

本批未逐一实操Task/Mission/SideChat的新按钮，也没有已归档且带Goal的原Session可供只读页面复核；这些分支没有被列为视觉通过。没有原生GUI、安装更新、发布或GitHub管理写入。
