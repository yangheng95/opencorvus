# 249 侧栏完成后保留真实耗时

用户要求持续单 agent 自主迭代，重点Sources和Rendering。248真实Side在运行时显示46s，结束后耗时消失。SideMessage读取完成时间决定status，却未传给共享CardDurationChip；子会话呈现也没有完整执行时钟，而Main已有真实终态映射。

本轮Side传入同Message的完成时间；子Dock由当前selected activity（所选执行记录）提供开始/终态时间和status，同Session匹配后组装Card。内容投影删除旧历史首消息时钟，并准确声明不含时钟的部分类型；pending/running/idle不取旧completedAt。没有计时fallback（后备路径）、伪时间、第二状态或后端API（Application Programming Interface，应用编程接口）变更。

初次类型检查TS2741真实失败，修正内容投影与完整Card的类型边界后最终typecheck0/build0，原失败保留。真实新main-CvIYQtNa.js进入独立开发 `/ui`；Side Working31s、完成固定1m9s，原Message间隔69809ms，整Dock关闭重开后同消息/位置/耗时保持。绑定同对象的标题和首段边界在静止生成/终态观察一致，不把旧图片位移归为已证明根因。来源标题/域名/抓取耗时、代码与部分表格实际人工看过，没有UI（User Interface，用户界面）自动化。

原foreground62209实际join0、Native正常0、9次Sol流式200/EOF（End of File，流结束）在12预算内、physical/output/request/pair（物理/输出/请求/凭据对）退役完成，10893新日志与原事实保存。完整 [Recall](../../artifacts/2026-10-05-connection-workspace-authority/completion-duration-plan-249.md) 和 [证据索引](../../artifacts/2026-10-05-connection-workspace-authority/completion-duration-249/README.md) 记录真实阶段及初次类型失败。

子Dock映射尚未进入原Research场景物理复测，全程闪烁、所有错误/重试/语言主题、全帧及表格所有行列仍未资格化。旧Part.start在自然结束时被改写也是独立待修问题。本批提交不宣称全部需求完成，持续目标保持active（进行中）。
