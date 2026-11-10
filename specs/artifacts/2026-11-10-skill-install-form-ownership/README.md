# 技能安装回执与键盘焦点的桌面证据

对应 [根因、共享机制审计与验收](../../records/2026-11/2026-11-10-skill-install-form-ownership.md)。全部原图来自手工操作的真实开发 `/ui` 桌面页面。提交的只是隔离项目中确证不存在的本地目录，服务发布真实 400 错误，没有安装技能。

| 场景 | 原图 | 观察 |
| --- | --- | --- |
| 基线取消 | [英文](baseline-en-cancel-focus-body.jpg)、[中文](baseline-zh-cancel-focus-body.jpg) | 焦点落回网页。 |
| 基线等待 | [首份真实回执等待中](baseline-en-skill-install-inflight-enabled.jpg)、[第二次回车后](baseline-en-skill-install-second-error.jpg) | 可用的表单发出另一个实际请求，第二次结果先出现。 |
| 基线错误后取消 | [旧错误移到页首](baseline-en-cancel-retains-stale-error.jpg) | 表单消失，原诊断被误当成技能库通用通知。 |
| 首版观察 | [按钮上的弱等待提示](draft-en-pending-dimmed-label.jpg)、[取消后的入口焦点](draft-en-cancel-restored-trigger.jpg) | 首版等待提示偏淡；手动释放超出客户端等待时间，只证明等待期间一个请求和可恢复焦点。最终使用独立状态标签和有界真实回执。 |
| 最终英文等待 | [安装中](candidate-en-install-in-progress.jpg)、[重复回车后](candidate-en-repeat-awaits-current.jpg)、[真实错误](candidate-en-real-error-editable.jpg) | 同一实际请求的状态保持可见；真实 400 到达后表单保留输入并恢复编辑。 |
| 最终英文重试/取消 | [显式重试结果](candidate-en-explicit-retry-result.jpg)、[取消返回按钮](candidate-en-cancel-restores-trigger.jpg) | 重试有新回执；键盘取消清理表单诊断并交还焦点。 |
| 最终中文 | [正在安装](candidate-zh-install-in-progress.jpg)、[真实错误](candidate-zh-real-error-editable.jpg)、[取消返回按钮](candidate-zh-cancel-restores-trigger.jpg) | 双语使用同一实际状态，原诊断可见，焦点路径一致。 |
| 最终迟到回执 | [切离时](candidate-zh-away-before-receipt.jpg)、[回执后](candidate-zh-away-after-receipt.jpg)、[重开表单](candidate-zh-reopened-fresh-install-form.jpg)、[标题按钮收起](candidate-zh-header-close-keeps-focus.jpg) | 已离开的表单不接管当前页。重开有新表单，标题按钮保持焦点。 |

[实际请求与公开读回](receipts.json) 包括基线、首版超时和最终分别标注的响应，均来自隔离进程；没有原始响应正文或本机绝对路径。
