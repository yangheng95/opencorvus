# 应用菜单与搜索体验证据

对应[调查、根因与验收](../../records/2026-10/2026-10-27-menu-search-journey.md)，无凭据摘要见[runtime-review.json](runtime-review.json)。17张原图均经人工查看；只做真实页面交互，没有UI自动化。

- 01–04：旧版Ctrl+G停留输入框；Ctrl+K正常，菜单实际标注Ctrl+G。菜单Search本身和Settings内点击正常，不误报整个搜索坏掉。
- 05–07：未提交原Chat Goal草稿面对G/K保持，却被Ctrl+N后台导航关闭；返回同一原会话重开后Objective为空。
- 08–11：修复版G实际打开搜索，重复G保持查询与两个真实项目候选；Settings里也打开（10仍在加载，不作结果完成图），收起侧栏可用，11显示实际候选。
- 12–13：同一原Chat未提交Goal面对Ctrl+N、Ctrl+,、Alt+E、G/K均保持原Objective和焦点；Ctrl+A/C实际复制原草稿，正常表单编辑保持。
- 14–17：Close后Ctrl+N正常进入Home；中文浅色Home Goal也保留原草稿；关闭后Alt+E菜单访问、Enter选择搜索及实际两候选正常。

705/706均关闭200、原执行/原生宿主/启动器0、物理/输出/请求结清，目录副本退休，余量1038014/852061ms。两实例零认证/零模型，累计349；源92表238840行保持，706目标全部92表/全部行也与启动前逐项完全相同，无新Goal/消息，166原文件和两个专用项目README/Git HEAD保持，schema9。最终类型、普通Node构建main-Cn8FV1dF.js、语言2570键和文档351/26检查均0；早期main-Cluc2lrs.js只是草稿，没有作为最终实页资格。

Windows开发页面已实际验收。macOS原生菜单只审查共享动作边界及既有⌘G绑定，未在macOS窗口实测，不扩大为所有平台或全产品通过。
