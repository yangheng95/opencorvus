# Markdown 文档返回证据

## 基线

- [长文档中的交接段与原链接](baseline-source-reading-position.png)
- [实际子文档 rollout](baseline-rollout-link-target.png)
- [从 rollout 再进入附录](baseline-appendix-link-target.png)
- [从资源管理器重开原稿后回到开头](baseline-explorer-reopens-at-start.png)

四张截图来自 `40248/ui/` 的真实隔离 Windows 浏览器操作，已人工查看。浏览器后退按钮进入本次验收设定的上一页 `40248/global/health`。三个读取地址均为 200 且返回内容与实际项目文件逐字相同。

## 候选

- [指南原处](candidate-guide-before-follow-en.png)、[rollout](candidate-rollout-first-open-en.png)、[第二级附录](candidate-appendix-en.png)
- [先返回 rollout](candidate-rollout-return-en.png)、[再返回指南原位置](candidate-guide-return-en.png)、[Tab 到相邻链接](candidate-guide-next-link-keyboard-en.png)
- [返回时的草稿确认](candidate-dirty-return-dialog-en.png)、[继续编辑后保留的草稿](candidate-keep-editing-en.png)、[放弃后返回原位置](candidate-return-after-discard-en.png)
- [中文界面中的同文档章节](candidate-same-document-chapter-zh.png)、[真实缺失目标与返回入口](candidate-missing-reference-zh.png)、[返回来源](candidate-return-from-missing-zh.png)、[Tab 到下一条实际链接](candidate-next-link-zh.png)
- [切换到第二项目](candidate-project-switch-zh.png)、[同名指南属于第二项目](candidate-second-project-guide-zh.png)

真实候选在 `40250/ui/`，每张截图均已人工检查。指南、rollout、appendix 与其基线原件分别为 4029、258、73 字节，逐字节相同。三个文件和第二项目 `guide.md` 分别按其作用域读取 200，返回正文与磁盘一致。未创建的 `manual/chapters/unavailable.md` 实际返回 404 `FileNotFoundError`。拥有的浏览器已关闭，开发基线 27200 与候选 36072 均返回关闭应答 200 后正常退出。端口 `40248`、`40250` 均已释放。
