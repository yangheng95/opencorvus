# 多步任务草稿的保存、重启与并发审阅

## Recall

用户要求本人独立持续调查 OpenCorvus。用户随后指出近几批集中在同类键盘改动，本轮从完整用户流程检查功能完成度。第 551 批 `2d909b229` 已与远端一致，保留原工作区 177 项状态。已读 [草稿创建与确认](2026-11-02-mission-create-feedback.md)、[已保存草稿的原请求](2026-11-12-mission-draft-receipt-open.md)、[并发草稿审阅](2026-11-23-mission-draft-conflict-review.md)及 [现行面板架构](../../current/architecture/07-panel.md)。核对 `MissionBoard`、`MissionDraftEditDialog` 和真实草稿项目读取路径。验收覆盖确切项目、独立同名草稿、进程重启、两个真实编辑窗口和正式回读。

## 实际验收

- `41680/ui/` 使用正式 `main-DPV2Gw9j.js`。在 `change-review` 和 `receiving-yard` 用界面分别保存标题相同的 `Receiving handoff draft`。两次保存确认分别打开当前草稿的正确原请求。经 `receiving-yard` 卡片补上一行，两个项目的正式应用程序接口（Application Programming Interface，API）各自返回一份草稿及其原始会话身份，主项目内容保持原文。[两份草稿及确认的实页](../../artifacts/2026-11-24-mission-draft-lifecycle-review/README.md)
- 隔离服务正常关停，再用原数据目录启动新进程，进程标识从 19964 变为 37680。页面从项目筛选逐份进入后，主项目显示原请求，第二项目显示保存后的补充行。两个项目的草稿和会话标识与重启前一致，从会话返回看板仍保留该次项目筛选。
- 两个独立浏览器标签实际进入同一 `receiving-yard` 草稿。第二窗口先保存；第一窗口的旧基准保存被明确拒绝，未提交的本地输入仍在编辑器中。“Review saved request”读回另一窗口已保存的准确版本，两个版本同时可读。此时正式接口只显示第二窗口的已接受文本。确认后原输入重新聚焦，人工合并再保存，两条文本实际进入同一草稿；从确认打开时显示合并后的原请求，`change-review` 内容和身份仍一致。[并发对照与最终原文](../../artifacts/2026-11-24-mission-draft-lifecycle-review/README.md)
- 两套项目原有跟踪文件保持原样。整个流程结束时，每个隔离工作树新增未跟踪的 `.gitignore`、`.gitattributes` 和 `.opencorvus/opencorvus.jsonc`。Git 规则由项目初始化代码写入，本轮未单独划分各文件的写入触发时点。SQLite（嵌入式数据库）完整性通过，两个会话均为待办草稿且没有消息、子任务、模型请求或计划活动。页面和进程均正常关闭。验收限草稿的创建、编辑、重启持久化和并发处理，实际开始执行需另行验证。

## 结论

主流程和并发保护均符合当前行为。旧编辑器的基准被拒绝属于已定义的冲突响应，用户先看到最新版本，之后明确保存才写入。已确认的主项目和第二项目身份始终准确。本轮只记录独立运行证据，保留现行产品实现。
