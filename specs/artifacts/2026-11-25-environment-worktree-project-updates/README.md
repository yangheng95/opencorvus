# 环境面板接收工作树列表变化的证据

基线加载实际服务端 `/ui/` 的 `main-tH9P1XWW.js`。用无凭据的独立配置与临时 Git 项目创建真实空白对话，按正常项目路由创建实际托管工作树。截图为桌面页面原视口，由本人复核。

| 实际步骤 | 可见状态 |
| --- | --- |
| [打开环境](baseline-before.jpg) | 找到 Workspace 下的 Worktree，只有主工作树时显示确认空态。 |
| [其它入口创建成功后](baseline-after-create.jpg) | 保持打开的同一面板仍显示确认空态。 |
| [按原 Refresh](baseline-manual-refresh.jpg) | 同一位置出现 `opencorvus/peer-list-review`，刷新控件仍持焦。 |

[真实回执](baseline-receipt.json)包含同一目录创建前后的实际列表、创建响应、原始全局与统一通知流收到的事件。`git worktree list --porcelain` 确认主和托管工作树都指向初始对象 `3b92f269196f70c935bc16fbf739feab2a8c8fcb`，分支分别为 `main` 与 `opencorvus/peer-list-review`。从托管目录再发真实列表请求返回这一对相同行。未删除工作树或发送模型请求。

## 候选页面与请求

候选 `main-BpxeHeNl.js` 经隔离中转实际提供，项目 API（Application Programming Interface，应用程序编程接口）使用同一独立源服务。

| 真实操作 | 桌面证据 |
| --- | --- |
| 保持主项目环境打开，让另一入口实际创建第一棵工作树 | [初始确认空态](verified-primary-before.jpg)和[自动出现的正确行与原焦点](verified-primary-automatic.jpg) |
| 主项目更新时，独立对照仍显示自己的列表 | [对照确认空](verified-control-after-peer.jpg)和[对照之后接纳自身的真实工作树](verified-control-own-worktree.jpg) |
| 真读取等待交付期间再创建工作树 | [主目录刷新焦点及三个有效行](verified-primary-burst.jpg)和[托管目录打开的同仓库](verified-managed-siblings.jpg) |
| 断开原事件流后创建，再恢复转发 | [保持原面板且实时更新恢复中](verified-stream-held.jpg)和[补到真实新行](verified-stream-restored.jpg) |

实际创建的查询、响应和两条流的事实可对照[首次](verified-first-receipt.json)、[第一个兄弟](verified-burst-one-receipt.json)、[第二个兄弟](verified-burst-two-receipt.json)、[独立对照](verified-control-receipt.json)、[断开期间](verified-reconnect-receipt.json)。[中转记录](verified-transport.jsonl)仅含候选相关请求、真实响应的扣留与释放、流断开与恢复。手动首读在两条成功创建通知到达前超时。其后的两个快照确实与第二条通知重叠，因而能观察到两个面板各一条尾随读取。隔离服务退出后[只读数据库检查](verified-isolation.json)确认来源和模型活动计数。
