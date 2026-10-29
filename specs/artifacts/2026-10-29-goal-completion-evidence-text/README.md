# 完成依据原文边界实页证据

01：明确人工文字核对目标，实际标识turn_budget可见。02：目标未完成时，执行模型不可用的现系统原因。03：操作员原文完成输入turn_budget。04–05：同一完成事实的英文/中文误译，目标未设置预算且0轮次。

原图均为真实开发serve /ui直接交互和截图，已经呈现并人工查看。没有UI自动化、DOM/源码文案或像素断言。此人工元数据验收不冒充模型或自动轮次完成。

06–07：同一原完成事实在新普通构建中的英文/中文详情，turn_budget原样显示。08–10：下一目标草稿经中文指南往返与取消/重开。11–12：未完成目标的model_unavailable原因仍按当前语言显示。13–15：user_paused原文输入及两语言完成详情。16：恢复英文后的最终已完成状态。

所有16张图均直接捕获、呈现并人工查看。两个目标的完成判断来自明确的操作员人工文字核对，0模型请求/0自动轮次，不是模型生成的完成证据。原字串未迁移或改写；旧代码和781新代码两类碰撞都进入同一个complete原文分支，其余原因按原系统类别显示。未穷举所有owner及12个代码。

- [before-complete.json](before-complete.json)、[after-same-complete.json](after-same-complete.json)：相同原Goal ID/revision/全部字段精确一致，完成依据仍为turn_budget；展示修复没有数据写回。
- [second-blocked.json](second-blocked.json)、[final.json](final.json)：下一真实人工Goal的blocked/model_unavailable与complete/user_paused，0自动轮次/0模型请求。
- [data.json](data.json)：两库92表全部旧行及源库精确，六条created/blocked/complete原决策、五原输入及两namespace各17项文件保留。
- [runtime.json](runtime.json)：两个公开shutdown200、原exec/native/launcher0与物理/输出/请求/出生身份退休，目录副本已清退，累计模型777保持。
- [checks.json](checks.json)：普通前端build/renderer、类型、双语、当前文档与架构checker终态；视觉资格来自上述实际原图。
