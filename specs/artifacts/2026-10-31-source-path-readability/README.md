# 文件来源路径阅读验收

对应[方案](../../records/2026-10/2026-10-31-source-path-readability.md)。单agent使用两个顺序运行的原生开发服务 `/ui`，桌面1280×720、英文界面，右侧文件面板380像素。以下截图均实际呈现并人工复核；没有UI自动化测试、截图差异断言或合成来源。

| 证据 | 实际观察 |
| --- | --- |
| [01 宽区基线](01-before-wide.png)、[02 窄区基线](02-before-narrow.png) | 长目录占两行，窄区丢失最近的“资料/” |
| [03 宽区修复](03-after-wide.png)、[04 窄区修复](04-after-narrow-file.png) | 目录单行，最后一级目录优先可见，文件名独立 |
| [06 键盘完整路径](06-after-keyboard-tooltip.png) | Tooltip保留完整原始观察位置，文件正文实际可读 |
| [07 README打开](07-after-readme-open.png)、[08 复制反馈](08-after-copy-location.png) | 两文件各自打开；复制得到完整原始路径，浏览器原空剪贴板按本轮值归属检查恢复为空文本 |
| [11 范围来源](11-after-range-group.png)、[12 保存摘录](12-after-saved-excerpt.png)、[13 行列定位](13-after-range-file-open.png) | 八条自然产生的引用保持身份，17:34摘录与原文件第17行对应 |
| [14 来源搜索](14-after-source-search.png)、[15 搜索落点](15-after-search-landed.png) | 搜索原始引用并定位原Source，不使用截断caption构建位置 |
| [16 网页来源](16-after-web-source.png)、[17 网页摘录](17-after-web-excerpt.png) | 两条已保存网页来源仍按原有方式展示、展开 |
| [18 附件](18-after-attachments.png)、[19 附件原件](19-after-attachment-open.png) | Attachment标注保留，原README附件可打开 |
| [20 最终目标区域](20-after-final-file.png) | 同一搬迁会话、真实中文文件及完整路径提示最终复核 |

[交互记录](interaction-review.json)、[运行及检查](verification.json)、[基线数据](before-qualified.json)、[候选数据](after-qualified.json)区分实际交互、完整HTTP回读与持久数据保护。两scope请求均0，累计1118；schema9、92表所有原行全部列保持，仅各新增本次activation lease/grant。十三项目Git/28 tracked、75附件、十三+三十九原文件保持。两原exec/native/launcher均0、public shutdown200、原物理/输出/请求/进程出生身份结清；配对auth/models副本已退休，原认证元数据及模型目录字节/元数据保持。

未制造自定义标题或特殊空白路径数据；这些未改变的分支只做代码影响面复核，不宣称真实页面覆盖。只验桌面。本轮起始浏览器页早于服务就绪，之后确认原服务就绪再开新页，无重启/延长deadline；输出标签冲突的私有回读脚本已修复命名与输入检查，并以新标签重跑。上述工具问题均不作为产品通过证据。
