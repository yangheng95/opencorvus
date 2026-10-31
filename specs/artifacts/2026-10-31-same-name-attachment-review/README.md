# 同名附件核对证据

本轮使用真实开发模式 `/ui`、隔离原生服务与内置浏览器手工操作。下列 16 张截图均实际呈现并人工查看；没有新增或运行 UI 自动化测试。

基线为 `main-BeU9pWqt.js` / 38455，候选为 `main-Cjs5Jyw6.js` / 38456。用户服务、数据库和窗口未操作。

| 截图 | 实际观察 |
| --- | --- |
| [01 预检](01-before-visible-preflight.png) | 实际选择 GPT-6.1 Sol，可见预检回复成功。 |
| [02 英文基线](02-before-identical-labels-en.png) | 两个不同原件均叫 notes.txt，预览及移除名称重复。 |
| [03 第一原件](03-before-first-original-en.png) | ALPHA / 17。 |
| [04 第二原件](04-before-second-original-en.png) | BRAVO / 29，实际下载字节与原件相等。 |
| [05 中文基线](05-before-identical-labels-zh.png) | 中文操作名称同样无法区分两个条目。 |
| [06 空闲停止回归](06-after-idle-stop-confirm-en.png) | 侧栏 Stop background activity 可用；确认说明保留消息、可继续，默认 Cancel；本轮取消以保留原会话。 |
| [07 英文标签](07-after-distinct-labels-en.png) | 当前列表显示 1 · notes.txt、2 · notes.txt，完整草稿保持。 |
| [08 第一预览](08-after-first-original-en.png) | 标题 1 · notes.txt 对应 ALPHA / 17。 |
| [09 第二预览](09-after-second-original-en.png) | 标题 2 · notes.txt 对应 BRAVO / 29；下载名仍是 notes.txt。 |
| [10 中文标签](10-after-distinct-labels-zh.png) | 查看/移除入口含相同序号，草稿及两个原件保持。 |
| [11 移除一项](11-after-removal-unique-zh.png) | 剩余唯一原件恢复 notes.txt，焦点交给其移除按钮，草稿保持。 |
| [12 重添后第一项](12-after-readded-first-bravo-zh.png) | 当前第一项是保留的 BRAVO / 29；序号来自当前数组。 |
| [13 重添后第二项](13-after-readded-second-alpha-zh.png) | 当前第二项是重新添加的 ALPHA / 17，关闭返回当前预览触发器。 |
| [14 实际模型回复](14-after-real-model-and-sources-zh.png) | 两次真实 read 后分别返回 BRAVO / 29、ALPHA / 17及原件链接。 |
| [15 第一 Sources](15-after-source-bravo-zh.png) | 实际点击工具 Sources，文件面板打开 BRAVO / 29。 |
| [16 第二 Sources](16-after-source-alpha-zh.png) | 第二 Sources 打开 ALPHA / 17。 |

两份自制原件同 basename、同为 52 字节、内容不同。公开导出确认发送后的两个 FilePart 原名均为 notes.txt，引用彼此独立；两次完成的 read 与两个 source-file 按 toolPartID 真实关联。原资源端点和 source-content 均返回对应的完整原字节，下载结果逐字节相等。没有把展示序号写进原文件身份，也没有插入模型消息或伪造引用。

基线 2、候选 4，共 6/8 个实际模型请求，辅助记忆请求全部计入；全部为 gpt-6.1-sol、流式、HTTP 200、读取器 settled/EOF，累计 1124。未消耗额度随本轮退休，不追加调用。

两服务均公开 shutdown 200，原执行句柄、原生进程和启动器退出 0，物理完成、输出排空、请求清理和进程出生身份结清后才退休四份配对认证/模型目录副本。原认证元数据及模型目录字节/元数据保持。schema 始终 9、92 表；旧业务行全部保持，两个过期物理容量槽按生产 writer 复用并最终释放。75 旧附件、十三 Git 项目及 28 tracked 文件、旧对话/Goal/Sources/原文件和两个暂停的定时定义保持。

范围是待发送附件的辨识。历史消息与 Sources 继续展示真实原名；本轮只验证它们读取正确原件，没有重新设计历史同名条目的视觉标识。图片、原生目录选择、Task/Mission 停止和原生桌面应用未扩展验收。

结构化实际结果见 [verification.json](verification.json)。
