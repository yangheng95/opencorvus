# 文件编辑闭环与显式打开焦点

570由单agent在项目开发模式真实 `/ui` 操作，19张实图均呈现并人工复核。未新增或运行UI自动化。修复前先证明新建文件加载完仍是BODY焦点，原生x按键不能输入；修复后同一创建流程无需再点击，x立即进入新文档。普通无行号文件打开也走现有显式reveal和布局测量，加载期间新取得的主输入焦点仍优先。

| 图片 | 实际观察 |
| --- | --- |
| [01](01-created-loading.png) | 新文件真实创建、空文件读取中；不是加载完成资格。 |
| [02](02-created-keyboard-focus.png) | 修改前加载完成，焦点BODY，空编辑器没有取得输入；原生x后仍为空。 |
| [03](03-editing-during-save.png) | 真实PATCH保存中继续输入B，页面保留新文本与脏标记。 |
| [04](04-first-save-keeps-new-draft.png) | 第一提交实际写入A，界面B仍未保存；随后第二提交将完整B写入磁盘。 |
| [05](05-business-read-submitted.png) | 当前主会话发送真实单行read请求，实际模型gpt-6.1-sol。 |
| [06](06-business-read-result.png) | 真实read第2行、自然Source与QA570_SOURCE_END完成。 |
| [07](07-source-returns-to-file.png) | 点击这次真实Source回到原文件、第2行带与编辑焦点。 |
| [08](08-close-confirmation.png) | 自有未保存草稿关闭确认，初始Cancel焦点。 |
| [09](09-cancel-retains-draft.png) | Cancel保留草稿并返回原关闭控件。 |
| [10](10-reload-confirmation.png) | 重载使用原未保存确认；Cancel继续保留草稿并回原重载控件。 |
| [11](11-reload-keeps-new-input.png) | 实际GET重载期间继续输入，新草稿保留并给出当前语言反馈。 |
| [12](12-reloaded-saved-content.png) | 再次确认放弃本批自有草稿，实际读回已保存B。 |
| [13](13-real-write-conflict.png) | 真实外部写入后，旧revision保存被拒绝，页面保留冲突草稿。 |
| [14](14-conflict-reload-recovery.png) | 重新加载外部版本，外部写入内容保持。 |
| [15](15-after-create-immediate-input.png) | 修复后新建文件加载完成，直接x进入编辑器，无额外点击。 |
| [16](16-after-range-free-open-loading.png) | 普通文件无range冷读期间，主动转到Main输入草稿。 |
| [17](17-after-range-free-keeps-main-focus.png) | 无range读取完成，Main仍保留焦点与未发送草稿。 |
| [18](18-after-file-keyboard-open.png) | 从Files实际Enter打开普通文件，编辑器正常取得焦点。 |
| [19](19-after-source-range-reveal.png) | 原真实Source再次定位第2行，标题、原文、行带和焦点正常。 |

[业务正向checker](business-checked.json)通过真实公开HTTP消息与原SQLite核对同一用户输入parent、实际OpenAI/gpt-6.1-sol、唯一completed read、原结果正文、Source原path/range/toolPartID及持久Source身份；这是原真实业务事实，不是模型自述或UI自动断言。[安全证据](evidence.json)包含实际文件快照、GET/PATCH等待、焦点诊断、Source范围呈现、409原服务错误片段、数据保留及完整原运行退出。人工视觉判断不由这些文本检查替代。

每次读取/保存仅通过原beforeRequest注入8秒等待；真实路由、文件、原子写、revision校验和响应保留。`latency-end`只结束注入等待，PATCH日志的file=null表示原path在请求体而不在query。 before实际5次Sol请求含真实读取流程，after实际2次预检，总7/16，全部流式200、原reader settled/EOF。after沿完整原持久数据读取before真实Source，没有重新发业务或合成Source。

两scope公开shutdown200，原85722/55997、native/launcher均0，物理完成/输出排空/请求清理和精确出生链闭合；auth/models成对退休，分别预留494508/886879ms。90表源原行/所有字段时间/库bytesmtime/schema5对象/integrity与canonical保持；before目标有真实会话更新时间、两容量租约及memory revision43→44当前输入锚点的自然变化，after只有两容量租约变化，逐项保留。before五个原物理来源文件保持；after六个原件包含本批before文件外部版本，完整bytes/mtime保持。新after专用文件保留为空，键入x仅为丢弃的本批草稿，两份新文件均留在自有测试项目，不删旧数据。用户18571未操作。

Artifact无显式revision的焦点流程仅经当前四消费者代码核对，没有新增Artifact实页、活跃成员Rendering、移动端或原生WebView2资格。极长文件名等原标题限制不变。调查见[记录](../../records/2026-10/2026-10-24-file-editor-roundtrip.md)。
