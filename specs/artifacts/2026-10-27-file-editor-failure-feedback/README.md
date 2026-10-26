# 文件保存失败与草稿恢复反馈

修复保存失败时直接铺原技术错误，以及错误生成后切换语言仍显示旧语言。唯一错误状态保留当前语言键和原cause（原因），原完整HTTP（Hypertext Transfer Protocol，超文本传输协议）、具名错误和请求标识仍在Details（详细信息）。普通保存与未保存确认共用同一个事实，草稿/修订/外部版本保护保持。[完整根因与实施](../../records/2026-10/2026-10-27-file-editor-failure-feedback.md)，[运行与检查事实](evidence.json)。

以下15张1280×720原图均在隔离开发CLI（Command Line Interface，命令行界面）`/ui`由当前单agent（代理）实际交互、截图和人工查看。644为改动前main-BGrTrwC8.js，645为普通Node.js构建的正式main-CQhqpHfW.js；没有UI（User Interface，用户界面）自动化测试或页面模拟。

| 原图 | 实际观察 |
| --- | --- |
| [01](01-missing-save-before.jpg) | 原件被实际移动后，Save的404长技术正文挤占编辑区。 |
| [02](02-original-details-before.jpg) | 原诊断完整，正文与Details重复技术内容。 |
| [03](03-language-error-before.jpg) | 中文界面仍显示原英语技术错误。 |
| [04](04-conflict-chinese-before.jpg) | 真正外部保存触发原409，中文摘要原本正确。 |
| [05](05-conflict-stale-language-before.jpg) | 设置切英语后，同一409摘要仍缓存中文。 |
| [06](06-missing-save-english-after.jpg) | 真正404显示原件不可用、草稿保留和恢复提示。 |
| [07](07-original-details-after.jpg) | 同一错误的HTTP、请求标识和原完整原因仍在Details。 |
| [08](08-missing-save-chinese-after.jpg) | 同一404随着实际语言设置显示中文。 |
| [09](09-restored-save-after.jpg) | 原件移回后实际Save成功，三行草稿完整保存。 |
| [10](10-generic-save-error-after.jpg) | 外部非文本替换导致真实400，操作提示简洁，草稿保留。 |
| [11](11-generic-retry-saved-after.jpg) | 原输入恢复后实际保存成功，通用失败草稿完整落盘。 |
| [12](12-conflict-chinese-after.jpg) | 实际外部第二次保存仍触发原409保护。 |
| [13](13-conflict-english-after.jpg) | 同一409从中文即时切英语，草稿保留。 |
| [14](14-save-dialog-conflict-after.jpg) | 原未保存框内Save实际再次冲突，英语提示和原草稿保持。 |
| [15](15-reload-external-version-after.jpg) | Cancel后明确Discard and reload，页面读取实际受保护的外部版本。 |

原件移动、恢复、外部版本更新使用真实公共API（Application Programming Interface，应用程序接口）。非文本替换只操作本批明确自有generic-edit输入，实际保存失败后核对原八个二进制字节完整，恢复输入后73字节草稿正文落盘。原summary的201字节保持。没有声称下载动作、关闭异常、断网或所有主题/尺寸均已验证。

类型、正式前端构建、两套语言2551键及原renderer公开面检查通过；这些检查不替代上述实页。两服务38149/38150公共shutdown（关闭）200，原exec/原生宿主/启动器退出0，物理/输出/请求结清，自建tab27/28关闭。完整物理预算均20分钟，结清余量分别690731ms与596077ms；后者比十分钟关闭目标晚约4秒，没有延长预算或重启运行。

原源库92表分别30029/30131行、816条原关键历史、13组原件与用户数据库均保持；无认证、模型新增0，累计218保持。模型不可用提示来自隔离无认证上下文，未改变用户18571或用户窗口。数据库版本仍8，没有迁移、版本或发布变更。
