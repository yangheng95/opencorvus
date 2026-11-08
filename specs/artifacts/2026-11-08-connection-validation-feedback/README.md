# 连接校验反馈证据

对应[调查与方案](../../records/2026-11/2026-11-08-connection-validation-feedback.md)。仅自有临时 profile/project，本地非法地址准入、原地双语与键盘/诊断；不使用真实凭据、密码、模型或产品消息。

真实前/后态截图和只读观察将在交互后登记。公开占位 user-info 只含 b15-public-placeholder 用户名，无密码，不进入认证请求。没有 UI 自动化测试或 DOM/截图断言。

前态 38948/main-C-qzEdCk.js，1280×720，三张均人工查看：

- 01-before-fragment-english.jpg：原有效本机 URL 仅加 #b15，经 Tab/Return 的真实本地拒绝；Save 焦点保持。
- 02-before-stale-english-notice.jpg：同页面原地中文，旧反馈仍整句英文。
- 03-before-mixed-validation-summary.jpg：同非法 URL 再校验，中文前缀内仍嵌英文校验说明。
- before-observations.json：实际原地址、两次错误、焦点及原生下一 Tab；最后仅编辑恢复原有效 URL，未保存它。

本人前态 IAB 33 已关闭，服务正常 shutdown，原启动句柄 75233 exit 0。没有复现本地拒绝后的失焦，故产品 busy/字段/按钮原合同保持，不据此声称全部长时连接分支通过。

最终 38949/main-BydIgfm3.js、NetworkPanel-D5TKXP8n.js，1280×720。04–18 逐张人工查看：

| 实际路径 | 英文截图 | 同一错误原地中文截图 |
| --- | --- | --- |
| fragment，本机原地址+#b15 | 04-after-fragment-english.jpg | 06-after-fragment-chinese-details-kept.jpg |
| malformed，非空 http:// | 07-after-malformed-english.jpg | 08-after-malformed-chinese.jpg |
| unsupported_protocol，自有端口 FTP | 09-after-protocol-english.jpg | 10-after-protocol-chinese.jpg |
| query，原地址+?b15=public-placeholder | 11-after-query-english.jpg | 12-after-query-chinese.jpg |
| user_info，只有公开占位用户名、无密码 | 13-after-user-info-english.jpg | 14-after-user-info-chinese.jpg |

- 05-after-fragment-original-details.jpg：原生 Tab/Return 展开实际原错误/调用栈；06 同一 Details 保持打开且原诊断保真，返回英文也保留。
- 15-after-empty-query-chinese.jpg：实际尾随空 ? 同样显示准确“查询部分”说明。
- 16-after-empty-structural-details.jpg：真实空地址结构 TypeError，中文动作级摘要和原 Details。
- 17-after-original-input-restored.jpg：仅编辑恢复原地址清错，无有效 URL Save。
- 18-after-reopened-original-applied-url.jpg：主界面在线原端口后，重新挂载 Network 仍读原已应用地址，密码空。
- after-observations.json：各实际输入/摘要/原错误、Save 焦点、原生 Tab、Details 打开状态、最终在线端口与重开原地址的只读观察。

未伪造页面异常。纯数据/服务 46 测试/132 断言、typecheck/i18n 2921 键/最终 build/renderer/docs/architecture 通过，不代替上述实页；原生激活失败及完整内部 cause 链未做真实页面验收。最初未创建浏览器的中间 after 服务正常退役后才最终构建，最终 UI 身份以上述实页实际来源为准。本人三个服务启动句柄均正常 exit 0，两个页面已关闭，无凭据、模型或消息使用。
