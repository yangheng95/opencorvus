# 已答提问冷读恢复的实际证据

方案与根因见[本轮记录](../../records/2026-11/2026-11-04-question-history-restore.md)，数据与运行资格见[qualification.json](qualification.json)。仅本人一个agent；真实原生开发`/ui`，自有隐藏页259/260、端口38687/38688；用户18571窗口、进程和数据库未操作。

本轮读取上轮923的两次真实模型与用户交互，新增模型请求0；不能据此声称新模型端到端执行、Side Chat页面或全部提问终态的视觉验收。已答/拒绝/到期/基础设施关闭、terminal-first（先终态后请求）、晚到请求、项目隔离和跨进程恢复另有非UI数据/传输测试。

|原始截图|人工查看结果与边界|
|---|---|
|[01 前测冷读](01-before-cold-history.png)|完成目标和最终交付上下文；底部视区本身不能单独证明提问缺口。|
|[02 原工具回答](02-before-original-tool-answer.png)|原始提问工具仍含问题、选项和值及完整反馈，独立历史缺失与实际公共接口事实相互印证。|
|[03 切换加载中](03-before-other-goal.png)|仅加载中，不作为验收通过证据。|
|[04 另一个目标](04-before-other-goal-loaded.png)|完成目标已读入；侧栏悬浮提示遮住局部，仅作前测上下文。|
|[05 后测完成上下文](05-after-restored-history.png)|正常完成状态、文件修改和输入区；提问位于视区上方，本图不单独证明历史恢复。|
|[06 后测问题与原文](06-after-answer-label-and-original.png)|冷读恢复原问题、选择名称“改为 closed，继续”和完整自定义反馈，显示在原时间线位置。|
|[07 刷新后](07-after-reload-history.png)|重新加载同一实际URL后问题与回答仍完整。|
|[08 另一项目](08-after-other-project-history.png)|侧栏切到923-before，显示该项目原问题及原反馈；与923-after保持各自身份。|
|[09 中文与返回](09-after-chinese-return-history.png)|经真实设置切换简体中文，再返回923-after，选择名称和完整反馈保留，控件与日期随语言更新。|
|[10 原目标详情](10-after-original-goal-details.png)|已完成、472,109令牌、1个自动轮次及原目标/总结保持。|
|[11 最终来源预览](11-after-source-final-preview.png)|实际展开3条Sources并打开final.md，普通应用内侧栏预览，A-03 closed、其余原字段及4/2统计可读。|

所有上述图片均已实际呈现并人工查看；没有运行或新增UI自动化测试。两个实例正常HTTP关闭、原句柄exit0、物理/输出/请求结清；4份认证/模型目录副本已退役，来源认证与目录保持。285809→285811→285813行，仅两次启动各新增控制授权/租约各一行；92表/schema10、全部原业务行、111项目文件/Git和273附件保持。没有schema、迁移、版本、Release或tag变化。
