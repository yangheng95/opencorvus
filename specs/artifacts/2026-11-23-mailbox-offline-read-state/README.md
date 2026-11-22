# 收件箱离线与真实空结果实页证据

基线 40532 运行 `main-CqtORPlK.js`，使用本批独立空项目。截图在实际 1280×720 桌面查看。前后不注入请求或消息，以同一个真实自有服务的正式停止和重启验证。

| 原图 | 实际观察 |
| --- | --- |
| [01 在线空收件箱](01-baseline-en-mailbox-online-empty.jpg) | 真实成功响应和连接在线，零计数与空态有效 |
| [02 断开后假空收件箱](02-baseline-en-mailbox-offline-false-empty.jpg) | Offline 和服务不可达已出现，收件箱仍展示 Mailbox 0 与正常空文案 |
| [03 离线搜索的假无匹配](03-baseline-en-mailbox-offline-false-search-result.jpg) | 服务未监听，输入 `invoice` 立即被当成真实无匹配 |
| [04 正常重新连接后的查询](04-baseline-en-mailbox-recovered-query.jpg) | 同一页面恢复 Online，原查询和输入焦点保留，真实无匹配和前一画面文案相同 |

真实初始未过滤读 200 编号 `4809252c-498a-44e5-b03e-5e807edd5200`，恢复后过滤读 200 编号 `f80dc46f-2e10-42f8-9b3f-98b9c6c86542`。实际响应的列表与三项计数均为零。
