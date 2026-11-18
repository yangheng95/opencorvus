# ACP 零字节资源验收

第 321 批，2026-11-19，本人独立调查。规格见[根因、影响和方案](../../records/2026-11/2026-11-19-acp-zero-byte-resources.md)。隔离本机流式参与者，不代表外部模型验收。无凭据或用户项目数据。

- [实际基线请求、原件、历史和协议响应](baseline-runtime.json)
- [同一数据库正常重启后的复现](baseline-restart-runtime.json)
- [两个独立项目并发各两轮](baseline-shared-audit.json)
- [正常退出后只读持久事实](baseline-persistence.json)
- [真实执行生命周期事件](baseline-lifecycle.json)
- [本人所见网页基线：只显示任务文字](baseline-empty-ingress.png)

普通提示、注册命令和网页对话中的空资源均被跳过；公开上传的空原件可读，但 load/fork 都在数据网址的非空校验处失败。resume 和后续提示正常。一次对照网页链接误把 ACP `assistant` 会话标为网页 `conversation`，界面正确拒绝该链接；未据此登记产品缺陷，网页证据仅使用实际网页对话。

候选已通过原基线的全部实际运行：

- [候选输入、原件、load/fork/resume 和真实回放身份](candidate-runtime.json)
- [同一候选库正常重启后的加载、派生、恢复与下一轮](candidate-restart-runtime.json)
- [两个独立项目并发各两轮](candidate-shared-audit.json)
- [同一网页对话提交原始空文本的完整公开历史](candidate-visible-text.json)
- [两份真实浏览器下载的原名、长度和源字节比较](browser-downloads.json)
- [候选退出后的只读持久事实](candidate-persistence.json)
- [候选真实执行生命周期](candidate-lifecycle.json)
- [两侧本机模型实际流式请求和完成](model-stream-events.json)
- [运行汇总](final-summary.json)
- [本人所见候选的零字节二进制附件](candidate-empty-ingress.png)
- [实际展开的零字节文本原件](candidate-empty-text-expanded.png)
- [正常重启后再次读取就绪的空文本](candidate-restarted-text-ready.png)

45 项聚焦正向测试、260 个断言通过，后端类型、文档、路由和架构索引通过。模型合计 64 次实际请求全部 `local`、流式并完成；没有外部模型调用。最终候选九个会话、32 条消息、98 个部件，派生历史保存真实身份，所有持久助手为 `stop`。三张候选截图由本人逐张查看，实际点击两次原件下载，建议名保留且各为零字节。服务、专用浏览器与本机模型均正常退出。
