# 已发送文本附件原文回看

2026-10-29单agent真实开发serve /ui，1280×720桌面端，实际chooser、真实OpenAI流式请求及四个正常退休实例。23张未编辑截图均渲染并人工查看。没有UI自动化、组件/DOM/源码文案断言或像素基线；原18571与用户窗口/进程未操作。[实施前分析及结果](../../records/2026-10/2026-10-29-text-attachment-history.md)。

原38349/main-rfYV7F9C.js真实发送README176字节和Python953字节，创建Session `ses_-zUQaHDCDzzrQyVxXODH`，可见read分别读取3/23行并正确回复。历史原名只有Download；新增默认折叠的只读原文回看，保留规范FilePart/文件名/顺序与原件下载。候选38350/main-B5e1OVzX.js的固定高度造成短文留白，按截图修正为自然短文/受限长文滚动。最终38351及有认证38352均加载普通main-Byhuis9j.js；实际短文141px、长文360px/完整629px，可到24行末尾。认证页模型就绪，继续保留原始模型回复与Sources。

图05位于消息末尾，完整折叠态另见06；图18是连续折叠/展开中的中间位置，不冒充完成态。明确Scroll to bottom取得following=true后单独展开，图20显示false、summaryY304、首行可见，沿现focusin阅读归属，不添加重复滚动补丁。图23为最终正常中文页面。来源入口打开真实附件只读原件（原read物理locator），FilePart原件下载使用各数据库的规范资源namespace。既有PDF页1/2与JPEG全图也实际打开。

6个实际gpt-6.1-sol请求均stream=true、HTTP200、reader settled/eof，达到原6预算后退休，累计788。最终认证回看预算0、实际请求0；只验证当前配对凭据/完整目录本地投影，未执行或假称新流式preflight。四次公开shutdown200、原exec13479/79358/82285/32956及native/launcher0，物理/输出/请求和精确出生身份退休，auth/models副本已退休，源认证元数据及完整目录字节/元数据保持。

92表，初112966旧行中112962精确，4项正常更新为A项目记忆1→2及更新时间、两个已过期容量槽位的真实模型占用/释放；三次回看114653旧行各自精确。最后新增一对真实runtime_process activation/grant，物理owner精确退休，最终114655行。源库全部精确、schema9/integrity ok。四种实际下载（候选README、最终README/Python/gzip）均与输入精确；11QA输入字节/元数据保持，5份持久FilePart原件全部可读。

既有生命周期在05:50:18.342Z对B项目sweep，deleted1/bytesFreed1520/kept7，对应786复制来的旧未发送test_invoice.py与其metadata；余17项原件/派生文件精确。没有把已离开草稿的旧副本当永久引用，也未改GC或伪造消息留住它。原A命名空间6项和后续副本均精确保留。当前工具事实来自tool_part_request/outcome，原文件Source保留attachment origin与真实Tool绑定。采集器已纠正未绑定Session参数、旧tool-part存储假设及误把Source物理path当canonical URL的问题，完整重跑通过，未修改生产契约迎合采集器。

| 原图 | 实际内容 |
| --- | --- |
| [01](01-real-files-before-send.png) | 真实chooser、两文件与自然用户请求 |
| [02](02-pending-readme-review.png) | 发送前原文核对 |
| [03](03-sent-files-history.png) | 正在真实读取，历史仅Download |
| [04](04-completed-history-downloads.png) | 正确完成回复与两个read |
| [05](05-history-folded.png) | 候选消息末尾的视口 |
| [06](06-history-folded-top.png) | 完整默认折叠态 |
| [07](07-history-readme.png) | 候选短文阅读 |
| [08](08-history-original-download.png) | 候选原件下载及过大留白 |
| [09](09-final-short-readme.png) | 最终短文自然收缩 |
| [10](10-final-python-end.png) | 长文内部滚动至末尾 |
| [11](11-final-attachment-source.png) | Sources打开对应只读原件 |
| [12](12-final-existing-pdf.png) | 既有PDF实际第一页 |
| [13](13-final-existing-image.png) | 既有JPEG全图 |
| [14](14-final-project-return.png) | 项目往返后重开原文 |
| [15](15-final-readme-zh.png) | 无认证中文阅读 |
| [16](16-final-python-zh.png) | 无认证中文代码阅读 |
| [17](17-auth-ready-readme.png) | 模型就绪的短文与下载 |
| [18](18-auth-ready-python.png) | 连续切换后的中间视口 |
| [19](19-auth-ready-python-end.png) | 模型就绪、完整文件末尾 |
| [20](20-reading-follow-investigation.png) | 明确展开退出跟随，首行可见 |
| [21](21-auth-ready-zh.png) | 模型就绪的中文入口 |
| [22](22-binary-original-review.png) | 非文本gzip的真实原件下载 |
| [23](23-auth-ready-final-zh.png) | 最终正常中文页面 |

机器记录：[data.json](data.json)、[runtime.json](runtime.json)、[checks.json](checks.json)。本轮不包括独立JSON历史消息、其他Office格式、原生目录picker、短视口或在途连接切换资格；没有增加模型非流式调用或数据库升级。仅当前UI能力、公开合同和根未发布日志，非版本发布。
