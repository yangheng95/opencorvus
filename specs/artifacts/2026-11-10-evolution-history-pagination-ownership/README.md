# 专家团演进历史读取证据

规格：[专家团演进历史保留最新目录](../../records/2026-11/2026-11-10-evolution-history-pagination-ownership.md)。隔离桌面使用真实开发服务、生产安装和制品目录；代理只延迟或截断指定读取回执。截图为手工复核证据，不用于自动比较。

[回执与持久事实](receipts.json)记录源端请求身份、冻结游标和实际制品；目录路径已省略。两次使用同一发布前 SQLite 备份状态，分别通过实际制品写入器发布各自的第 23 条。基线开发服务/代理为 39441/39442，候选为 39443/39444；均为隔离本地服务。

| 实页截图 | 人工看到的结果 |
| --- | --- |
| [基线冻结历史](baseline-initial-frozen-history.jpg) | 原首页上界 26、最新第 22 条。 |
| [基线刚刷新](baseline-new-catalog-visible-before-late-page.jpg) | 上界 27、新第 23 条。 |
| [基线旧回执覆盖](baseline-late-page-reverts-fresh-catalog.jpg) | 上界退回 26，第 23 条不见。 |
| [候选旧页已释放](candidate-late-page-retains-new-catalog.jpg) | 上界维持 27、第 23 条仍在。 |
| [候选加载新尾页](candidate-new-cursor-three-tail-rows.jpg) | 第 3、2、1 条在原列表底部，选中第 1 条。 |
| [切至无比较的条目](candidate-selection-keeps-campaign-23.jpg) | 旧比较结束后，所选详情仍是第 23 条的冻结基线、数据集和预算。 |
| [重新读取精确比较](candidate-campaign-22-exact-comparison.jpg) | 第 22 条显示基线和候选两项证据。 |
| [中文续页传输中断](candidate-chinese-continuation-error.jpg) | 中文反馈，展开显示原始诊断，保留上界 27。 |
| [中文原游标恢复](candidate-chinese-same-cursor-recovered.jpg) | 按原续页控件成功显示第 3、2、1 条。 |
| [切到另一安装](candidate-switches-to-exact-other-installation.jpg) | 旧详情结束后，Evolution Lab 仍是其独立空历史。 |
