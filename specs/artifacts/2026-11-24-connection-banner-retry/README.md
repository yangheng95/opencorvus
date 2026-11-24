# 离线提示按钮的真实桌面证据

基线 `41800/ui/` 提供 `main-DoKTFShX.js`，使用两个隔离的真实桌面标签页。

- [干净文件仍在工作台，提示提供 Reload](baseline-offline-before-reload.jpg)。
- [另一标签页的独立未保存草稿及同一离线动作](baseline-offline-unsaved-draft.jpg)。
- [专用服务停止、实际浏览器错误和草稿观察](baseline-observed-outcome.json)。

候选 `41802/ui/` 提供 `main-BMcmOYAm.js`。在同一个桌面标签页完成实际离线重试和重启恢复。

- [单击 Retry now 后工作台仍打开，底部显示离线，编辑器保留第三行和未保存标识](candidate-offline-after-retry.jpg)。
- [专用服务重启后恢复在线，同一文件继续显示第三行和未保存标识](candidate-reconnected-with-draft.jpg)。
- [真实监听、工作记录事件、文件重读及数据库结果](candidate-observed-outcome.json)。
