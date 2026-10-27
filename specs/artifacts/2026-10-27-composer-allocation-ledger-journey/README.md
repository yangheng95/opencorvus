# 新对话项目分配、列表连接与草稿移交实页证据

主agent（代理）独立操作当前真实开发页面，所有图片是实际页面原图，已逐张人工查看。720零模型重现在线列表错误，721实际Sol发送确认草稿回流，722修复后真实上传/发送/新对话/独立草稿切换和重载通过。未操作用户18571/窗口/真实数据库。

| 原图 | 实际观察 |
| --- | --- |
| [01](01-allocation-sidebar-and-upload-contract.jpg) | 720在线列表失败；无认证上传另返回真实模型准入400，此图不证明成功上传。 |
| [02](02-online-ledger-error-details.jpg) | 实际展开侧栏Failed to fetch，文字草稿保留。 |
| [03](03-retry-restores-current-list.jpg) | 用户实际Retry恢复列表和新分配空项目。 |
| [04](04-global-draft-retained-after-allocation.jpg) | 全局保留720A未发送文字，只是后续调查线索。 |
| [05](05-authenticated-upload-and-draft.jpg) | 721认证可用，真实Chooser上传原名成功。 |
| [06](06-sent-message-and-real-reply.jpg) | 721自然用户消息和模型回复，当前输入已清空。 |
| [07](07-sent-text-reappears-in-new-chat.jpg) | 点击New chat后721A已发送原文回流，确证功能缺陷。 |
| [08](08-latest-input-during-allocation.jpg) | 722在Indexing阶段新增的文字，项目激活/上传后完整保持。 |
| [09](09-removing-file-retains-project-draft.jpg) | 实际移除附件，项目草稿完整保留。 |
| [10](10-final-input-and-real-reply.jpg) | 重新添加同一原件后真实发送，增补文字和附件进入消息，Sol正确回复。 |
| [11](11-new-chat-after-successful-send.jpg) | 成功发送后全局新对话为空输入。 |
| [12](12-session-history-with-independent-draft-preserved.jpg) | 会话正在加载的中间态；不能单独证明历史完成。 |
| [13](13-loaded-session-history-and-empty-session-input.jpg) | 原会话历史完整，当前会话输入为空。 |
| [14](14-independent-global-draft-restored.jpg) | 回到全局新对话恢复独立未发送722B草稿。 |
| [15](15-independent-draft-after-page-reload.jpg) | 真正重新加载页面后722B仍恢复。 |
| [16](16-chinese-light-independent-draft.jpg) | 中文浅色新对话/全局未发送草稿。 |
| [17](17-chinese-light-loaded-session-history.jpg) | 中文浅色已发送历史和空会话输入，原文件身份保持。 |

[runtime-review.json](runtime-review.json)来自关闭后的只读SQLite、原exec（执行句柄）/native（宿主）/launcher（启动器）结清和真实Provider audit（请求审计）。720/721/722分别0/4/4次请求，累计365→369→373；8个真实请求全部精确gpt-6.1-sol、stream=true、200、reader settled/EOF。没有创建代理、Task或Goal。721/722各未用4次额度作废，成对认证/完整目录副本退役；源认证/目录元数据保持，目录字节一致。722普通Node前端main-w0G0uquP.js，public shutdown200，原exec91610/native/launcher0，全物理/输出/请求结清，余702245ms。

92表全部源原行保持、全部目标原行保留；720全243818原行不变；721/722各仅2个正常到期容量槽位由各自原native PID重用/释放，其余243819/244983原行逐值不变。722的7259原关键事实/166原文件保持。真实721/722用户文字、文件消息及短回复均自然持久化，722增补段带原LF（换行）保留；原附件143字节及canonical（规范）metadata原名核对通过。输入复用[自制原件](../2026-10-27-attachment-source-journey/inputs/验收说明%20717（原件）.txt)。

草稿记录9项正向数据契约/9断言通过，只有普通记录输入/输出，没有DOM（文档对象模型）、组件、浏览器fixture（夹具）或UI文案自动化。前端类型、语言（2语言2585keys）、renderer（渲染器）公共面和普通Node构建通过。

在线Failed to fetch的底层原因仍未知：719/720已复现，服务端列表全部已完成请求200（720有13次）；721/722分别36/50次全部200、实页未复现，不据此宣称修复网络原因。现有本地草稿格式和数据不做批量清理，避免删掉真正未发送的输入；本批防止新分配链继续复制已发送文字。没有原生桌面资格声明。
