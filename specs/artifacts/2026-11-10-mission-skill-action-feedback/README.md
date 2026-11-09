# 多步任务技能就近反馈：桌面验收

[分析和方案](../../records/2026-11/2026-11-10-mission-skill-action-feedback.md)。以下是本人隔离项目的真实 `/ui/` 截图，均人工查看。技能名称、调用文本和源路径来自自有目录与真实接口。

| 图 | 旧版 `39324`，`main-B-8Xi87r.js` |
| --- | --- |
| [01](01-before-detail.jpg) | 真实项目技能长详情，复制调用与源路径分别位于不同区域。 |
| [02](02-before-remote-invocation-feedback.jpg) | 实际复制调用成功后，反馈在页首，点击按钮的位置下移。 |
| [03](03-before-invocation-stale-language.jpg) | 不关闭技能详情，切中文后旧成功反馈仍是英文。 |
| [04](04-before-remote-source-feedback.jpg) | 对源路径按钮按 Enter，结果仍在页首并把按钮推到页面下缘。 |

[旧版真实目录接口结构检查](before-tcp.json) · [启动](before-startup.json) · [关停](before-shutdown.json) · [接口检查器](check-mission-skill-catalog.mjs)

| 图 | 修复版 `39325`，`main-CzKUCAnP.js` |
| --- | --- |
| [05](05-after-invocation-local.jpg) · [06](06-after-invocation-live-locale.jpg) | 键盘复制调用后就近显示，焦点留在操作；同一反馈随语言切换。 |
| [07](07-after-source-local.jpg) · [08](08-after-source-live-locale.jpg) | 复制源路径从原按钮显示，就近回执中的实际路径保持，提示随语言切换。 |
| [09](09-after-project-root-local.jpg) · [10](10-after-project-root-real-error.jpg) · [11](11-after-global-root-error-local.jpg) | 两个实际目录操作的错误分别在自己的行显示；项目原 HTTP 400 原因可展开。 |
| [12](12-after-invocation-readback.jpg) | 重新打开后鼠标复制精确调用；隔离剪贴板读取与自有原文匹配。 |

[修复版读取前](after-initial-tcp.json) · [修复版读取后](after-tcp.json) · [请求头对照](directory-content-type-probe.json) · [对照脚本](directory-content-type-probe.mjs) · [数据库计数](database-facts.json) · [原始文件及进程](closed-and-inputs.json) · [启动](after-startup.json) · [关停](after-shutdown.json)
