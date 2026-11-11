# 配置回执发布顺序的真实证据

- [两次保存响应反序](baseline-overlap-evidence.json)记录项目和全局的两个真实保存回执、送达顺序、界面服务的投影变化和独立配置读取。
- [较新读取在旧保存回执前完成](baseline-read-before-receipt-evidence.json)记录同一问题在第二份当前配置来自规范读取时的结果。
- 候选的[两次保存响应反序](candidate-overlap-evidence.json)和[较新读取在旧保存回执前完成](candidate-read-before-receipt-evidence.json)记录两种范围的规范配置核对、已接受投影和独立持久值。
- 项目设置在[首读失败](01-project-config-cut.png)后发起[重试](02-project-retry.png)，并从桌面[保存项目表单](03-project-save.png)。另一笔已保存值[先由页面接受](04-project-current-before-receipt.png)，在[旧回执送达时](05-project-current-after-receipt.png)及[随后核对完成](06-project-reconciled.png)后仍可见。
- 全局服务商页在[首读失败](07-global-config-cut.png)后仍能[编辑和保存第一行](08-global-save.png)。页面重读[接受两个新名称](09-global-current-before-receipt.png)，[原回执到达且两个后续读取仍在途](10-global-current-after-receipt.png)和[表单保存流程完成](11-global-reconciled.png)时继续显示相同名称。
- [桌面实际回执](desktop-config-evidence.json)记录上述请求顺序、两次独立写入、在途与放行的读取和三项正式接口响应校验。

数据来自隔离开发服务和生产浏览器传输。截图由本人复核。[根因、影响和验收](../../records/2026-11/2026-11-12-config-receipt-publication-order.md)
