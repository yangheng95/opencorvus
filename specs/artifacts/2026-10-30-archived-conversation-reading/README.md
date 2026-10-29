# 归档会话阅读、明确恢复与选中身份

对应[调查记录](../../records/2026-10/2026-10-30-archived-conversation-reading.md)。单agent负责实现和实页人工复核；未新增或运行UI（User Interface，用户界面）自动化。所有操作都在完整复制库的自有开发 `/ui` 页面，用户18571页面、进程和数据库未操作。

## 实页截图

| 截图 | 事实与范围 |
| --- | --- |
| [01](01-original-history.png) | 修改前，已有3条真实消息的原生Chat，原附件和Sources可见。 |
| [02](02-archived-history-unnamed.png) | 原生归档后重开原链接：历史仍在，标题退为Chat且没有归档提示。 |
| [03](03-archived-send-enabled.png) | 修改前归档页面仍允许输入并启用Send；只输入自有草稿，没有发送。 |
| [04](04-archived-reading.png) | 首候选失败原件：新增读者在空初始状态错误解引用，导致空白；已修正并更换自有候选验证。 |
| [05](05-archive-date-placeholder.png) | 第二候选保留标题、历史和只读状态；截图发现日期占位符及错误的连接提示，均已修正。 |
| [06](06-archived-reading-final.png) | 最终英文归档阅读：准确标题、本地化日期、明确Restore和只读原因。 |
| [07](07-archived-source-original.png) | 实际点击Sources，打开原70字节JSON附件，真实check/answer/status可读。 |
| [08](08-archived-chinese.png) | 同一页面中文日期、归档说明、恢复入口和只读输入；用户/模型原文保持。 |
| [09](09-restored-editable.png) | 点击真实恢复后同一会话、历史与附件保留；输入可用、焦点返回，草稿未发送。 |
| [10](10-completed-task.png) | 原已完成Task真实标题、完成状态、计时与原交付历史。 |
| [11](11-closed-mission.png) | 原已关闭Mission准确标题、非进行中和原问候历史；未重开执行。 |
| [12](12-returned-draft.png) | 跨Task/Mission后回到原会话，真实自有草稿保留；随后清空。 |
| [13](13-home-current.png) | 默认页正常呈现，保留持续目标提示和输入布局。 |
| [14](14-home-goal-entry.png) | 实点默认页＋菜单的持续目标，创建表单可读且焦点正确；关闭而未提交。 |

最终冻结前端为普通构建 `main-Dqywgej9.js`，最后服务端口38378。失败候选保持原件，不热改已启动的冻结资源。4个自有native阶段共享原始固定截止；均公开shutdown、原进程物理/输出/请求结清并退休复制auth/完整models，实际Provider请求0。凭据内容不在产物中。

## 验证边界

原件入口：[精确读取与控制测试7项/69断言](test-final-contracts-output.json)、[独立Goal合同15项/119断言](test-goal-final-output.json)、[官方SDK构建](sdk-output.json)、[API路由](api-routes-output.json)、[双语接口文档](docs-check-output.json)、[最终前端构建](build-visual-fixes-output.json)、[本地化校验](i18n-final-output.json)、[后端类型](types-core-output.json)、[前端类型](types-reviewed-output.json)。

数据与运行原件：[原值/附件/项目保全](data-qualified.json)、[通知与生命周期关联](publication-qualified.json)、[四阶段物理关闭和复制对退休](physical-retirement.json)、[最终归档读取](final-archived-readback.json)、[最终恢复读取](final-restored-readback.json)、[Task/Mission读取](other-readback.json)。[首候选真实启动错误](first-candidate-browser-error.json)对应04失败截图；[最终浏览器诊断](final-browser-logs.json)是补充证据，不代替人工视觉复核。

公开选中读者后端覆盖活动/归档Chat、Work、Mission、Task、跨项目/目录、普通Session与删除错误。原生开发页面验证有历史Chat归档阅读和明确恢复；Task/Mission仅真实阅读，未运行其业务或恢复执行。该库没有已有Goal的归档对象，因此已有Goal的归档详情视觉分支仍未实证；15项独立Goal持久化、归档、用量、继承和权限正向测试不冒充这一视觉验收。未做模型运行验收，未发布版本、tag或Release。
