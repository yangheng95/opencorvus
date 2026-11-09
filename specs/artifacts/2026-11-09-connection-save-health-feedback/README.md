# 连接保存与健康回执证据

三套隔离开发服务实际运行产品，桌面页面用真实键盘和鼠标操作。截图采集后均已人工查看。

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-network-initial.jpg) | 基线网络连接表单 |
| [02](02-before-invalid-server-health-still-shows-saved.jpg) | 实际探测 400 后只有 Saved，键盘焦点脱离按钮 |
| [03](03-before-stable-network-after-failed-health.jpg) | 基线随后只有全局离线横幅 |
| [04](04-before-reopened-saved-offline-address.jpg) | 基线重开后仍保留地址 |
| [05](05-before-correct-endpoint-same-saved-caption.jpg) | 基线健康端点呈现相同 Saved |
| [06](06-after-save-shows-connection-check-failure.jpg) | 改后就地显示两种事实，Save 保持焦点 |
| [07](07-after-keyboard-opens-real-health-diagnostic.jpg) | 下一 Tab、Enter 展开实际 400 和请求编号 |
| [08](08-after-same-diagnostic-in-chinese.jpg) | 原地中文，原诊断保持展开 |
| [09](09-after-offline-address-retained-across-reload.jpg) | 改后重开后仍保留离线地址 |
| [10](10-after-valid-address-saves-with-keyboard-focus.jpg) | 健康端点继续显示「已保存」，焦点仍在按钮 |
| [11](11-after-existing-local-url-rejection.jpg) | 现有本地片段校验及键盘焦点 |
| [12](12-after-saved-address-before-server-listens.jpg) | 39116 无监听者时的真实失败 |
| [13](13-after-same-address-recovers-without-editing.jpg) | 地址没变，后台探测成功后消息退出 |
| [14](14-after-live-recovery-port-and-workspace.jpg) | 主界面在线，观察数据记载实际端口 39116 |

[基线观察](before-observed.json)、[改后观察](after-observed.json)及[持久和实际请求核对](owned-final-check.json)。实际启动回执：[39114](before-startup.json)、[39115](after-startup.json)、[39116](recovery-startup.json)。[独立检查器](check-connection-tcp.mjs)走真实服务，[基线](before-tcp.json)、[改后](after-tcp.json)、[自动恢复目标](recovery-tcp.json)均按各自在线契约验收。[原项目记录](seed.json)和[持久核对脚本](audit-owned-connection.py)可核对三项目未启动任何会话或供应商请求；三个服务已正常关停。
