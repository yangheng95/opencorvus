# 收件箱离线与真实空结果实页证据

基线 40532 运行 `main-CqtORPlK.js`，使用本批独立空项目。截图在实际 1280×720 桌面查看。前后不注入请求或消息，以同一个真实自有服务的正式停止和重启验证。

| 原图 | 实际观察 |
| --- | --- |
| [01 在线空收件箱](01-baseline-en-mailbox-online-empty.jpg) | 真实成功响应和连接在线，零计数与空态有效 |
| [02 断开后假空收件箱](02-baseline-en-mailbox-offline-false-empty.jpg) | Offline 和服务不可达已出现，收件箱仍展示 Mailbox 0 与正常空文案 |
| [03 离线搜索的假无匹配](03-baseline-en-mailbox-offline-false-search-result.jpg) | 服务未监听，输入 `invoice` 立即被当成真实无匹配 |
| [04 正常重新连接后的查询](04-baseline-en-mailbox-recovered-query.jpg) | 同一页面恢复 Online，原查询和输入焦点保留，真实无匹配和前一画面文案相同 |

真实初始未过滤读 200 编号 `4809252c-498a-44e5-b03e-5e807edd5200`，恢复后过滤读 200 编号 `f80dc46f-2e10-42f8-9b3f-98b9c6c86542`。实际响应的列表与三项计数均为零。

候选 40534 运行 `main-Bnc6E267.js`。保留同一标签，通过正式关停和实际重启完成两次隔离断线。

| 原图 | 实际观察 |
| --- | --- |
| [05 英文在线空箱](05-candidate-en-mailbox-online-empty.jpg) | 实际读回后显示原有计数 0 和空态 |
| [06 英文断线](06-candidate-en-mailbox-offline-wait.jpg) | 状态为 Offline，收件箱完整显示等待连接 |
| [07 英文离线输入](07-candidate-en-mailbox-offline-query-retained.jpg) | `invoice` 可编辑且持焦，主体仍为等待连接 |
| [08 英文重连接纳查询](08-candidate-en-mailbox-reconnect-result.jpg) | 原查询持焦，Online 及实际无匹配出现 |
| [09 简中断线仍可见查询](09-candidate-zh-mailbox-offline-query.jpg) | 原查询持焦，标题没有占位数量，等待提示完整 |
| [10 简中重连接纳查询](10-candidate-zh-mailbox-reconnect-result.jpg) | 中文无匹配、0 计数和在线状态同时可见 |
| [11 简中清除查询](11-candidate-zh-mailbox-clear-query.jpg) | 回到真实空箱，原搜索输入继续持焦 |

通过正式接口核对的候选响应均为 200、零邮件／未读／活动／归档数量及空游标。下表来自实际响应头。

| 读取状态 | 无查询 | `invoice` |
| --- | --- | --- |
| 候选初次在线 | `14177ccb-93b8-485e-aa66-8404750b4492` | `138e31d4-8b0d-4d93-9ff0-a81af08d95c0` |
| 第一次恢复 | `5d3871de-79b7-48aa-885f-45d497ba628b` | `8c444745-623f-41b5-ac88-87c73eff0185` |
| 第二次恢复 | `333732d9-0437-4984-9bb5-b3146fcbbca4` | `f2a478aa-ad02-4257-bda2-d193526f29f0` |
