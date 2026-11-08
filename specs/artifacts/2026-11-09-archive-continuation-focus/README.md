# 归档成功续页焦点证据

对应[Recall、根因与验收](../../records/2026-11/2026-11-09-archive-continuation-focus.md)。本人实际桌面 `/ui` 操作并查看全部截图。没有界面自动化或模型请求。

- [01](01-before-keyboard-continuation.jpg)–[06](06-before-tab-after-terminal.jpg)：旧版中间和末次续页正确返回，但焦点落回网页，下一次 Tab 无可见行焦点。
- [08](08-after-middle-first-open-focused.jpg)、[09](09-after-tab-next-action-same-new-row.jpg)：英文续页落到第一条新行的 Open，Tab 到同一行。
- [11](11-after-zh-terminal-first-open-focused.jpg)–[13](13-after-open-original-archived-chat.jpg)：中文末页焦点、同一行 Tab 顺序、实际打开原只读归档。
- [07](07-empty-tail-original-cursor.jpg)、[10](10-empty-tail-focus-retained-row.jpg)、[14](14-empty-tail-next-action-same-retained-row.jpg)：独立隔离页持原游标；两条末尾真实恢复后，旧游标耗尽，焦点留在末条保留行。
- [15](15-after-real-failure-keeps-continuation-focus.jpg)：正常关闭隔离服务后，失败摘要、详情与原续页按钮保留，焦点仍在按钮上。

[前态](before-online-tcp.json)、[改后](after-online-tcp.json)各 4 项运行时契约，[空末页](empty-tail-runtime.json)包含真实归档读和两条恢复的收据。[数据复核](owned-final-check.json)记录三份原文件、506 条会话及隔离状态。工具脚本仅接触各自隔离服务或数据。
