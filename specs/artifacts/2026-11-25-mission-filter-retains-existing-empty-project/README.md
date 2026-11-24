# 空项目筛选与创建目标证据

真实开发页连接两个自行建立的隔离目录，各自通过公开接口保存一条草稿。本批只修改这些隔离草稿和本地验证实例。

- [基线项目筛选](baseline-selected-project.png)只显示所选项目的原草稿。
- [相同页面的筛选切换](baseline-switches-to-all-projects.png)展示归档后原版自动切换到全部，显示另一项目。
- [基线创建项目默认值](baseline-create-defaults-to-other-project.png)展示同一个页面打开新建后，默认值成了另一项目。随即取消。
- [原草稿归档回执](baseline-archive-receipt.json)与[归档后的项目和成员查询](baseline-read-receipts.json)核对原项目仍在工作记录中，而原草稿确实进入归档。

候选页面在同一数据上实际复核。

- [选择没有活动任务的项目](candidate-selects-empty-project.png)与[最后一条归档后仍处于原筛选](candidate-archive-keeps-filter.png)。原草稿经历一次[恢复](candidate-restore-receipt.json)和一次[再次归档](candidate-archive-receipt.json)。
- [新建窗口预填原项目](candidate-create-uses-selected-project.png)、[保存后在筛选内显示新卡片](candidate-draft-saved-in-filtered-project.png)和[全部项目列表](candidate-all-projects-preserve-both.png)展示真实操作结果。[项目限定读取](candidate-exact-project-receipts.json)核对新草稿、原归档草稿及另一项目。
