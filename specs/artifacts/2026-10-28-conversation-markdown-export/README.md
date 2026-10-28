# 对话 Markdown 交接证据

对应[方案](../../records/2026-10/2026-10-28-conversation-markdown-export.md)。同一个完整公开会话快照新增 Markdown 阅读格式，保留 JSON 原格式。真实页面以开发 CLI 的 `/ui/` 提供，基线38273、改后38274；模型调用0，累计759。

| 原始截图 | 人工复核结果 |
| --- | --- |
| [01 JSON 基线](01-json-only-menu.jpg) | 原菜单只有 JSON |
| [02 英文 Chat](02-markdown-json-english-menu.jpg) | Markdown、JSON 两个明确格式，共用原会话菜单 |
| [03 中文 Work](03-work-chinese-menu.jpg) | 中文格式名称、菜单及真实 Work 身份 |
| [04 下载后 Work](04-work-content-after-download.jpg) | 原对话正文保持；反馈已消退，不把本图标为下载提示截图 |
| [05 英文文件阅读](05-chat-markdown-reading-preview.jpg) | 实际已下载 Chat 文件的标准 Marked 阅读预览 |
| [06 中文文件阅读](06-work-markdown-reading-preview.jpg) | 实际已下载 Work 文件的中文标签、日期及真实作者 |

两份实际下载的逐字节副本：[英文 Chat](chat.en.md)、[中文 Work](work.zh.md)。后两张是标准 Markdown 阅读预览，不是应用内文件查看器验收；所有截图均为浏览器原始截图，已人工查看。

[下载核对](download-validation.json)：Chat Markdown 58445字节、JSON 57622字节，原8条消息/23片段完整；包含2个来源、4个工具、1条停止错误和真实后续成功正文，5个非空正文片段位于可读区域。Work Markdown 41247字节，原8条消息/20片段、2个工具和7个非空正文片段完整，goal-controller/work 作者保持。独立词法解析恢复全部原 Session 元数据及每条原消息，与原公开响应逐项相等；JSON 原快照相等。121条长历史、空对话和明确错误合同由8项非 UI 格式测试、16断言证明，未冒充实页空 Work 验收。

[运行与数据](runtime-and-data.json)：基线101272条旧行，101271条原样，只有本轮副本同一 Session 的授权重命名 title/time_updated 改变；改后101304条旧行全部原样，最终101306行。两库 schema9、integrity ok，三个 Project 输入逐字节保持。两个原命令、native、launcher 均0，公开关闭200，物理完成/输出排空/请求清理与精确出生身份结清；75/100个原命令句柄全部完成。原物理期限的关闭余量分别2126365/863052ms。两个模型目录副本已退休，未复制auth，原catalog字节/元数据及auth元数据保持。

[检查](checks.json)包含普通 Node 构建、类型、2602键双语、351操作/26组文档及正向格式检查。[阅读预览命令](document-preview-checks.json)均正常0退出、自身70秒关闭；首个预览关闭后访问中文页曾被拒绝，确认原命令已终结后用独立中文只读预览完成视觉复核。未因此重启应用实例或模型调用。真实应用页155/156/157及成功预览页158/160已关闭；浏览器策略阻止重新绑定已变成 data: 错误页的159，未绕过策略，该临时错误页留待正常回合清理；它不持有服务或数据库进程。
