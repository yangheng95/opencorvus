# Sources 实际阅读证据

对应[调查与根因记录](../../records/2026-10/2026-10-29-source-reader-journey.md)。单代理实际开发 /ui，0 模型请求；没有编写或运行界面自动化测试。全部 JPEG 为原始截图，已人工查看。

| 原图 | 实际内容 |
| --- | --- |
| [01](01-code-sources-default.jpg)、[02](02-code-tab-capture.jpg) | 原代码来源默认组和另一原始截图入口；早先截图报告裁边的疑虑不作为产品缺陷。 |
| [03](03-code-eight-sources.jpg)、[04](04-code-copy-all.jpg)、[05](05-code-exact-location.jpg) | 8 个原位置展开与复制，实际编辑器44:26选取字符s；未编辑文件。 |
| [06](06-web-sources-default.jpg)、[07](07-web-excerpt-wide.jpg) | 两个原网页来源、标题、摘录入口与首展开。 |
| [08](08-web-reading-wide.jpg)、[09](09-web-reading-narrow-before.jpg) | 原生翻页后开右栏，像素250未变而换行增加。 |
| [10](10-web-reading-narrow-middle.jpg)、[11](11-web-reading-wide-drift-before.jpg) | 修复前窄750从auditory开始，宽750已跳到visual，五行阅读漂移。 |
| [12](12-after-narrow-middle.jpg)、[13](13-after-wide-same-text.jpg)、[14](14-after-reopen-narrow.jpg) | 修复后同样窄750→宽624，原auditory相对位置保持；收起改宽重开回窄750。 |
| [15](15-after-user-reading.jpg)、[16](16-after-left-sidebar-change.jpg)、[17](17-after-conversation-return.jpg) | 真实PageDown到新段落、切换左栏、离开并返回原会话均保留older people段落。 |
| [18](18-after-second-source.jpg)、[19](19-after-web-copy.jpg)、[20](20-original-web-source.jpg) | 第二来源独立从0阅读、原URL复制反馈，真实来源动作打开独立官方原文页。 |
| [21](21-after-chinese-sources.jpg)、[22](22-after-chinese-keyboard-reading.jpg)、[23](23-after-chinese-narrow-reading.jpg)、[24](24-after-first-source-retained.jpg) | 中文控件、Enter重开/Tab/PageDown，第二来源宽250→窄292保持原文；首来源仍独立保留窄1000。 |

[data.json](data.json) 记录三个库各92表103482行逐行保留、schema9/integrity、五原文件字节/metadata、代码位置与URL；[runtime.json](runtime.json) 保留三原始发生轮次/退出0/公开200、物理输出请求结算及精确出生身份、目录副本退休和原截止余量；[checks.json](checks.json) 为辅助检查。截图与真实交互构成界面验收，类型或构建不替代人工视觉。

[只读告警](dependabot-readonly.json) 于18:00:27Z重新获取，7项open中6项指向历史证据锁、1项当前glib；当前rand告警6已fixed。没有dismiss、设置或发布写入；父链限制见[既有760记录](../../records/2026-10/2026-10-28-dependabot-current-alerts.md)。

未覆盖全部外部来源类型、任意文章长度/跨域和非桌面尺寸；本批不修改API、SDK、持久数据库schema或执行调度，不宣称全产品验收完成。
