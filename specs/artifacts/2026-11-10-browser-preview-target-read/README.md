# 任务浏览器预览目标读取：真实桌面证据

对应[根因与方案](../../records/2026-11/2026-11-10-browser-preview-target-read.md)。真实开发模式、自有 Git 项目和已结束的任务。透传只对任务目标 GET 的实际 HTTP 200 施加页面传输故障，未改写服务数据或证据；未打开已保存的环回目标页面，也未启动模型。

| 前态 | 本人复核所见 |
| --- | --- |
| [Probe](probe-01-task-and-dock.jpg) | 任务处于已结束状态，右侧停靠区可用。 |
| [01](before-01-target-read-failure.jpg) | 右侧工具 Browser 打开的是独立普通标签；网页刷新禁用，此时尚未读取任务目标。 |
| [02](before-02-environment-after-target-read-failure.jpg) | 打开 Environment 期间的环境面板，Explorer 仍可用。 |
| [03](before-03-environment-silently-omits-target.jpg) | 真实目标响应中断后，环境没有任务浏览器入口或错误。 |
| [04](before-04-environment-accepted-target.jpg) | 重开环境并成功收到同一真实目标时，Browser 入口出现。 |
| [05](before-05-task-target-error-without-recovery.jpg) | 固定任务标签重新请求同一目标，传输中断后只有错误与禁用的网页刷新。 |
| [06](before-06-reopened-target-uses-original-url.jpg) | 关闭固定标签，经环境成功读取再重开后，原目标地址回到固定标签。普通标签保持独立。 |

| 后态 | 本人复核所见 |
| --- | --- |
| [07](after-07-environment-shares-target-failure.jpg) | 已选任务在停靠区关闭时完成一次失败读取，环境的 Browser 入口带状态。 |
| [08](after-08-task-target-retry-shared-failure.jpg) | 固定任务标签显示同一失败；目标 Retry 和网页 Reload 是不同动作。 |
| [09](after-09-expanded-original-target-diagnostic.jpg) | 展开原浏览器传输诊断。 |
| [10](after-10-keyboard-retry-keeps-diagnostic-and-focus.jpg) | 连续回车只启用一次读取，原 Retry 保留焦点和已展开详情。 |
| [11](after-11-target-recovered-in-same-tab.jpg) | 原标签恢复实际地址，焦点进入地址栏。 |
| [12](after-12-ordinary-browser-remains-independent.jpg) | 加号新建的普通浏览器独立且空白。 |
| [13](after-13-chinese-target-read-failure.jpg) | 中文失败反馈、详情和重试。 |
| [14](after-14-chinese-retry-focus-moved-to-tab.jpg) | 重试等待期间主动切换到标签标题。 |
| [15](after-15-chinese-recovered-keeps-tab-focus.jpg) | 读取成功后焦点留在原标签标题。 |
| [16](after-16-historical-target-does-not-open-dock.jpg) | 后台已确认原有目标，停靠区保持关闭。 |
| [17](after-17-new-real-target-reveals-fixed-browser.jpg) | 实际发布新目标后，固定任务预览随现任务事件打开。 |

[前态透传](before-proxy.jsonl)和[后态透传](after-proxy.jsonl)保留原始 200 的请求身份、读内容与终态；[前态确认](before-settled-tcp.json)、[候选确认](after-seed-tcp.json)、[新目标发布](after-reveal-tcp.json)及[最终读回](after-settled-new-tcp.json)来自实际公开接口。[最终只读核查](owned-final-check.json)记录隔离任务、已保存目标和原项目文件。[前态关停](before-shutdown.json)和[后态关停](after-shutdown.json)均为正常关停回执。
