# 配置读取与保存顺序的真实回执

[真实请求回执](real-config-order.json)记录项目与全局的旧配置读、真实保存、独立持久值，以及较早配置送达前后的客户端投影。候选另记录随后发起的新读取和正式接口定义校验。

- 项目设置在[读取失败](01-project-config-failure.png)后发起[重试](02-project-config-retry.png)。该响应在途时，服务商表单[保存新名称](03-project-save-in-flight.png)。较早配置[放行前](04-project-commit-before-release.png)与[实际送达后](05-project-commit-after-release.png)都显示新项目行。
- [全局列表](06-global-before.png)只有全局服务商。全局[读取失败](07-global-read-failure.png)后，[重试](08-global-read-retrying.png)与保存重叠。[放行前](09-global-commit-before-release.png)与[旧响应送达后](10-global-commit-after-release.png)均显示新全局名称。
- [桌面实际回执](desktop-config-order-evidence.json)保留项目与全局的扣留、保存、送达顺序和独立读取。全局表单保存后的正常刷新也有独立回执。

截图均为本人复核的可见桌面页面。[根因、影响与验收](../../records/2026-11/2026-11-11-config-read-after-commit.md)
