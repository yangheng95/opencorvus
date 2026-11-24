# 启动时同目录选择与权限配置的桌面证据

基线通过 `41836/ui/` 加载 `main-CYlZS1nj.js`，两个独立项目的权限配置预先写入各自的隔离配置文件。

- [立即重新选择已保存项目后，权限模式停在未加载](baseline-same-project-mode-not-loaded.jpg)
- [同一页面的两个模式选项都不可用](baseline-mode-options-unavailable.jpg)
- [没有提前重新选择的同项目页面正常显示 Ask me](baseline-idle-project-mode-loaded.jpg)
- [切换到另一个项目后正常显示 Full access](baseline-other-project-mode-loaded.jpg)
- [原项目从设置只读重载后才恢复 Ask me](baseline-manual-read-restores-mode.jpg)
