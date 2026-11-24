# 环境栏重叠读取的桌面证据

- [后台已返回 main，展开的环境栏仍在等待第二份读取并显示 review](baseline-duplicate-read-keeps-review.jpg)
- [重复读取返回后环境栏才显示 main](baseline-second-read-updates-main.jpg)
- [候选展开环境栏等待原后台读取](candidate-shares-pending-branch-read.jpg)
- [原后台响应到达后直接显示 review](candidate-original-response-updates-review.jpg)
- [候选手动刷新完成，刷新按钮仍持焦](candidate-manual-refresh-settles.jpg)
- [下一次真实切回 main 后自动更新](candidate-next-branch-still-refreshes.jpg)

[调查、请求和验收方案](../../records/2026-11/2026-11-25-environment-joins-pending-git-metadata.md)
