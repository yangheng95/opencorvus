# 233 整个 Dock 关闭与文件显示依赖

[Recall与实施前根因分析](../dock-dismiss-focus-plan-233.md) / [月度记录](../../../records/2026-10/2026-10-09-dock-dismiss-focus-233.md)。仅单agent，真实UI人工复核。

[before-01](before-01/README.md)保留Close panel丢失焦点和Mission导航被File effect回拉的原失败；[after-01](after-01/README.md)绑定当前main-DzTLjY3N.js/18164修复后的实际行为。两轮源均为原231完整runtime，90表逐行一致复制和原Session/Project/目录绑定，无新增Provider请求。

当前main在inert前接续可见header焦点，File观察者使用当前open/reveal显式依赖。两轮自己的IAB与Native/foreground已闭合actual0；原13表完整事实一致；全部observer终态后仅归档自己精确birth生成文件。

本轮未证明Portal/resizer竞态、连接/resource改变、Tauri GUI或活子agentRendering全帧稳定性。
