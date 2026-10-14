# 首次复制的浏览器观测证据

[Recall、根因边界与手工调查方案](../../records/2026-10/2026-10-14-clipboard-first-observation.md)。本轮没有产品源码改动，使用真实MDN网页和当前开发服务`localhost:18525/ui/`，没有UI自动化测试。

| 实际顺序 | 结果与原图 |
| --- | --- |
| 冷MDN页先Copy，再首次工具读取 | Copied但读到自有旧基准；首次旧值发生在截图之前。[01](01-A-first-copy.jpg) |
| 新MDN页先工具读取，再首次Copy | `writeText(newClipText)`，截图前后和control均一致。[02](02-B-first-copy.jpg) |
| 冷MDN页Copy，先从已有control读取 | control、冷页首读与control再次读均为旧基准。[03](03-C-cold-copy.jpg) |
| 第一产品页在Loading时预读，再定位点击 | 未观察到Copied，实际粘贴旧基准；保留未定动作。[04](04-product-before-copy.jpg)、[05](05-product-first-copy-paste.jpg) |
| 同产品页改选其他真实来源 | README指针复制、不同网页键盘复制均Copied，完整粘贴正确。[06](06-file-source-first-paste.jpg)、[07](07-web-source-keyboard-paste.jpg) |
| 新产品页呈现完成后预读，首次键盘复制 | URLSearchParams原URL读回与Ctrl+V正确。[08](08-ready-page-before-first-copy.jpg)、[09](09-ready-first-keyboard-paste.jpg) |
| 重跑新页呈现完成后预读，首次原生指针点击 | 单次点击明确Copied，读回与Ctrl+V正确；切换文件来源也正确。[10](10-replay-pointer-target.jpg)、[11](11-replay-first-pointer-paste.jpg)、[12](12-replay-file-paste.jpg) |
| 重跑另一新页呈现完成后预读，首次键盘复制 | 单次Enter明确Copied，原URL读回与Ctrl+V正确。[13](13-replay-keyboard-target.jpg)、[14](14-replay-first-keyboard-paste.jpg) |

所有14张图均为实际呈现后人工查看的原始JPEG；[observations.json](observations.json)保留公开剪贴板工具返回的顺序和原值。输入均为自有基准、公开网址或自有测试项目路径；粘贴草稿清空，未发送。没有产品写入基准、双写或复制重试实现。

第一次工具交接顺序会改变观察结果，且独立MDN页也复现。浏览器内部同步机制仍未知；准备后的产品通过不能代替普通桌面宿主首次复制资格，也不能覆盖05的未定定位动作。

[execution-summary.json](execution-summary.json)列出两轮真实Provider请求与结算。首轮[live](live/native-host-settled.json)达到固定600秒，原14978 exit1；公开shutdown连接拒绝，保留deadline_exceeded。重跑[公开shutdown](replay/public-shutdown.json)为200，[生产结算](replay/native-host-settled.json)为exited/0，两个scope物理、输出、请求和配对清理均完成。重跑原工具13147已被join，但其exit字段未在压缩后上下文保留；不伪造工具exit0回执。全部自有页面关闭。

两轮分别2条、共4条实际gpt-6.1-sol流式预检请求，原Provider审计在[live](live/provider-audit.json)与[replay](replay/provider-audit.json)，均200/settled/eof；复制操作没有发新模型工作提示。auth和完整models仅在隔离运行时配对使用并退休，凭据内容未归档。

[data-facts.json](data-facts.json)来自只读真实SQLite，[persisted-facts-check.json](persisted-facts-check.json)记录与405原始事实逐字段对照：schema v1、两个会话、18消息、14来源及10个完成工具的身份和绑定一致。`execution/`保存实际启动、结算、只读检查器和原日志gzip；Node构建91895 exit0。文档检查345 ops/26 groups，架构19份current文档和链接有效。

`previous-410/`承接上轮736644706交付原件：首个正常push全部hooks通过后CAS exit1；fresh fetch/merge后正常push exit0，ls-remote精确73664470621ff6b76b84c40c554afadd6ecc8759。失败日志和成功日志分开保留。
