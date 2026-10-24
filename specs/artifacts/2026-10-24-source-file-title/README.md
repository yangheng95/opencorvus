# 文件名优先标题的真实页面复核

569由同一单agent在真实开发 `/ui` 手动交互、呈现截图并人工查看。修改前证据使用[568原图07](../2026-10-24-source-file-focus/07-after-repeat-first-reference.png)：同一长文件已正确加载，但编辑区标题只显示父目录`nested-reading-material-for…`。本批不重复生成相同before。

| 实图 | 实际观察 |
| --- | --- |
| [01](01-loading-file-name.png) | 真实8秒文件读取中，标题已优先显示reference-long-source…，未发送草稿在主输入；Source tooltip仍可见。 |
| [02](02-loaded-file-name-and-focus.png) | 文件完成读取，第2行高亮，标题显示文件名；主输入继续拥有焦点。 |
| [03](03-second-reference-file-name.png) | 新的3:15明确点击正常交接到编辑器，第3行高亮。 |
| [04](04-readme-file-name.png) | 普通README标题、原内容、第2行定位正常。 |
| [05](05-trailing-space-file-name.png) | identity-422.md末尾真实不间断空格保持，原内容正确。 |
| [06](06-leading-space-file-name.png) | 前导不间断空格文件显示LEADING_NBSP原内容，标题/编辑器名称保留前导字元。 |
| [07](07-plain-file-name.png) | 普通同名文件独立显示PLAIN原内容，标题/编辑器名称正确。 |

完整路径仍保留在原heading title属性，标题与文本编辑器共用同一展示值；[安全证据](evidence.json)记录只读DOM实际名称和完整路径供身份诊断，视觉资格来自上面实图。极长文件名仍受窄Dock自然省略，不声称完整显示。原始46条来源清单没有附件条目，本批未新增附件实页资格；其显式displayName原样优先合同经代码审查保留。

一次旧数字索引点击打开了README工具详情而非来源，尚未真正激活Source，后按当前真实名称操作；另一次尾空白来源尚在视口外，未产生文件GET。保留私有失败操作图和实际请求时序，按真实滚轮将按钮完整显示再点击成功，不把未激活的操作算产品失败或通过。容器AX滚动被覆盖提示后改用该对话可见滚轮区域；未采用脚本滚动或注入UI。没有新增/运行UI自动化测试。

数据保留、Provider原reader EOF、完整进程与配对凭据退休以evidence和[调查记录](../../records/2026-10/2026-10-24-source-file-title.md)为准。
