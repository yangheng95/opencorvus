# 持续目标长度边界体验

对应[方案](../../records/2026-10/2026-10-31-goal-objective-length.md)。单agent在三个顺序运行的原生开发serve `/ui` 实际交互，桌面1280×720；18张原截图均实际呈现并人工查看。只读字段长度/原生validity观察用于定位根因，没有UI自动化测试或截图断言。

| 截图 | 实际证据 |
| --- | --- |
| [01 首页](01-before-home.png)、[02 原表单](02-before-prefilled-form.png) | 从真实New chat入口把16001字符草稿带入16000上限字段，浏览器原生仍判有效 |
| [03 过渡](03-before-submit.png)、[04 错误](04-before-real-error.png)、[05 原响应](05-before-length-error-details.png)、[06 空会话](06-before-empty-conversation.png) | 点击后先创建新项目/Work会话，Goal接口再以400/too_big/objective拒绝；原文保持，但留下空对象 |
| [07 首候选](07-after-english-validation.png)、[08 展开预算](08-after-budget-preserved.png)、[09 纠正](09-after-corrected-edit.png) | 创建前校验有效；展开预算后共用尾部反馈正文在折叠线下，故未把该候选当最终视觉交付 |
| [10 最终字段错误](10-final-field-error.png)、[11 展开预算](11-final-expanded-budgets.png) | 原字段下方直接显示完整长度提示；120000/2预算、原文和纠错焦点保留 |
| [12 指南返回](12-final-corrected-return.png)、[13 重开](13-final-reopened-draft.png) | 纠正为16000字符编辑值，预算及展开状态在指南/关闭重开后保持 |
| [14 原空值校验](14-final-empty-validation.png)、[15 trim边界编辑](15-final-trim-boundary-edit.png) | 空目标显示原生Enter an objective；16002原字符/trim16000只编辑阅读，不提交合法Goal |
| [16 中文提示](16-final-chinese-validation.png)、[17 中文纠正](17-final-chinese-corrected.png)、[18 已有Work](18-final-existing-conversation.png) | 中文本地化16,000提示、短草稿纠正/重开、已有会话+菜单入口同样在创建前反馈 |

[交互与范围](interaction-review.json)、[运行及检查](verification.json)、[基线数据](before-qualified.json)、[首候选数据](after-qualified.json)、[最终数据](after2-qualified.json)、[原空案例回读](empty-case-review.json)分别记录真实视觉、HTTP完整响应与SQL/文件身份保护。

最终schema9/92表，215870→215944→215946→215948。起始数据全部列保持；基线新增一项目/会话、其两条session.created/updated发布及投递、项目记忆和运行lease/grant事实。两个候选各仅新增本实例lease/grant一对，实际回读新项目/会话均0；原空案例仍零消息/Goalnull及22原文件，未清理它来迎合检查。旧十三项目Git/28 tracked、75附件、十三+三十九文件及全部原HTTP历史/Goal保持。

三scope模型请求均0、累计1118；原exec/native/launcher均0、public shutdown200，物理/输出/请求/OS出生身份结清后退休配对auth/models副本，原源认证元数据和模型目录字节/元数据保持。固定deadline1793428481596，三次结清余3297454/2806320/2375476ms，无延期或超时重启。

合法16000字符/trim边界只做编辑与返回，不宣称本轮有效Goal执行或模型端到端；Task/Mission/SideChat复用当前组件，但本轮没有逐个实际启动，只验Home及已有Work。仅桌面；UI验收来自上述实际截图，类型/构建/双语/文档检查不代替视觉。
