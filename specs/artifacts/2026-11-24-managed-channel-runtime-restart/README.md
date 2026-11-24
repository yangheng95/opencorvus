# 通道重启的真实桌面和回环证据

基线 `41730/ui/`，正式前端 `main-DPV2Gw9j.js`，桌面 1280×720。两个自有项目使用各自的回环端点。

- [目标项目重启前的真实运行状态](baseline-east-before-restart.jpg)及[同一目标重启后的已配置但停用状态](baseline-east-disabled-after-restart.jpg)。
- [另一项目在目标重启后继续运行](baseline-west-running-after-east-restart.jpg)。
- [正式重启请求和回环事件](baseline-channel-restart-receipts.json)，以及[两个项目重启后的正式状态](baseline-after-channel-restart.json)。

候选 `41732/ui/` 使用相同正式前端和桌面尺寸。

- [东区重启后实际运行](candidate-east-running-after-restart.jpg)，[设置页保留的新回环地址](candidate-east-current-homeserver.jpg)，[西区保持运行](candidate-west-running-after-east-restart.jpg)。
- [两次正式重启回执、各自地址握手计数和一次配置变更](candidate-channel-restart-receipts.json)，以及[重启后实际同步与隔离数据库计数](candidate-restart-settlement.json)。
