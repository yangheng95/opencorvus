# 暂停计划并发编辑的证据

## 初始证据

- [暂停定义的真实列表](paused-definition-in-list.png)，[原定义详情](initial-paused-details.png)，[旧基准的本地编辑](authored-local-edit.png)，[过期保存后仍保留草稿](stale-save-keeps-local-draft.png)。
- [检查脚本修正后正式回读](recovered-seed-requests.json)，[原暂停定义](paused-definition.json)，[另一写入者的实际条件写入](other-writer-receipt.json)。

## 版本拒绝与显式恢复

- [409 原诊断和两份修订](revision-conflict-details.png)，[中文冲突与保留的本地输入](chinese-conflict-retains-local-input.png)。
- [通过列表新读的已接受定义](fresh-read-remote-definition.png)，[新基准上的人工合并编辑](merged-editor-on-fresh-revision.png)。
- [中文实际保存结果](chinese-saved-merged-definition.png)，[英语最终暂停定义](english-final-paused-definition.png)。
- [最终定义及实际运行历史回执](final-definition-verification.json)。

全部截图来自本人专用 Chrome 的真实 `/ui/`，使用原生 Computer Use 交互并逐张查看。样本为 2099 年一次性定义，创建后即暂停，未运行。首轮检查脚本误用精简创建回执，修正后只核验已存在的唯一样本，没有补造原请求回执。
