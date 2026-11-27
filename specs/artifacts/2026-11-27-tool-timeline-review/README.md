# 工具调用分钟级时间线证据

对应[Recall、已证根因与最终复核](../../records/2026-11/2026-11-27-tool-timeline-review.md)。

- `verification.json`：4个自有运行/14次精确Sol流式请求、原句柄join/排空/副本退役、检查与明确限制。
- `tool-events-source.json`：真实前批7个工具调用的必要身份/起止/退出码投影，524057毫秒首尾跨度含间隔，不推断模型耗时或销售日期。
- `expected-artifact-input.json`、`api-artifact.json`、`timeline-facts.json`、`task-status.json`：实际read→自然publish的8事件/3分组与原时间/标签/身份，完整来源保真。初次未经调用的background拒绝保留为真实历史，不当作接口缺陷。
- `outgoing-timeline-schema.json`、`outgoing-tool-facts.json`、`prepared-schema-facts.json`：真实出站工具声明和生产参数都包含point/range/background。仅公开工具说明与timeline分支投影，非完整模型请求/prompt。
- 13张截图均人工查看：`before-timeline-fit/expanded`为数小时范围内的细线失败；`after-timeline-initial`仅中间Fit候选，`candidate-timeline-detail-precision`显示同分钟起止丢失秒；8张`accepted-*`为最终真实范围、失败/成功秒数、缩放/展开保留、中英主题、点及发布区间详情。
- `native-downloads.zip`及4份独立CSV：真实修改前下载/最终浅色下载/深色下载/原生Copy，各980字节，均等于生产导出；ZIP逐成员与原件比较，独立CSV解析8事件五列精确原值。源毫秒UTC时间保持，详情展示秒。
- `copy-feedback.json`：首次定位器点击无Copied反馈，读到14674字节旧Notebook，checker失败；原生AX点击后Copied及980字节CSV原检查通过。原生成功与早先未通过取证分开，不写成产品复制根因。
- `facts-run80/81/83.json`：23文件/2258旧行/样本Git/SQLite保全；最终服务原64404join退出0，所有页面已关闭。run81对活跃memory流正常排空23.5秒，不误报终态异常。

没有UI自动化或哈希门槛；不保存完整会话、推理、数据库、凭据/模型目录；无发布/tag/PR或分派。
