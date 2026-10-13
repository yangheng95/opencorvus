# 当前基线 Sources 阅读证据

见[本轮 Recall 与验收方案](../../records/2026-10/2026-10-14-source-reading-current-baseline.md)。旧数据库已经按用户要求移除，本轮使用版本1的新隔离运行，只使用单agent和一个手动产品会话。

真实Main Chat主会话和Side chat引用历史已在18517/ui完成以下人工验收，没有生产代码修改。

| 图片 | 实际观察 |
| --- | --- |
| [01](01-live-start.jpg) | 真实用户输入、流式正文与webfetch开始 |
| [02](02-source-copy-live.jpg) | 网页读取继续时来源标题/host与复制反馈 |
| [03](03-copied-url-paste.jpg) | Ctrl+V在输入框得到完整原URL；草稿未发送 |
| [04](04-expanded-search-sources.jpg) | 一个真实搜索结果的三条来源及展开/收起 |
| [05](05-side-chat-reference-ready.jpg) | 侧聊9消息引用历史准备完成，主区保持来源展开 |
| [06](06-reference-history-sources.jpg) | 正式继承历史展开 |
| [07](07-reference-source-reading.jpg) | 380像素侧栏的正文与单来源 |
| [08](08-side-search-expanded.jpg) | 侧栏三条来源，长标题自然换为两行 |
| [09](09-side-source-excerpt.jpg) | 真实来源摘录及内部阅读区 |
| [10](10-chinese-reopened-sources.jpg) | 中文重开后的来源控件及正文 |
| [11](11-file-source-open.jpg) | 从来源进入实际README文件编辑器 |

`data-facts.json`是只读SQLite事实；`checked-facts.json`与`check-facts.log`来自实际backend checker。主会话两条用户消息、七条assistant Message、五次实际Tool effect和七条来源；侧聊继承九消息、七来源副本，副本不增加实际检索计数。全部来源均绑定同Message的completed Tool，来源payload在正式fork后逐值相等。数据库版本1。

`provider-audit.json`和`checked-facts.json`保留12次真实gpt-6.1-sol流式请求/EOF，包括预检与产品memory辅助；不是12个工作agent。`preflight-ready.json`证明凭据usable、目录projected与实际请求模型一致。`native-host-ready.json`、`native-host-settled.json`、`physical-terminal-and-pair-cleanup.json`、`qualified-surface-completion.json`和启动/关闭日志证明原Target、Host、输出、request及端口正常退出、复制的auth/models已清理。凭据内容与整个运行数据库不归档。

`scripts/`保存本轮调用的启动/关闭器与只读数据checker；它们不是UI自动化，实际UI仅由CUA逐步操作并人工截图。构建日志的常规依赖/chunk提示保留。原生AX与Playwright定位差异、页1丢失、clipboard API返回空和实际粘贴成功的边界均见Recall，不将工具局限包装为产品缺陷。

本轮没有复现短会话反复Rendering。单次新页面初始渲染不是流式闪烁；原长成员历史、超过32份正文、成员生命周期、网页目标实际导航和浅色模式仍待继续验收。共享工作区另有其他任务未提交改动，本轮使用当前构建；未替其他改动作交付结论。
