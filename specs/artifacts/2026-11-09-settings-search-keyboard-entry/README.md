# 设置搜索键盘入口证据

对应[Recall、根因与验收](../../records/2026-11/2026-11-09-settings-search-keyboard-entry.md)。本人在隔离项目的真实桌面 `/ui` 交互并查看全部截图。

- [01](01-before-matching-page-down-stays-input.jpg)–[03](03-before-explicit-appearance-open.jpg)：已有外观匹配但输入方向键无入口，原 Tab 路径及显式打开正常。
- [04](04-after-up-last-matching-skill-library.jpg)–[07](07-after-enter-opens-exact-chat.jpg)：实际多结果的首末焦点、当前通用页保留及原 Enter 激活；05 是移开原工具提示后的完整稳定视图。
- [08](08-after-zh-network-focused-before-open.jpg)、[09](09-after-zh-network-opened.jpg)：中文先聚焦网络，再显式打开，未修改网络配置。
- [10](10-after-unmatched-keeps-input.jpg)–[12](12-after-active-actual-match-focus.jpg)：无结果保持输入、Escape 清除及当前页面真实匹配。

[旧版](before-tcp.json)、[改后](after-tcp.json)各两项实际 HTTP 200/运行时 schema 与隔离项目原身份。[数据复核](owned-final-check.json)记录原 Git 文件和数据库计数。没有界面自动化、模型或凭据请求。
