# 网页来源摘录阅读证据

对应[调查与结果](../../records/2026-10/2026-10-31-source-excerpt-reading.md)。真实原生开发页面、既有自然产生的来源；截图随实际交互保存并人工呈现查看。不新增或运行UI自动化，不生成虚构来源或跨消息合并来源。

| 图 | 真实操作与范围 |
| --- | --- |
| [01](01-original-web-sources.png) | 修改前两个原网页来源的标题、站点、链接和独立摘要披露正常。 |
| [02](02-original-expanded-excerpt.png) | 原摘要可以展开阅读，复制位置动作只取网址。 |
| [03](03-original-eight-file-sources.png) | 原八文件组展开，第一项位于当前视口上方。 |
| [04](04-visible-copy-excerpt-action.png) | 新的复制摘要动作位于展开区正文之前。 |
| [05](05-exact-original-excerpt-copied.png) | 第一份4087字符摘要复制确认，实际Clipboard回读逐字符与原Source相同。 |
| [06](06-excerpt-read-to-end.png) | 使用End阅读原摘要末段。 |
| [07](07-keyboard-copy-after-reopen.png) | Enter收起/重开、Tab/Enter复制，完整摘要及末段阅读位置保持。 |
| [08](08-independent-second-source-copy.png) | 第二份独立2376字符摘要复制，实际内容精确匹配该Source。 |
| [09](09-chinese-copy-excerpt.png) | 中文动作、可访问名称和复制确认；原标题/正文保留。 |
| [10](10-narrow-transcript-excerpt.png) | 右侧380px面板打开，较窄主区仍可阅读并复制完整摘要。 |
| [11](11-file-sources-retained.png) | 原文件来源组中文展示与原定位动作保持；第一项在视口上方。 |
| [12](12-original-file-location.png) | 原test_invoice.py:44:26打开第44行和原调用范围，未编辑/保存。 |

[copy-reading.json](copy-reading.json)为这次真实操作的人工复制回读记录，只含本轮已知内容的长度/对应结果，不保存用户剪贴板或网页全文，不是可执行UI测试。第一次基线复制前未保存原剪贴板，未知原状态不能声称恢复；候选先在内存捕获当前状态并在本轮内容仍拥有时恢复。详见记录中的实际失误与限制。

[qualified.json](qualified.json)记录schema9/92表208923→208927、全部原行原值、75附件、八旧项目28 tracked与十保护文件，以及完整原HTTP（Hypertext Transfer Protocol，超文本传输协议）和Goal保持。新增仅两个runtime lease/grant配对。两个实例公开shutdown200，原native/launcher/exec0、物理/输出/请求结清后退休配对副本；0新模型请求/累计1096，原认证元数据与模型目录字节/元数据保持。用户18571未操作。

实际查看十二张截图，类型、构建、双语2648键与文档检查只作辅助。未覆盖原生Tauri剪贴板、权限失败、source-document、成员/SideChat、流式追加、跨项目进行中复制和移动/缩放；不由共享代码推称这些路径已实测。
