# 文件阅读操作与关闭反馈

2026-10-26，单agent在独立开发服务`/ui`实际手工操作并查看9张1280×720原图。[方案与根因](../../records/2026-10/2026-10-26-file-explorer-reading-experience.md)，[运行与检查事实](evidence.json)。639为修改前，640为当前生产构建；两个自有服务与标签均结清，模型调用0，未保存磁盘或操作用户18571。

| 原图 | 真实页面与观察 |
| --- | --- |
| [01](01-cancelled-switch-before.jpg) | 取消文件切换后Explorer保留其操作选择；原文件草稿仍在另一File工具页。这两个选择不是同一事实，未据此修改行为。 |
| [02](02-editor-find-before.jpg) | 修改前真实Ctrl+F，面板右上关闭×很小；查找与替换正常。 |
| [03](03-close-file-guard-before.jpg) | 修改前文件关闭动作的原未保存确认。实际辅助名称误称Close workspace。 |
| [04](04-find-close-focused-en.jpg) | 修改后英语查找、Next定位及Tab到关闭按钮，点击面积和焦点框清晰。 |
| [05](05-find-close-focused-zh.jpg) | 实际切中文后，同一查找查询和文件内容保持，关闭按钮焦点框正常。 |
| [06](06-close-file-guard-zh.jpg) | 精确文件关闭动作保留原中文未保存确认。 |
| [07](07-cancel-keeps-draft-zh.jpg) | Cancel保留同一草稿，焦点回原文件关闭动作。 |
| [08](08-file-closed-project-retained-zh.jpg) | 仅放弃本轮未保存输入后关闭File；项目、会话、Dock及Files工具保持。 |
| [09](09-second-file-reading-zh.jpg) | 打开第二个原文件README.md，真实名称和正文正确。 |

04/05的关闭按钮由原CodeMirror负责动作、查询与键盘；本批只在现有共享主题里补充遗漏的样式。文件关闭辅助名称和title现在随真实文件名、界面语言解析；实际工具输出已核对中英两文件名称，原图不冒充原生title悬浮提示。所有图均原样保留，没有像素断言、截图基线或UI自动化测试。

639/640为无认证隔离环境，模型不可用反馈不代表用户热认证失败；没有执行模型端到端验收。只实际覆盖深色桌面File页面；其它Artifact共享同一主题，但未逐一实页验证，二进制预览和磁盘写入也未扩称覆盖。
