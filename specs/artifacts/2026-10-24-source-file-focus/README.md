# 来源读取期间的键盘焦点

568由单agent在真实 `/ui` 页面手动交互、逐图呈现并人工复核。修改前先证明来源文件正在读取、主输入有新焦点；读取结束后焦点被编辑器抢走。修复后相同8秒实际文件GET等待中输入草稿，读取结束后主输入继续拥有焦点，第2行引用高亮仍正常；之后新的明确来源点击仍能正常交接给编辑器。

| 图片 | 实际观察 |
| --- | --- |
| [01](01-first-attempt-after-read.png) | 第一尝试操作间隔过长，文件已经加载；不作为加载中输入或故障证明。 |
| [02](02-before-input-while-loading.png) | 修改前，加载中且主输入已输入未发送草稿。 |
| [03](03-before-focus-stolen.png) | 修改前，读取结束后编辑器取得焦点，主输入草稿仍在。 |
| [04](04-after-input-while-loading.png) | 修改后，同一真实8秒读取期间输入草稿。 |
| [05](05-after-focus-retained.png) | 修改后，文件完成加载和行带定位，主输入保留焦点。 |
| [06](06-after-explicit-second-reference.png) | 明确点击同一原文件3:15引用，编辑器正常取得焦点，第3行高亮。 |
| [07](07-after-repeat-first-reference.png) | 再次明确点击2:11，编辑器第2行光标、行带正常。 |
| [08](08-after-cold-file-focus.png) | 原末尾不间断空格文件首次慢读取，未转移焦点时正常进入编辑器。 |
| [09](09-after-leading-space-file.png) | 原前导不间断空格文件，内容是IDENTITY_LEADING_NBSP_423。 |
| [10](10-after-plain-file.png) | 普通同名文件，独立内容IDENTITY_PLAIN_423，身份未混淆。 |

[安全证据](evidence.json)保留原文件GET等待时序、前后实际焦点、只读DOM行带/光标几何、完整源数据保留和原请求/进程闭合。`latency-end`只表示注入等待结束，不能当HTTP响应或reader完成。只读DOM不支持`document.getSelection()`，未读取内部CodeMirror状态或伪称取得原生selection；行列交互同时有真实截图、可见光标与原range代码证据。未新增或运行UI自动化测试。

两scope各2次gpt-6.1-sol真实流式预检，全部原reader EOF。完整模型目录和凭据成对使用、退休；90表源原字段/时间/库字节mtime/schema5/canonical完整保留，两scope目标各只有两条原容量租约字段自然变化，Provider活动各增加1。五个原物理来源文件的完整字节和mtime逐个保持。两原exec、native、launcher均正常退出0，物理完成、输出排空、请求清理均完成，公开shutdown200，分别预留901628ms和1013451ms。自有页面关闭、草稿清空；用户18571实例未操作。

详见[调查与交付记录](../../records/2026-10/2026-10-24-source-file-focus.md)。
