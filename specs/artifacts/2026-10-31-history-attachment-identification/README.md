# 历史附件辨识与原件下载证据

真实开发模式 `/ui`、隔离原生服务与内置浏览器手工交互。17 张截图均实际呈现、人工查看，未新增或运行 UI（User Interface，用户界面）自动化。

基线 `main-CB_Qh88y.js` /38459；初次候选 `main-Y10k_dM8.js` /38460；图片下载身份修正后的最终候选 `main-DurJDA2Q.js` /38461。沿用已有真实模型记录，零新增模型请求，累计1124。

| 截图 | 实际观察 |
| --- | --- |
| [01 基线入口](01-before-identical-history-controls-en.png) | 两个同名历史预览入口相同。 |
| [02 第一原件](02-before-first-history-original-en.png) | 第一份为BRAVO /29。 |
| [03 两份展开](03-before-both-history-originals-en.png) | 第二份为ALPHA /17，内容没有合并。 |
| [04 英文入口](04-after-distinct-history-controls-en.png) | 1 · notes.txt、2 · notes.txt可区分，Sources引用保持。 |
| [05 第一预览](05-after-first-history-original-en.png) | BRAVO /29及其命名下载入口。 |
| [06 第二预览](06-after-both-history-originals-en.png) | ALPHA /17，两份可同时展开。 |
| [07 独立收起](07-after-independent-disclosures-en.png) | 收起第一份后第二份保持。 |
| [08 中文切换](08-after-localized-history-and-download-zh.png) | 中文查看/下载名称、原文和展开状态保持。 |
| [09 中文重开](09-after-reopened-first-history-original-zh.png) | 第一份重开仍为BRAVO /29。 |
| [10 诊断](10-diagnostic-wrong-experience-link-zh.png) | 验收链接误用Chat；公开选择确认原会话属于Work，随后按真实身份进入。此图不作为媒体成功证据。 |
| [11 媒体历史](11-after-unique-media-history-zh.png) | 唯一图片与PDF入口保留原名。 |
| [12 文档首页](12-after-original-pdf-preview-zh.png) | 实际打开原两页文档。 |
| [13 文档翻页](13-after-original-pdf-next-page-zh.png) | 第二页、页码和正文正确。 |
| [14 原图](14-after-original-image-preview-zh.png) | 原图全屏预览和名称正确。 |
| [15 最终历史](15-final-history-original-en.png) | 最终构建重验第二原件及命名下载。 |
| [16 最终原图](16-final-original-image-and-download-en.png) | 最终构建重验原图并实际下载。 |
| [17 最终重开](17-final-reopened-history-and-sources-zh.png) | 中文重开后历史1/2与Sources引用1/2保持。 |

展示标签由同消息完整文件列表和稳定part id派生，图片strip与正文共用同一语境；真实filename、资源URL（Uniform Resource Locator，统一资源定位符）、编辑器文件名及download属性保持。PDF（Portable Document Format，便携式文档格式）阅读器与文本预览继续使用原始资源。

图片链路复核后，PreviewableImage仅用displayLabel说明按钮，原img.alt、全屏状态alt及委托属性保持原值，防止序号进入原图下载名。没有新图片状态或第二下载writer。唯一图片实际下载保持47688字节与原名；同名图片、音视频、跨消息重复名的新真实消息和原生桌面未扩大验收。

基线实际下载BRAVO，初次候选下载BRAVO/ALPHA，最终候选再次下载ALPHA；均为notes.txt的52原字节。浏览器自行增加保存后缀，展示序号没有进入原下载名。最终原图下载为12-after-chinese-home-hint.jpg、47688原字节。媒体原端点返回JPEG（Joint Photographic Experts Group，图像格式）47688、PDF111015及SVG（Scalable Vector Graphics，可缩放矢量图形）6426原字节；SVG仅核对端点，不声称本轮独立全屏验收。

三scope零模型请求，schema9/92表218552→218554→218556→218558，全部原业务行/739用量保持，每scope只新增正常activation lease/grant。81保护附件、十三旧Git项目28 tracked、两833各十原文件/Git事实和旧对话/Goal/Sources保持。基线与最终候选十组公开回归通过。

三scope均公开shutdown200、原执行句柄/native/launcher0、物理/输出/请求/出生身份结清后退休六份配对认证/模型目录副本，源元数据与目录字节保持。准备器初次沿用834较早deadline，未达成本轮独立60分钟窗口；保留并共用1793442351504更早截止值，未扩时，余1852638/1224500/861226ms。初次候选页在shutdown后收起，顺序偏离已记录；最终页先关闭再shutdown。用户服务、数据库和窗口未操作。

最终普通前端build/renderer、类型、双语2674键及公开回归通过，见 [verification.json](verification.json)。
