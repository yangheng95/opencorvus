# 第 118 批：项目文档就地恢复的桌面证据

真实开发服务与两个自有 Git 项目。只对指定项目的 `GET /experimental/project-memory` 做单次真实响应中断；另一次将同一路由完整 200 延迟 7 秒。正常工作列表、Notes、主文档和网页双向连接继续转发。

| 截图 | 人工复核 |
| --- | --- |
| [01](01-before-primary-document-is-readable.jpg)、[02](02-before-secondary-document-fails-but-notes-accept-draft.jpg)、[03](03-before-reachable-origin-still-needs-project-switch.jpg)、[04](04-before-switching-back-recovers-document-but-drops-draft.jpg) | 主文档正常；次文档失败但 Notes 可键入。服务器已恢复，页面无重试；切回原项目后文档恢复，草稿丢失。 |
| [05](05-after-document-failure-has-retry-and-note-draft.jpg)、[06](06-after-localized-error-and-original-diagnostic.jpg)、[07](07-after-keyboard-retry-recovers-document-and-keeps-draft.jpg)、[08](08-after-tab-continues-to-preserved-notes-draft.jpg) | 首轮候选：中英就地重试、原诊断与草稿；默认轮廓紧贴标题，次序正确。 |
| [09](09-final-document-failure-keeps-notes-draft.jpg)、[10](10-final-themed-focus-keeps-title-clear.jpg)、[11](11-final-tab-continues-to-preserved-draft.jpg) | 最终构建：同目录恢复，文档区焦点框与标题有间距，Tab 继续进入原草稿。 |
| [12](12-final-secondary-document-retry-is-in-flight.jpg)、[13](13-final-new-project-document-before-old-reply.jpg)、[14](14-final-late-old-document-does-not-replace-current.jpg)、[15](15-final-deliberate-return-reads-secondary-document.jpg) | 实际在途时切换，完整旧回执之后仍是主文档及原焦点，主动切回才见次项目的不同更新时间。 |

[基线](before-observed.json)、[首轮候选](first-candidate-observed.json)、[最终](after-observed.json) 与[迟到响应](scope-observed.json) 是实页观察。`*-proxy.jsonl` 提供原请求/项目目录/原响应与迟到次序；[基线直连](before-live-recovery.json) 证明原页仍报错时同目录实际可读。[真实服务检查器](check-project-document-tcp.mjs) 和[结果](after-live-check.json) 核对两文档、Notes、项目身份和四份 Git 文件。代理用法：`node project-document-proxy.mjs <代理端口> <服务端口> <隔离次项目目录> [中断次数] [第二次及以后的断流延迟毫秒] [首个成功响应延迟毫秒]`。
