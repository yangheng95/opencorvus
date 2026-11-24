# 通道目录启动边界的实际证据

基线 `41720/ui/` 加载正式 `main-DPV2Gw9j.js`，桌面 1280×720。

- [受保护项目的目录错误](baseline-protected-channel-directory-error.jpg)及[初次读取和真实重试请求](baseline-protected-channel-errors.json)。同一设置页仍显示对应项目及正常读取的公网地址配置区。
- [普通项目的目录对照](baseline-writable-channel-directory.jpg)及[两个原项目的正式接口状态](baseline-direct-catalog.json)。
- [已启用的回环 Matrix 通道](baseline-local-matrix-running.jpg)及[实际运行状态、一次握手和真实同步请求](baseline-local-matrix-receipt.json)。运行对照使用产品适配器和独立回环协议夹具。
