# 当前首页与取消工具呈现

[实施前Recall、根因与验收记录](../../records/2026-10/2026-10-21-home-goal-current-review.md)。单开发agent，真实Source CLI开发/ui，零模型预算，无凭据/模型目录副本，未操作用户服务/数据库。

## 人工截图

- [01英文首页](01-before-home-en.png)、[02使用说明](02-before-guide-en.png)、[03创建表单](03-before-create-en.png)：入口与操作区可见；01有按钮悬停提示。
- [04中文首页草稿](04-before-home-draft-zh.png)、[05表单原草稿](05-before-goal-draft-zh.png)、[06关闭后保持](06-before-cancel-retains-draft-zh.png)：未确认创建或发送输入。
- [07修复前失败计数](07-before-cancelled-tool-failed-zh.png)、[08展开后的上方成功工具](08-before-expanded-cancelled-tool-zh.png)、[09原取消被标出错/红框](09-before-cancelled-tool-error-feedback-zh.png)。
- [10修复后英文取消计数](10-after-cancelled-summary-en.png)、[11单项取消原因](11-after-cancelled-detail-en.png)、[12原始完整诊断](12-after-original-diagnostic-en.png)。
- [13中文取消详情](13-after-cancelled-detail-zh.png)、[14中文取消汇总](14-after-cancelled-summary-zh.png)、[15首页创建表单](15-after-home-create-zh.png)、[16最终中文首页](16-after-home-zh.png)。

16张全部人工查看；没有UI自动化、DOM断言、组件或快照测试。Task截图的模型配置提示属于明确零凭据的阅读scope，不是Provider验收。

## 事实与运行

- [原Tool公共读取200](public-original-tool.json)：真实id/session/message、原error状态与完整MessageAbortedError保持；不依据原因文案推断取消。
- [数据准备before](before-data-preparation.json)、[after](after-data-preparation.json)与[全部原行联合比较](data-preservation-observation.json)：两scope各90表145033原行/字段差异0、schema3/integrity、源bytes/mtime与完整canonical保持。
- [before完整物理结算](before-physical-terminal.json)、[after](after-physical-terminal.json)与[范围处置](scope-disposition.json)：公开shutdown200、原exec/native/output/request/launcher/出生链结束，Provider0/max0，页面83/84关闭。
- [类型检查](typecheck.log)、[正式新前端构建](build-after.log)、[其它正式检查](checks.json)。构建原警告保留；这些不能替代截图。
- 复现脚本：[数据复制](prepare-data.ts)、[数据保留](preserve.ts)、[独立构建](build.mjs)、[开发服务](serve.ts)、[启动](launch.ps1)、[公开停止](shutdown.ps1)、[精确结算](settle.ps1)、[原Tool读取](capture.ts)。私有完整数据库/原行JSON和运行历史不提交。

本批只改Overlay工具呈现；原工具结果、错误类型/原因/诊断、后端取消和数据库均保持。首页没有发现新布局缺陷，未强造布局补丁。源只有一个明确取消工具失败，普通真实失败、混合组、独立成员取消历史的视觉覆盖未达。未测试新模型流、并发/重连/连续Rendering，不扩大结论。
