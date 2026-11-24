# 折叠子目录的分支切换搜索证据

基线 `main-B4MDHDJ-.js` 从独立开发宿主运行。Git 分支只改变 `plans/releases` 内的一个跟踪文件名和正文。截图为真实桌面操作并逐张人工检查。

| 步骤 | 结果 |
| --- | --- |
| [原 main 搜索命中](baseline-main-branch-search.jpg) | 相同名称查询命中 main 文件。 |
| [稳定根目录切回 main 后](baseline-search-stale-after-polling.jpg) | 38 秒后仍显示 review 文件。 |
| [打开旧结果](baseline-stale-search-result-file-missing.jpg) | 当前磁盘已无该文件，面板提示找不到路径。 |
| [手动刷新](baseline-manual-refresh-restores-current-path.jpg) | 原查询才显示 main 文件。 |
| [消息流断开之前](baseline-search-before-stream-disconnect.jpg)及[切分支后重连](baseline-search-stale-after-stream-rejoin.jpg) | 已重新上线，原搜索仍保留 main 文件。 |

[真实分支、根目录与搜索读取](baseline-stable-root-checkout.json)、[可见搜索观察值](baseline-search-observation.json)、[断开期间分支回执](baseline-reconnect-checkout.json)、[中转相关实际请求](baseline-transport.json)记录工作区的身份、时间和输入保留情况。

首次候选 `main-UR5_O4Un.js` 在[切换前](candidate-only-tab-focused-result-before-checkout.jpg)的旧搜索结果确实聚焦。[切换后](candidate-only-tab-focus-after-checkout.jpg)已显示当前文件，原查询仍在，焦点落到页面主体。同一个隔离标签未展开子目录。[实际切换和查询](candidate-focus-only-checkout.json)与[焦点观察](candidate-first-focus-state.json)记录该次问题。

最终候选 `main-DDsvwfvj.js` 的以下页面已实操并人工复核。

| 步骤 | 结果 |
| --- | --- |
| [切换前主分支结果聚焦](final-main-result-focused-before-branch-switch.jpg) | 用方向键进入原文件结果。 |
| [切换后 review 结果](final-live-switch-keeps-search-focus.jpg) | 旧行退出，当前查询仍在且焦点回到输入。 |
| [消息流断开期间](final-search-retains-last-confirmed-result-while-disconnected.jpg) | 仍保留上次结果与持焦行。 |
| [重新连接](final-reconnect-refreshes-search-and-returns-focus.jpg) | 原查询自动返回 main 文件，焦点交回输入。 |
| [键盘打开当前文件](final-opens-current-file-with-keyboard.jpg) | 精确地址与实际磁盘正文对应。 |
| [普通父目录事件与用户焦点](final-peer-change-respects-current-focus.jpg) | 搜索追加新文件，主输入继续聚焦。 |
| [另一个项目的同词查询](final-independent-project-keeps-own-file.jpg) | 保持独立项目路径与文件。 |

[实时切换](final-live-checkout.json)、[断线期间切换](final-reconnect-checkout.json)、[实际连接及重读](final-transport.json)、[真实新增文件](final-peer-file-create.json)、[浏览器焦点观察](final-desktop-state.json)和[持久事实](final-persisted-state.json)保留最终验收证据。
