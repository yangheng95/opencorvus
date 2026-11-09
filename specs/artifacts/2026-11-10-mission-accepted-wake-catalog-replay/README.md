# Mission 已接受请求在模型目录变更后的重放证据

隔离真实服务 39374、两个临时 Git Project。模型仅用于投影和选择证据，实际地址为关闭的本机端口，未复制凭据，也未验收模型答复。

- [首次和同目录对照](seed.json)、[目录下线后的实际回执](before.json)、[持久消息、模型和执行轮次](before-database.json)。
- [桌面截图：主项目中实际打开已接受的原派发](01-before-retired-dispatch.jpg)。正文、原模型和真实失败的已结束答复可见。
- [隔离服务启动](before-startup.json)与[关停](before-shutdown.json)。
- [真实 HTTP 检查器](check-mission-catalog.mjs)与[只读持久证据检查器](snapshot-mission-catalog.py)。

## 修复后

- [同一数据库重新启动后的回执](after.json)及[持久事实](after-database.json)；[真实重启后的回执](restart.json)及[持久事实](restart-database.json)。
- [01 基线：原派发](01-before-retired-dispatch.jpg)；[02 真实桌面发送前的已选旧模型](02-desktop-explicit-model-ready.jpg)；[03 回执截断后保留的原输入](03-desktop-lost-receipt.jpg)；[04 目录下线后重试进入原会话](04-desktop-replayed-original.jpg)；[05 看板上的单条结果](05-desktop-one-mission-card.jpg)。
- [真实桌面请求及配置切换的验收事实](desktop-acceptance.json)与[检查器](check-desktop-catalog.mjs)。[本地代理](desktop-catalog-proxy.mjs)只对隔离项目的实际发送截断首次成功响应，在重发抵达后先用实际配置路由替换目录，再原样转发。
- [实际工作台构建入口](after-asset.json) · [初启](initial-startup.json)与[关停](initial-shutdown.json) · [重启](after-startup.json)与[关停](restart-shutdown.json) · [代理关停](proxy-shutdown.json) · [全部验收进程与端口退出](owned-cleanup.json)。
