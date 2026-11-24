# 同一个项目用不同拼写打开时的草稿证据

基线静态入口 `main-AWoNT5go.js` 在实际桌面 `/ui/` 运行。使用两个临时项目、各一条空白会话和真实浏览器本地未发送输入。本人复核以下截图。

| 步骤 | 结果 |
| --- | --- |
| [Alpha 项目主页写原草稿](baseline-alpha-project-draft.jpg) | 原路径小写，输入第一份原文。 |
| [独立 Beta 项目草稿](baseline-independent-project-draft.jpg) | 项目与输入为自己的一份记录。 |
| [直接打开 Alpha 的大小写路径变体](baseline-same-project-alias-empty.jpg) | 服务器承认同一项目，大小写变体打开后输入空白。 |
| [别名也在保存自己的输入](baseline-alias-separate-draft.jpg) | 在变体路径键入第二段。 |
| [原项目行重新打开](baseline-original-spelling-restores-draft.jpg) | 第一段仍属原拼写且可以恢复。 |
| [已建会话另有草稿](baseline-saved-session-own-draft.jpg) | 同项目已建会话的正文单独保留。 |
| [再次打开大小写变体](baseline-alias-reopened-with-own-draft.jpg) | 仍出现第二段，明确有两份不同的实际输入。 |

[真实目录检查和项目响应](baseline-project-identities.json)确认两种 Alpha 拼写的同一项目 ID 与独立 Beta 项目 ID。

候选静态入口 `main-BROy0g4u.js` 在同一 `http://127.0.0.1:41994/ui/` 使用旧版实际保存的草稿库。以下截图均在真实桌面页面操作后留取并逐张复核。

| 步骤 | 结果 |
| --- | --- |
| [升级后直接打开原项目](candidate-canonical-two-drafts.jpg) | 原路径和变体路径的旧稿各保留一段，中间有空行。 |
| [通过目录选择打开大写路径](candidate-alias-two-drafts.jpg) | 大写路径进入同一项目，输入区呈现同样两段。 |
| [变体路径追加后返回项目列表入口](candidate-original-shows-later-edit.jpg) | 原项目输入区立即读出新增第三段。 |
| [切换独立项目](candidate-other-project-retains-draft.jpg) | Beta 首页恢复自己的原稿。 |
| [重新打开已建会话](candidate-saved-conversation-retains-draft.jpg) | Alpha 会话恢复自己的回复草稿。 |
| [重新从会话进入项目首页](candidate-reopened-retains-full-edit.jpg) | 三段保存内容按原顺序各出现一次，仍可编辑。 |

[输入区观察值](candidate-desktop-drafts.json)保留原文与行间距。[服务数据库核对](candidate-backend-durable-state.json)记录两条原会话、完整性检查及消息、消息片段和模型请求计数。
