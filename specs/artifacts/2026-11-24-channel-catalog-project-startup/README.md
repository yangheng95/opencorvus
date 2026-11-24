# 通道目录启动边界的实际证据

基线 `41720/ui/` 加载正式 `main-DPV2Gw9j.js`，桌面 1280×720。

- [受保护项目的目录错误](baseline-protected-channel-directory-error.jpg)及[初次读取和真实重试请求](baseline-protected-channel-errors.json)。同一设置页仍显示对应项目及正常读取的公网地址配置区。
- [普通项目的目录对照](baseline-writable-channel-directory.jpg)及[两个原项目的正式接口状态](baseline-direct-catalog.json)。
- [已启用的回环 Matrix 通道](baseline-local-matrix-running.jpg)及[实际运行状态、一次握手和真实同步请求](baseline-local-matrix-receipt.json)。运行对照使用产品适配器和独立回环协议夹具。

候选 `41722/ui/` 使用同一前端入口和桌面尺寸。

- [受保护项目的可读目录](candidate-protected-channel-catalog.jpg)、[实际打开的 IRC 原配置](candidate-protected-irc-settings-readable.jpg)和[普通项目对照](candidate-writable-channel-catalog.jpg)。[两个项目的正式配置和目录回执](candidate-direct-catalog.json)
- [受保护项目中的实际 Matrix 运行状态](candidate-protected-local-matrix-running.jpg)。[握手、同步、重复读取及原项目文件的核对](candidate-local-matrix-receipt.json)
- [隔离数据库实际执行和通道入站计数](candidate-execution-counts.json)。
