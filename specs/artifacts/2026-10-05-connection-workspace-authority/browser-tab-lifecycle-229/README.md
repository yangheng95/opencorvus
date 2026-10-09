# 229 浏览器标签真实生命周期

修改前分析见[Recall](../browser-tab-lifecycle-plan-229.md)，结果见[月度记录](../../../records/2026-10/2026-10-09-browser-tab-lifecycle-229.md)。

- [英文原文件](after-01/source-file-loaded-english.jpg)与[切回保留地址](after-01/source-return-english.jpg)：真实Sources打开、实际正文加载、同一Browser返回。
- [first互切](after-01/two-tabs-first-return.jpg)、[second互切](after-01/two-tabs-second-return.jpg)、[hide/reopen](after-01/dock-reopen.jpg)、[关闭other后first](after-01/first-after-second-close.txt)、[第三tab新空状态](after-01/new-third-tab.jpg)：真实菜单/标签/关闭操作，地址独立。
- [中文深色文件](after-01/source-file-chinese-dark.jpg)与[返回原地址](after-01/source-return-chinese-dark.jpg)，[真实菜单](after-01/browser-menu-chinese-dark.jpg)和[另一原项目的新标签](after-01/other-project-new-tab.jpg)，全部截图实际呈现并人工查看。
- [实际external动作](after-01/external-open-observation.json)、[真正目标首页](after-01/external-target-opened.jpg)、[Enter原反馈](after-01/enter-feedback.txt)及[人工观察/限制](after-01/manual-observations.json)。Task primary与Native窗口、多tab的Native隔离及长URL Sources未验证。
- 原始launch/shutdown/Native settled/独立closure/HTTP、90表完整行copy/最终13表custody/两个Project属性差异/自己出生pile归档。CLI后端关闭不能证明Native GUI窗口验收。
- [检查输出](checks/)为type/build/docs与完整Source只读collector，不能替代视觉，不运行UI自动化测试。

原222自然1条Source-file保留；5个Provider usage EOF是原历史，不冒充新模型请求。own55/56已关闭，用户23/18107保留。持续单agent继续。
