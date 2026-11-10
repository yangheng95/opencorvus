# 路径与 Git 元数据的独立读取证据

第 208 批。真实 Git 仓库与同名非 Git 目录均有实际基线。路径或 Git 响应分别截断时，基线界面都撤下先前 Git 信息。以下为本人复核的 1280 × 720 实际桌面截图：

- [基线 Git 故障：失去分支、统计及工作树](baseline-en-vcs-failure-loses-branch.jpg)。
- [正常](final-en-healthy.jpg)与[刷新等待](final-en-git-pending.jpg)：保留摘要和工作树位置，刷新按钮持焦。
- [英文路径故障和可展开原诊断](final-en-path-diagnostic.jpg)、[英文 Git 故障和上次确认值](final-en-git-failed.jpg)。
- [中文 Git 故障](final-zh-git-failed.jpg)、[中文路径故障](final-zh-path-failed.jpg)、[键盘恢复](final-zh-keyboard-recovered.jpg)及[同名非 Git 项目](final-zh-beta-no-git.jpg)。

[验收回执](receipt.json)记录真实接口、实际页面经过代理的响应、每轮隔离数据库及服务退出结果。三轮代理仅扣留或截短开发服务的真实响应。两份原始样本和隔离 Git 提交保持原值。

[规格与根因](../../records/2026-11/2026-11-10-project-path-and-git-read-settlement.md)。
