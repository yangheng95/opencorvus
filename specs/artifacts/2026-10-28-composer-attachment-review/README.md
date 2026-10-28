# 输入区附件核对与键盘删除

[Recall、根因与方案](../../records/2026-10/2026-10-28-composer-attachment-review.md)。本批765为持续产品迭代的一部分，整体Goal仍active。

新增提交前非图像附件核对：存储的text/*和JSON复用现有只读资源文本视图，其他类型复用FilePart的媒体或原件下载；图片保留原全图。移除按钮的本地化名称含原文件名。真实键盘体验发现并修复移除后失焦：首项到下一项、末项到前一项、空列表到原输入，保留原草稿。

20张原始JPEG均人工查看，未编辑或重采样。没有新增、修改或运行UI（User Interface，用户界面）自动化测试；类型、构建和双语不是视觉替代。机器检查见[checks.json](checks.json)，三个自有服务的结算/目录/完整旧行见[runtime-and-data.json](runtime-and-data.json)，原件逐字节检查见[original-files.json](original-files.json)。

| 原图 | 实际结果 |
| --- | --- |
| [01](01-current-attachment-menu.jpg) | 原+菜单，真实添加入口。 |
| [02](02-current-two-attachments.jpg) | README和图片上传完成、原草稿和2项计数。 |
| [03](03-current-document-click.jpg) | 原README点击没有核对视图，属新增能力线索。 |
| [04](04-current-image-preview.jpg) | 原全图正常，不把现有图片能力说成本批新增。 |
| [05](05-current-code-mode-retains-input.jpg) | 同项目Work→Code保留原草稿及两附件。 |
| [06](06-after-four-attachments.jpg) | main-DbyB9YUC真实四原件；AX尚索引，像素已呈现4项。 |
| [07](07-after-document-review.jpg) | README真实只读CodeEditor，原文完整。 |
| [08](08-after-review-returns-focus.jpg) | Esc回原Review，草稿和四附件保留。 |
| [09](09-after-unicode-json-review.jpg) | 164588字节中文JSON原文核对。 |
| [10](10-after-json-end-navigation.jpg) | Ctrl+End实际到2653行末尾，长文未被预览截断。 |
| [11](11-after-original-file-review.jpg) | 未知MIME的bun.lock原件下载；实际下载555554字节与源文件精确一致。它的内容可为文本，未假称二进制字节。 |
| [12](12-after-chinese-attachment-actions.jpg) | 真正设置切中文再返回，所有操作名含原filename，四附件和原草稿保持；自然Settings tooltip未覆盖目标区。 |
| [13](13-after-chinese-document-review.jpg) | 中文关闭及原文核对；用户原文不翻译。 |
| [14](14-after-keyboard-remove-one.jpg) | 原Remove语义正确但焦点落AXWebArea，保留失败证据。 |
| [15](15-after-image-preview-retained.jpg) | 新核对功能下原图片中文全图仍可用。 |
| [16](16-after-new-chat-clears-staging.jpg) | 明确新对话后全局空草稿/暂存附件清理。未确认执行或创建会话。 |
| [17](17-final-document-review.jpg) | main-CA287XoV最终真实README只读核对。 |
| [18](18-final-head-removal-focus.jpg) | 键盘删首README，焦点落下一图片Remove，余2，全文草稿保持。 |
| [19](19-final-tail-removal-focus.jpg) | 键盘删末JSON，焦点回前一图片Remove，余1，草稿保持。 |
| [20](20-final-empty-strip-input-focus.jpg) | 键盘删最后图片，焦点回原输入框，完整草稿保持。 |

三实例从物理闭合前一完整库备份，原始exec38070/59954/99472均0、公开shutdown200、native/launcher0、三项与精确出生身份退休，分别余2177765/1301462/998025ms，共用同一11:33:15.770Z截止。临时1119×720视口与截图一致，每次结束已reset，自有170/171/172页全关闭，未操作用户18571。完整1280捕获仍未验。

无auth副本、Provider请求0，累计759；完整模型目录自有副本全部退役，源目录原字节/元数据和auth元数据保持。全部92表原行和源库保持，最终101330行/schema9/integrity ok。3原项目文件及3个自有namespace共9份上传原件均与实际原文件精确相等。

旧库没有可用于实页回归的file-preview@1 Part，因此共享旧artifact消费者只有类型/构建范围证据；未造假artifact或消息。PDF/音视频/Office、动态错误、在途authority/快速焦点切走和新模型执行未验，不以本批有限结果扩大声明。
