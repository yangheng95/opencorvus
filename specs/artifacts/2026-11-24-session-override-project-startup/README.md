# 会话覆盖保存的桌面证据

基线 `41760/ui/` 加载正式 `main-DPV2Gw9j.js`，1280×720 实际桌面。

- [受保护项目同一会话覆盖写入的真实错误](baseline-protected-session-override-error.jpg)。
- [普通项目已重新打开、显示真实持久覆盖的对照](baseline-writable-session-override-saved.jpg)。
- [两条正式 PATCH 及前置栈](baseline-session-override-requests.json)；[两项会话配置与专家团目录的正式读回](baseline-session-override-reads.json)。

候选 `41762/ui/` 加载相同的前端资源，变更来自后端项目作用域和配置校验。

- [受保护项目保存 Base 后显示成功通知及会话覆盖](candidate-protected-session-override-saved.jpg)。
- [新标签页从任务看板重新打开后，项目选择是 Dynamic，会话仍使用 Base](candidate-protected-session-override-reopened.jpg)。
- [点击 Inherit Project 后，项目与会话都使用 Dynamic](candidate-protected-session-override-cleared.jpg)。
- [返回原会话后仍显示原草稿和待开始状态](candidate-protected-draft-reopened.jpg)。
- [设置覆盖的两项目正式读取](candidate-session-override-saved.json)与[清除后的两项目读取](candidate-session-override-cleared.json)。
- [显式技能挂载的正式配置与冷启动响应](candidate-runtime-explicit-skill-mounts.json)，以及[实际写请求、SQLite（嵌入式数据库）记录和保护文件](candidate-persistence-and-requests.json)。
