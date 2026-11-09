# 健康响应辨别证据

基线和改后均为真实开发模式 `/ui/`。两台临时本机代理只改变请求路径，将生产端返回的原始响应转给浏览器。截图由本人实际操作与复核。

| 图 | 真实页面结果 |
| --- | --- |
| [01](01-before-real-html-200-is-rejected.jpg) | 基线已拒绝 HTML 200 |
| [02](02-before-misrouted-production-json-save.jpg) | 基线空列表 JSON 显示 Saved |
| [03](03-before-misrouted-production-json-reported-online.jpg) | 基线误把代理端口标为在线 |
| [04](04-after-misrouted-production-json-rejected.jpg) | 改后同一真实正文显示探测失败 |
| [05](05-after-exact-health-shape-diagnostic.jpg) | 实际详情指出缺少布尔健康字段 |
| [06](06-after-chinese-settings-keeps-original-diagnostic.jpg) | 原地中文，原诊断保持 |
| [07](07-after-misrouted-production-json-offline.jpg) | 主界面如实离线 |
| [08](08-after-reloaded-client-stays-offline.jpg) | 重新加载持久地址仍进入离线 |
| [09](09-after-real-health-saves-normally.jpg) | 正确健康地址保存成功 |
| [10](10-after-real-health-publishes-online.jpg) | 在线并重新显示隔离项目 |

[基线观察](before-observed.json)、[改后观察](after-observed.json)、[反向代理](misrouted-health-proxy.mjs)和[真实请求检查器](check-health-tcp.mjs)。实际网络记录：[39117/39119](before-tcp.json)、[39118/39120](after-tcp.json)、[基线代理](before-proxy-observed.json)、[改后代理](after-proxy.log)。[原项目记录](seed.json)、[数据及请求核对脚本](audit-owned-health.py)和[实际结果](owned-final-check.json)证实两个真实服务及代理、18 个请求标识和项目范围。服务启动回执分别为[基线](before-startup.json)及[改后](after-startup.json)。
