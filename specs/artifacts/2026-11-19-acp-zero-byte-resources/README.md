# ACP 零字节资源验收

第 321 批，2026-11-19，本人独立调查。规格见[根因、影响和方案](../../records/2026-11/2026-11-19-acp-zero-byte-resources.md)。隔离本机流式参与者，不代表外部模型验收。无凭据或用户项目数据。

- [实际基线请求、原件、历史和协议响应](baseline-runtime.json)
- [同一数据库正常重启后的复现](baseline-restart-runtime.json)
- [两个独立项目并发各两轮](baseline-shared-audit.json)
- [正常退出后只读持久事实](baseline-persistence.json)
- [真实执行生命周期事件](baseline-lifecycle.json)
- [本人所见网页基线：只显示任务文字](baseline-empty-ingress.png)

普通提示、注册命令和网页对话中的空资源均被跳过；公开上传的空原件可读，但 load/fork 都在数据网址的非空校验处失败。resume 和后续提示正常。一次对照网页链接误把 ACP `assistant` 会话标为网页 `conversation`，界面正确拒绝该链接；未据此登记产品缺陷，网页证据仅使用实际网页对话。

候选实施与验收待完成。
