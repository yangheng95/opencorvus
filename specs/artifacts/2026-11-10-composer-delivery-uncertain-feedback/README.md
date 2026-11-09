# 主输入区区分消息接收未确认与发送前失败证据

[修改前英文桌面截图](../2026-11-10-mission-accepted-wake-catalog-replay/03-desktop-lost-receipt.jpg)显示页面声称发送失败，但同一真实 Mission 已在项目列表中。[基线业务请求、服务回执和原消息](../2026-11-10-mission-accepted-wake-catalog-replay/desktop-acceptance.json)可核对。该项目与服务是本人隔离验收用例，未使用真实 Provider 凭据。

## 修改后真实桌面

| 场景 | 本人已查看的截图 |
| --- | --- |
| 发送前的真实引用错误 | [01](01-preparation-failed.jpg) |
| 普通会话已通过真实用户消息确认接收，后续响应中断 | [02](02-accepted-reply-unconfirmed.jpg) |
| 英文 Mission 接收未确认、详情和重试 | [03](03-en-unconfirmed.jpg) · [04](04-en-transport-details.jpg) · [05](05-en-replayed.jpg) |
| 简体中文 Mission 接收未确认及重试 | [06](06-zh-unconfirmed.jpg) · [07](07-zh-replayed.jpg) |

[实际服务和只读持久证据](desktop-acceptance.json) · [检查器](check-composer-receipts.py) · [本地真实传输代理](composer-receipt-proxy.mjs) · [隔离模型投影](fixture-config.json) · [开发工作台资产](after-asset.json) · [服务启动](after-startup.json) · [服务关停](after-shutdown.json) · [代理关停](proxy-shutdown.json) · [所有进程退出](owned-cleanup.json)。
