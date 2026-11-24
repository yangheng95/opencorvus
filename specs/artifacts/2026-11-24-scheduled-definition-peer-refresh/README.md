# 定时计划在多个标签的真实状态证据

- [观察页已打开原计划的启用详情](baseline-observer-plan-active.jpg)
- [操作标签实际收到暂停回执](baseline-actor-confirmed-paused.jpg)
- [观察页仍显示旧启用状态和 Pause](baseline-observer-stale-active.jpg)
- [旧暂停操作收到正式的修订版本冲突](baseline-stale-pause-conflict.jpg)
- [显式检查状态后读到已暂停版本](baseline-explicit-check-reads-paused.jpg)

候选保持三张实时页面和已保存的对照计划，并通过独立转发验证通知流重连。

- [观察详情在操作页暂停后自动更新](candidate-observer-paused-live.jpg)
- [列表保留搜索结果和主计划的键盘焦点](candidate-list-keeps-focused-plan.jpg)
- [另一页启用计划时，作者草稿和项目选择保留](candidate-peer-resume-retains-draft.jpg)
- [旧表单送出后收到真正的版本冲突，输入仍在](candidate-draft-revision-conflict.jpg)
- [中断通知连接时观察页展示上次已读的状态](candidate-observer-while-stream-held.jpg)
- [恢复连接后原详情自动读到当前暂停状态](candidate-observer-refreshed-on-reconnect.jpg)

[调查、持久投递事实和验收](../../records/2026-11/2026-11-24-scheduled-definition-peer-refresh.md)
