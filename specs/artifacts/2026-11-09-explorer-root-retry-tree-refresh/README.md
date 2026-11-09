# Explorer 根重试同步刷新：实际桌面与请求

以下均为开发服务实际页面截图，已逐张人工复核。

| 图 | 观察 |
| --- | --- |
| [01](01-before-healthy-and-collapsed-control.jpg) | 基线展开三目录；archive 折叠 |
| [02](02-before-root-failure.jpg) | 基线共同失败只有根错误 |
| [03](03-before-root-retry-shows-stale-child-errors.jpg) | 基线键盘重试只恢复根，重新显示三条旧子错误 |
| [04](04-before-recovered-at-next-auto-read.jpg) | 基线下一次轮询后才恢复真实空目录及原文件 |
| [05](05-after-healthy-and-collapsed-control.jpg) | 候选健康对照 |
| [06](06-after-root-failure.jpg) | 候选共同失败的根诊断 |
| [07](07-after-root-still-fails-on-retry.jpg) | 实际重试后四个读取仍失败，保留一个根诊断 |
| [08](08-after-one-retry-recovers-whole-open-tree.jpg) | 一次根重试恢复整棵展开树 |
| [09](09-after-chinese-root-failure.jpg) | 中文根诊断及重试 |
| [10](10-after-retry-keeps-only-current-child-error.jpg) | 一次根重试后只留下仍失败的 drafts |
| [11](11-after-child-retry-recovers-empty-folder.jpg) | 该子目录自己的重试恢复「空目录」 |
| [12](12-after-explicitly-opening-collapsed-control.jpg) | 主动展开 archive 才看到 archived.txt |

[基线页面事实](before-observed.json)、[候选页面事实](after-observed.json)保存真实按键与所见。[请求与服务配对审计](owned-request-audit.json)含时间、路径、响应和请求编号，及各隔离数据库和原文件事实。[代理](directory-scope-proxy.mjs)只改变同项目读取路径，[基线](before-proxy.log)和[候选](after-proxy.log)是原始局部日志，[模式切换](proxy-mode-changes.jsonl)记录实际时点。

实时接口说明检查：[基线初始](before-initial-tcp.json)、[基线恢复](before-recovered-tcp.json)、[候选初始](after-initial-tcp.json)、[候选恢复](after-recovered-tcp.json)；[三项检查器](check-folder-tcp.mjs)和[带 archive 的检查器](check-with-archive-tcp.mjs)。真实进程回执：[基线启动](before-startup.json)、[基线关闭](before-shutdown.json)、[候选启动](after-startup.json)、[候选关闭](after-shutdown.json)。
