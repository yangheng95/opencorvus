# 浏览器预览地址草稿与反馈：桌面验收

使用本人新建的隔离浏览器标签和项目开发服务 `/ui/`，所有截图是实际页面原图，已逐张打开查看。网址均为本人服务的环回地址；空会话由真实会话接口建立，未发送消息，未使用凭据或模型。[实施记录](../../records/2026-11/2026-11-10-browser-preview-address-feedback.md)

| 图 | 旧版 `39318`，`main-LObTv6Nj.js` |
| --- | --- |
| [01](01-before-enter.jpg) | 实际回车产生红色反馈；外部打开是独立按钮。 |
| [02](02-before-stale-edit.jpg) | 将地址换成同服务 `/doc`，上次提示仍显示。 |
| [03](03-before-escape.jpg) | Escape 保留了刚才的草稿和旧提示。 |
| [04](04-before-mixed-language.jpg) | 切换中文后仍保留上次英文提示。 |

[旧版启动](before-startup.json) · [旧版关停](before-shutdown.json)

| 图 | 修复版 `39319`，`main-mIr4Kv6b.js` |
| --- | --- |
| [05](05-after-english-guidance.jpg) · [06](06-after-live-chinese-guidance.jpg) | 原地址仍在，回车指引不使用错误样式；同一条可见指引随界面切换为中文。 |
| [07](07-after-edit-clears-guidance.jpg) · [08](08-after-escape-empty.jpg) | 换地址即清理上次反馈；再次回车后 Escape 恢复普通空标签，地址栏仍聚焦，面板仍开。 |
| [09](09-after-invalid-address.jpg) · [10](10-after-invalid-details.jpg) · [11](11-after-corrected-draft.jpg) | 点击外部打开拒绝 `file:`，显示当前语言摘要；展开可读完整原诊断，改填有效环回地址后清除错误。 |
| [12](12-after-second-tab-empty.jpg) · [13](13-after-first-tab-keeps-draft.jpg) | 第二个普通预览从空地址开始，切回第一个仍是原地址。 |
| [14](14-after-task-address.jpg) · [15](15-after-task-draft.jpg) · [16](16-after-task-restored.jpg) | 固定任务预览显示原已发布地址；改填 `/doc` 并回车后 Escape 恢复真实任务地址和焦点。 |
| [17](17-after-external-open.jpg) | 普通标签按 Tab、Enter 激活外部按钮后确实打开另一标签；页面观测绑定同一完整环回地址。 |

[修复版启动](after-startup.json) · [实际外开和两次空会话读取](after-facts.json) · [发布目标与真实接口检查](after-seed-tcp.json) · [交互后同一目标回读](after-settled-tcp.json) · [数据库计数](database-facts.json) · [修复版关停](after-shutdown.json) · [监听及进程结清](closed-listeners.json)
