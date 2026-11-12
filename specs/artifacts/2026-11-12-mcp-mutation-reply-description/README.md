# MCP 操作回执和状态核对的实际证据

## 基线

- [真实初始连接](01-baseline-healthy-connection.png)
- [英语把完整 500 称作中断](02-baseline-http-error-called-interrupted.png)
- [展开可见实际 HTTP 状态和请求身份](03-baseline-http-error-details.png)
- [简体中文的同一摘要](04-baseline-http-error-chinese.png)
- [实际截断回执的对照](05-baseline-real-transport-cut.png)
- [后端完整错误、实际截断、项目读回和协议响应](baseline-receipt-evidence.json)

## 候选

- [英语的完整 HTTP 500 与独立状态核对](06-candidate-http-error-english.png)
- [简体中文的同一摘要](07-candidate-http-error-chinese.png)
- [保留的实际请求身份和原始详情](08-candidate-http-error-details.png)
- [端点恢复后真实重连](09-candidate-recovered-connection.png)
- [截断断开回执后的观察](10-candidate-cut-disconnect.png)
- [截断新增回执后的状态与草稿](11-candidate-cut-add.png)
- [实际删除的项目路径和两条精确目标](12-candidate-delete-targets.png)
- [真实批量删除后截断回执和成功读回](13-candidate-cut-delete-observed.png)
- [完整有效回执的真实新增](14-candidate-complete-add.png)
- [删除回执及首次读回都被截断](15-candidate-double-failure-chinese.png)
- [双故障的两份诊断](16-candidate-double-details.png)
- [恢复读取后的当前列表](17-candidate-live-read-recovered.png)
- [另一个隔离项目为空](18-candidate-other-project.png)
- [实际回执、读回、项目配置和远程错误](candidate-receipt-evidence.json)
- [隔离会话与零模型活动](candidate-storage-evidence.json)
- [隔离进程与监听端口关停](candidate-shutdown-evidence.json)
