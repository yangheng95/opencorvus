# 当前文件阅读往返实页

对应[方案](../../records/2026-11/2026-11-06-current-file-reading.md)。原生开发/ui的后台独立页面，截图人工复核。

| 原图 | 人工复核 |
| --- | --- |
| [01-before-current-file.png](01-before-current-file.png) | 原Office908摘要正常读取当前排版正文和真实表格，原审阅往返有效。 |
| [02-before-guide.png](02-before-guide.png) | 原870指南完整预览；代码里的/goal、/side被误画为文件链接。 |
| [03-before-command-file-error.png](03-before-command-file-error.png) | 实际点击/goal后，当前文件被替换成/goal并显示找不到文件，证明误导跳转。 |
| [04-after-command-code.png](04-after-command-code.png) | 后态英文界面：/goal、/side普通代码；真实点击后仍是当前指南。 |
| [05-after-chinese-command.png](05-after-chinese-command.png) | 后态中文界面：命令原文保持，控件中文，点击/side继续阅读指南。 |
| [06-after-relative-link-observation.png](06-after-relative-link-observation.png) | 首次相对链接指针动作没有完成跳转；此图不算打开通过。 |
| [07-after-relative-source.png](07-after-relative-source.png) | 原../sources/UI-control.tsx经真实Enter打开sources/UI-control.tsx，准确源内容可读。 |
| [08-after-review-retained.png](08-after-review-retained.png) | 切回原审阅，原第二次+62/-0和比较展开状态保留。 |
| [09-after-cited-line.png](09-after-cited-line.png) | 原正文文件引用:51准确打开源码并高亮第51行，不用文案替代定位。 |
| [10-after-link-hit-region.png](10-after-link-hit-region.png) | 换行链接焦点和可见文字；只读几何显示联合框中心位于TD空隙。 |
| [11-after-pointer-source.png](11-after-pointer-source.png) | 按当前截图直接点击文字位置950/442，实际打开同一原sources/UI-control.tsx。 |
| [12-after-close-review.png](12-after-close-review.png) | 真实关闭文件后，回到原审阅并聚焦原标签，原比较+62/-0继续展开。 |

12图本人查看。只有当前共享Markdown自动代码引用规则改变；单段斜杠歧义按结构保留原文，已声明来源/文件链接及范围仍用现有读取链。首次通用指针点击未冒充成功，后续实际文字坐标和键盘都读取准确源。三会话8完整工具/HTTP历史/服务端事件流连接快照保持，四份当前文件HTTP读取与受保护原字节精确一致。两个原生阶段公开关闭200、原生/启动器exit0、4份认证/完整模型目录副本成对退役，71/72本人页面关闭，可选final未分配。310436→310438→310440仅正常控制租约及授予每阶段各1；130项目文件/版本控制、301附件、原行及源库保持，零文件系统豁免、结构10/92表、累计1474/0新请求。[资格记录](qualification.json)保留范围和限制。
