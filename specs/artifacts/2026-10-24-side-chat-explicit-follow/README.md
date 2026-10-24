# 侧聊的主动回到底部与发送跟随

[Recall、根因与实施方案](../../records/2026-10/2026-10-24-side-chat-explicit-follow.md)，[原始运行事实](evidence.json)，[安全请求观察](requests.jsonl)。本轮只有一个开发 agent，没有 UI（User Interface，用户界面）自动化测试。全部图片在真实 source CLI（命令行入口）`/ui/` 和内置浏览器手动交互后实际呈现、人工查看。

修改前现象见上轮[真实回复落在视口下方](../2026-10-24-memory-input-provenance/04-after-reply-outside-viewport.png)。共享阅读控制器在历史展开时正确暂停，但 Side chat 缺少明确恢复入口，发送也没有恢复当前跟随意图。本轮复用现有控制器、归属校验和读位存储，增加与主会话同义的浮动“滚动到底部”按钮，并在主动发送时恢复一次。后续输出继续尊重用户的上翻阅读。

| 实图 | 资格 |
| --- | --- |
| [01](01-expanded-history-button-en.png) | 展开原引用历史，较早原文保持，输入框上缘浮动恢复按钮可见，没有挤高输入区。 |
| [02](02-explicit-latest-reply-en.png) | 实际点击按钮，原真实回复“新的侧聊输入正常。”可见，历史展开状态保持。 |
| [03](03-paused-reader-before-send-en.png) | 再次上翻暂停后输入有限问题；原阅读位置、草稿与恢复入口实际可见。 |
| [04](04-send-follow-en.png) | 真实发送后自动回到最新，实际 Sol 回复“回到最新跟随正常。”在视口内可见。回复约两秒，首次发送后截图时已经完成。 |
| [05](05-reader-can-pause-again-en.png) | 完成后手动上翻，原历史保持并重新显示恢复按钮。 |
| [06](06-paused-reader-zh.png) | 设置中真实切到中文再返回，阅读位置保持，中文按钮无障碍名“滚动到底部”从当前可访问性状态核对。 |
| [07](07-latest-reply-zh.png) | 实际点击中文入口，原新问题和真实回答可见，周围控件及时间已本地化，用户/模型原文保持。 |

真实 Main Session `ses_-zUR5coFizznlxwzV81M` 与原 Side chat 2 `ses_-zUR54flpzzby4xUJQPT`，没有新建 Side、Goal、Task、Mission 或子 agent。模型预检 chat/memory 两请求；有限新问题 chat/memory 两请求。四次均 gpt-6.1-sol、流式 200、原 Provider source reader EOF（End Of File，读完）。规范记忆由 revision 3/221 tokens 更新为 4/321 tokens，待办正常消费。

正式 Node 全量构建 `main-BGogOrxR.js` 到新私有目录，完整 UI 通过开发 CLI 冻结交付；未启动单独 Vite，未改用户使用中的构建目录。前端类型检查通过。局部构建、类型和文档检查不能替代以上实图资格。

原 exec 29821、原生 target 82992，完整 occurrence（执行轮次）/birth 身份见 evidence；独立 20 分钟原生边界、180 秒启动无活动和五分钟收尾。公开 shutdown 200，实际预留 960,649 ms，原 exec/native/launcher 均退出 0，physical/output/request 闭合，精确原链 dead_or_reused。完整授权 OpenAI 条目和完整相邻模型目录配对复制，凭据、投影和实际模型分别验证，auth/catalog 副本各退休 1。源模型目录完整内容、9,155,406 字节和修改时间保持。

源 90 表原 174,518 行全字段/时间、数据库字节/修改时间和完整配置保持，schema 4→4、真实对象一致、integrity ok。目标原行差异仅测试项目 memory chunk/file、两条运行容量租约，以及本次确实发送新问题的原 Side chat 2 的 time_updated；原其他 Task/Mission/Session/Goal 字段保持。真实新 Message、Part 与运行事件为正常新增。用户数据库、18571进程及窗口没有参与。

本轮实际覆盖有限回复与完成后重新暂停；未实际演练长回复未完成时上翻。代码只在发送 dispatch（提交）前恢复一次，不在流式更新或完成回调恢复。原生重启和其他流式入口专项仍继续，整体 Goal active。

后续[564真实长流补充验收](../2026-10-24-side-chat-long-reading/README.md)已覆盖约102秒回复生成中的上翻、EOF后读位及另一页原Sources；原图与Provider时刻独立保留，不扩大本页当时短回复的资格。
