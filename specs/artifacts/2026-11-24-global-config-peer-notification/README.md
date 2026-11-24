# 全局默认配置的跨标签桌面证据

基线通过 `41884/ui/` 运行 `main-sNkT02-b.js`。两个测试页面均处于未选项目的全局输入栏，另一个页面验证自己的项目配置。

- [写入页在全局输入栏保存 Ask me](baseline-writer-saved-global-mode.jpg)
- [另一全局页仍显示先前的 Full access](baseline-other-global-tab-stale.jpg)
- [项目对照保有自己的显式 Full access](baseline-explicit-project-mode.jpg)
- [再次进入全局入口后才读到 Ask me](baseline-reenter-global-reads-saved-mode.jpg)

候选使用 `main-Cq7Ng1ni.js`。同时验证两个在线全局页、经本机转发后重连的全局页，以及显式配置的项目页。[真实请求与验收](../../records/2026-11/2026-11-24-global-config-peer-notification.md#实施和复验)

- [在线全局页保持原权限菜单打开并自动选中 Ask me](candidate-online-global-menu-synchronized.jpg)
- [实时连接尚未恢复时，观察页保留草稿及原状态](candidate-global-draft-before-rejoin.jpg)
- [实时连接恢复后读到全局 Ask me，原草稿仍在](candidate-global-after-rejoin-keeps-draft.jpg)
- [另一项目继续显示自己的显式 Full access](candidate-project-explicit-mode-retained.jpg)
