# 通道目录读取和重试：真实桌面证据

对应[调查与方案](../../records/2026-11/2026-11-10-channel-catalog-read-retry.md)。真实开发服务和自有 Git 项目。透传仅延迟指定项目的真实通道响应，未改写内容。本人复核真实桌面，未连接通道或保存配置。

| 前态 | 复核所见 |
| --- | --- |
| [01](before-01-pending-mislabelled-empty.jpg) | 正在真实读取却显示 No channels available。 |
| [02](before-02-failure-still-mislabelled-empty.jpg) | 超时与错误空态同时显示，目录没有重试入口。 |
| [03](before-03-timeout-limited-diagnostics.jpg) | 展开只保留简化的路径和超时字符串。 |
| [04](before-04-fresh-page-real-catalog.jpg) | 新页面接收同一实际目录，显示正常 27 项。 |

| 后态 | 复核所见 |
| --- | --- |
| [05](after-05-en-pending-catalog.jpg) | 英文局部加载状态。 |
| [06](after-06-en-failure-inline-diagnostics.jpg) | 超时诊断与重试紧邻目录，保留地址草稿。 |
| [07](after-07-en-retrying-keeps-button-and-draft.jpg) | 重试忙时按钮仍保有焦点，草稿和已展开诊断可见。 |
| [08](after-08-en-accepted-catalog-title-focus.jpg) | 真实目录恢复，键盘焦点到目录标题，草稿仍在。 |
| [09](after-09-en-existing-telegram-editor.jpg) | 打开确切通道现有编辑器；图中令牌框是示例占位符。 |
| [10](after-10-zh-initial-catalog.jpg) | 中文加载状态。 |
| [11](after-11-zh-catalog-timeout.jpg) | 中文超时和重试入口。 |
| [12](after-12-zh-retry-focus-moved.jpg) | 重试期间主动移动焦点到公网基地址。 |
| [13](after-13-zh-accepted-keeps-input-focus.jpg) | 中文目录成功显示，输入焦点保持。 |

[候选透传回执](after-proxy.jsonl)保留五次真实请求、响应和终态；[前态](before-tcp.json)与[后态](after-tcp.json)记录直接运行时接口、项目、27 项身份和状态，后态包含保存地址读回。[最终只读审计](owned-final-check.json)记录隔离项目原文件、执行及配置检查，[候选开发服务](after-shutdown.json)与[候选透传](after-proxy-shutdown.json)有正常关停回执。截图没有像素或文案自动断言。
