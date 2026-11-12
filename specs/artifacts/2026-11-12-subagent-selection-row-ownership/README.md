# 已存分叉会话选择异常的真实基线

已推送构建 `5a88c918f` 的 Windows Chrome 连接隔离开发服务 `40048/ui/`。真实公开会话请求成功返回，选中带分叉的父会话时，右栏持续挂载的子会话列表触发选择错误。

- [从侧栏直接打开父会话](baseline-parent-selection-failed.png)
- [同一构建正常打开独立会话](baseline-unrelated-session-open.png)
- [从正常会话切换到父会话](baseline-switch-to-parent-failed.png)
- [真实浏览器请求和错误堆栈](baseline-desktop.json)
- [已存父子身份、执行终态与公开活动投影](baseline-ownership.json)

截图已逐张人工复核。
