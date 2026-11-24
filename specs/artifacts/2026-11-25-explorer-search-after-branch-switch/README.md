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
