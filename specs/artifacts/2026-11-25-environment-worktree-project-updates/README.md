# 环境面板接收工作树列表变化的证据

基线加载实际服务端 `/ui/` 的 `main-tH9P1XWW.js`。用无凭据的独立配置与临时 Git 项目创建真实空白对话，按正常项目路由创建实际托管工作树。截图为桌面页面原视口，由本人复核。

| 实际步骤 | 可见状态 |
| --- | --- |
| [打开环境](baseline-before.jpg) | 找到 Workspace 下的 Worktree，只有主工作树时显示确认空态。 |
| [其它入口创建成功后](baseline-after-create.jpg) | 保持打开的同一面板仍显示确认空态。 |
| [按原 Refresh](baseline-manual-refresh.jpg) | 同一位置出现 `opencorvus/peer-list-review`，刷新控件仍持焦。 |

[真实回执](baseline-receipt.json)包含同一目录创建前后的实际列表、创建响应、原始全局与统一通知流收到的事件。`git worktree list --porcelain` 确认主和托管工作树都指向初始对象 `3b92f269196f70c935bc16fbf739feab2a8c8fcb`，分支分别为 `main` 与 `opencorvus/peer-list-review`。从托管目录再发真实列表请求返回这一对相同行。未删除工作树或发送模型请求。
