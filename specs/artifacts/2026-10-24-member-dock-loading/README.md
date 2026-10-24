# 成员侧栏加载与正文连续性复核

对应[调查记录](../../records/2026-10/2026-10-24-member-dock-loading.md)。571由单一开发agent完成，全部截图来自自有开发CLI `/ui` 的真实交互并逐张人工查看；没有新增或运行UI自动化测试。用户18571实例未操作。

## 范围与结果

复用完整原541数据中的Task `tsk_g00VYlyopB00h7w27eIw`、原A/B和原Project，仅原B在原Session续写一次有限责任：计划正文、一次W3C公开入口读取、真实返回说明和三行表格。Task及B自然完成，Source公开接口、SQLite原记录和生产timelineOrderKey一致；来源复制得到准确URL，原PNG附件公开读取200/643字节并保留原身份。真实GET只增加固定八秒延迟，未替换响应或渲染算法。

捕获窗口中原14个历史正文owner保持，新增Source及前后正文可见；侧栏隐藏重开后可继续阅读。本轮未复现旧Rendering闪烁，不能据此声称所有入口已修复。本批没有产品源码补丁。

ready关闭时最后一个后台Memory Organizer仍在运行；13次真实流式gpt-6.1-sol请求为12EOF及1个shutdown-aborted，严格全EOF检查失败已保留。原exec/native/launcher及物理、输出、请求终态完整后才清退凭据副本。条件after继续完整历史中的同一待处理记忆：正常Project打开使revision18/retry_wait自动推进revision19/idle，准确覆盖原interaction occurrence，3个实际reader均EOF。全批18次请求为17EOF、1个上述取消，不把后续成功改写成ready全EOF。三个自有scope全部关闭，三对凭据副本全部退休。

## 人工查看的画面

| 截图 | 实际观察 |
| --- | --- |
| [01](01-original-task-loading.png) | 原Task加载完成后的主对话；静态辅助树标签不等于可见进度条 |
| [02](02-member-cold-read.png) | 成员首次八秒真实读取，明确显示正在加载会话 |
| [03](03-member-loaded.png) | 原长正文、表格和代码围栏读取完成 |
| [04](04-original-member-continuation.png) | 原B单次续写权限提交，正文仍在背景 |
| [05](05-member-stream-start.png) | 新正文流式到达，历史末尾保留 |
| [06](06-source-arrival.png) | 新Source后文与三行表格完成 |
| [07](07-new-source-visible.png) | 新W3C来源标题、域名和前后正文可读 |
| [08](08-member-reopened-warm.png) | 隐藏后重开，真实读取仍慢但正文直接可读 |
| [09](09-member-reopened-settled.png) | 重开结算后原Task完成与来源正文 |
| [10](10-restarted-task-cold.png) | 条件after从同一完整数据冷启动，原Task完成状态与正文 |
| [11](11-restarted-member-cold.png) | 条件after冷开原B，英文加载反馈 |
| [12](12-restarted-member-loaded.png) | 原B最终正文与表格在重启后呈现 |
| [13](13-restarted-source-copy.png) | 英文界面下同一来源复制反馈与准确URL |

## 证据

- [evidence.json](evidence.json)：原Task、Source、真实业务checker、完整数据保留、首scope资源发布失败及关闭证据。每个scope的实际reader终态独立保留。
- [render-observations.json](render-observations.json)：93条低频原Part/正文/Source身份及块数记录；不包含正文、凭据或自动UI断言。cleanup只读最后正常快照。
- 原SQLite、完整90表行快照、完整Provider审计、source-reader和物理出生链保存于私有自有运行目录，不将凭据或全量历史入库。
