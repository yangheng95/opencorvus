# 已存分叉会话选择的桌面验证

已推送构建 `5a88c918f` 的 Windows Chrome 连接隔离开发服务 `40048/ui/`。真实公开会话请求成功返回，选中带分叉的父会话时，右栏持续挂载的子会话列表触发选择错误。

- [从侧栏直接打开父会话](baseline-parent-selection-failed.png)
- [同一构建正常打开独立会话](baseline-unrelated-session-open.png)
- [从正常会话切换到父会话](baseline-switch-to-parent-failed.png)
- [真实浏览器请求和错误堆栈](baseline-desktop.json)
- [已存父子身份、执行终态与公开活动投影](baseline-ownership.json)
- [行所有权修复后暴露的状态图标映射异常](candidate-unobserved-icon-diagnostic.jsonl) 和 [实际页面](candidate-before-status-mapping.png)

最终开发服务 `40052/ui/` 打开同一份持久数据。

- [父会话与主进度卡](final-parent-open.png) 和 [实际分叉消息](final-child-open.png)
- [英文下拉状态](final-status-selector-en.png) 与 [中性历史状态行](final-unobserved-list-en.png)
- [同一行运行中](final-live-running-en.png) 与 [结算为空闲](final-live-settled-en.png)
- [切到独立会话](final-switch-to-other-en.png) 和 [返回父会话](final-return-parent-en.png)
- [中文成员列表](final-zh-list.png) 和 [用回车打开真实会话](final-zh-row-keyboard-open.png)
- [公开请求、数据库和实际流式轮次](candidate-runtime.json)

截图已逐张人工复核。
