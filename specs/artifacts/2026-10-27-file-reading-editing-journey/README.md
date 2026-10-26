# 文件阅读与编辑体验证据

对应[根因和实施记录](../../records/2026-10/2026-10-27-file-reading-editing-journey.md)。从原真实订单交付的Mission（使命）进入Task（任务），读取同一1076字节报告及原文件，实际页面复核后修复全屏文件导航；另修独立只读Task交付目录端点的模型启动误依赖。没有新增或运行UI（User Interface，用户界面）自动化测试。

- [证据与实际接口回执](evidence.json)：三个运行结清、原失败、最终200/404、归属测试和原字节核对。
- [通过真实界面新建、编辑、保存和重命名的96字节文件](authored-note.md)：自有体验文件，未包装成模型发布物。
- 既有真实交付的[输入](../2026-10-27-task-delivery-journey/input-orders.csv)、[汇总](../2026-10-27-task-delivery-journey/summary.csv)、[报告](../2026-10-27-task-delivery-journey/report.md)保持原字节；新GET目录与原发布完全一致。

| 原图 | 实际观察 |
| --- | --- |
| [01](01-report-preview-en.jpg) | 668原报告确有Markdown预览与原输入/输出文件链接。 |
| [02](02-report-workspace-en.jpg) | 原报告作品全屏，正文和表格可见。 |
| [03](03-file-link-stays-fullscreen-en.jpg) | 原版本实际点击input文件后仍被报告全屏遮挡。 |
| [04](04-input-visible-after-manual-close-en.jpg) | 手动关闭全屏后才看到已经打开的订单文件。 |
| [05](05-final-report-workspace-en.jpg) | 669最终UI构建重新全屏原报告。 |
| [06](06-file-visible-directly-en.jpg) | 同一次文件点击直接退出全屏并显示原订单。 |
| [07](07-owned-unsaved-note-en.jpg) | 通过Explorer真实新建文件后的中文未保存草稿。 |
| [08](08-visible-draft-dialog-en.jpg) | 保留该草稿再从全屏导航，确认框清晰可见；实际取消后草稿保留。 |
| [09](09-note-saved-search-en.jpg) | 已保存并输入查找词；这张图尚未显示真正的匹配高亮。 |
| [10](10-note-visible-search-match-en.jpg) | 实际Enter查找后的12.30黄色高亮，内容原值保持。 |
| [11](11-renamed-note-en.jpg) | 搜索结果中重命名为中文文件名后重新加载内容。 |
| [12](12-reopened-note-zh.jpg) | 关闭再重新打开、下载后切中文；包含Settings悬停提示。 |
| [13](13-report-workspace-zh.jpg) | 同一原报告中文作品全屏。 |
| [14](14-summary-visible-directly-zh.jpg) | 中文全屏文件链接直接显示原3行汇总和中文编辑器。 |
| [15](15-inline-report-link-zh.jpg) | 普通嵌入会话文件链接打开报告编辑源，底部正文在折叠线外。 |
| [16](16-final-server-report-workspace-en.jpg) | 670包含最终后端修复的新进程上重新进入原报告全屏。 |
| [17](17-final-server-file-visible-en.jpg) | 670实际点击input后直接出现编辑器，原8条订单可见。 |

02/03/05/13/16为原生全屏2560×1440，其它为1280×720原图；未经裁剪、编辑或重排。实际触发的是codespan文件引用，显式Markdown链接共用相同处理但本轮未独立实页触发；原生IDE、MCP链接、图片弹层和并发快速双击未实际验收。

| 运行 | 端口 | 模型请求 | 原执行/宿主/启动器退出 | 结清余量 |
| --- | --- | --- | --- | --- |
| 668基线 | 38173 | 0 | 全部0，HTTP关闭200 | 961988ms |
| 669界面修复 | 38174 | 0 | 全部0，HTTP关闭200 | 467910ms |
| 670最终接口与页面 | 38175 | 0 | 全部0，HTTP关闭200 | 1031353ms |

均满足20分钟物理边界与至少五分钟余量，物理/输出/请求结清。669约12分12秒，超过十分钟关闭目标，原因是额外接口检查发现真实400并追查准入；原失败与目标未达事实保留。所有实例无认证，黄色模型提醒符合配置；模型请求累计292保持。670真实GET交付目录200并完整等于原发布，两个字节读取200且77/1076字节正确；跨项目404 NotFoundError，所属项目重读200。身份校验与原消息/Task/产物事实保持。未操作用户18571、用户窗口/进程或真实数据库，未发布新安装包。
