# 既有成员的真实流与 Rendering 生命周期

[方案、Recall与完整结论](../../records/2026-10/2026-10-25-member-live-lifecycle.md) · [结构化证据](evidence.json) · [实际验收调用者修复](public-request.mjs)。

单个编码agent，通过公开接口向同一既有普通assistant Session输入一次有限请求；每个fresh隔离scope各一次，不创建成员、Task或Goal。两个scope真实Sol长回复分别6470和6769字符，均自然idle，Sources与真实Tool receipt归属一致。原588调用者遇到Node fetch的约300秒响应头超时，修复后588b原公开POST完整200、exec0；两轮实际Provider均3条精确Sol流200/原reader EOF。原服务/launcher/出生链已关闭，凭据与模型目录副本清退，90表207330原数据行及配置完整。

原反复Rendering未复现、根因未定。本批没有产品补丁，没有以内部pending频繁变化推断正文闪烁，也没有UI自动化测试。被动日志和人工采样有观察间隙，复制字节未核验；完整限制见方案和JSON。

实际视觉证据：

- [01 原既有成员](01-original-member.png)，[02 权限请求](02-live-member.png)，[04 原请求仍等待权限](04-current-member.png)，[05 允许一次后](05-permission-resolved.png)。
- [06 正文流中](06-streaming-member.png)，[07 流中历史阅读](07-history-during-stream.png)，[08 展开来源](08-source-during-stream.png)，[09 来源内部阅读](09-stream-following.png)，[10 长正文后段](10-live-long-body.png)。
- [11 原回复结束](11-end-member.png)，[12 来源重开](12-completed-source-reopen.png)，[13 Copied反馈](13-source-copy.png)（剪贴板字节未核验）。
- [14 fresh复验前](14-recheck-before.png)，[15 复验流中](15-recheck-stream.png)，[16 复验后段](16-recheck-late-stream.png)，[17 完整回复结束](17-recheck-complete.png)，[18 复验真实来源](18-recheck-source.png)。

所有图片均为原生开发模式`/ui`的真实内置浏览器页面并已人工查看。09的滚轮由Source内部滚动区接收，不能写成已回到Dock底部；10才是外层Dock的实际回底。01/14是静态基线，11/17是结束状态，流式视觉证据由06/07/08/10及15/16提供。
