# 2026-10-11 来源提示焦点与点击穿透282

用户持续要求单agent自主体验，Sources为重点。281长提示未验项经真实复现发现两条共享问题：外部资料返回后的键盘聚焦触发祖先滚动，Kobalte handleScroll立即关闭仍有焦点的提示；提示持续后，其非交互Content的父定位层却会挡住下方来源点击。前者由真实关闭栈确认，后者由实际elementFromPoint命中定位DIV及失败点击确认。

[Recall与完整影响分析](../../artifacts/2026-10-05-connection-workspace-authority/source-tooltip-plan-282.md)、[全部证据](../../artifacts/2026-10-05-connection-workspace-authority/source-tooltip-282/README.md)。现有单一Kobalte patch保留:focus-visible触发的提示；公共Tooltip样式统一定位层穿透，并删除work-ledger局部重复规则。临时诊断已移除，没有额外状态/重开计时器/协议变化。

四轮真实gpt-6.1-sol/dev/ui，从失败、调用栈、第一修复暴露点击问题，到最终main-Cri4lTiA.js通过长提示、一击穿透导航、首次返回焦点、Escape/失焦关闭及共享项目提示。类型检查、正常/frozen安装、最终构建通过；没有UI自动化。Windows patch工具失败及修复记录保留。

四轮各固定600000ms/12请求，真实3个工具/3来源/7EOF，原前台均actual0；完整独立出生/物理输出请求/端口/pair闭合后才保管自产物并开始下一轮。第三轮提前四分钟目标差109153ms，未冒充达成；最终轮剩413257ms。所有自有页面关闭。原子侧栏全帧Rendering、旧schema及未采样矩阵未由本轮替代，goal持续active。
