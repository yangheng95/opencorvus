# 归档后台刷新期间的阅读与焦点证据

截图来自同一个隔离项目、同一个归档搜索，使用实际公开会话和归档读取。

- [归档已加载且 East 的 Open 有焦点](baseline-archive-open-focused.jpg)。
- [另一个真实归档条目的改名发起后台读取，原 Open 全部禁用](baseline-relevant-refresh-disables-reading.jpg)。焦点检查为 `BODY`，键盘 Down 后 Enter 仍在归档页面。
- [仅在释放响应并读回新标题后恢复到 East](baseline-focus-returns-after-refresh.jpg)。
- [三个原始身份、改名回执和中继请求时间](baseline-archive-reading-receipts.json)。

## 当前实现

- [读取在途时按 Down 选中 West](candidate-west-focused-during-refresh.jpg)，[接受新标题后仍保留 West 的 Open 焦点](candidate-west-stays-focused-after-refresh.jpg)。
- [另一次真实归档刷新在途时按 Enter 打开原 West](candidate-opens-west-before-refresh-returns.jpg)。只读提示获得焦点。
- [East 在另一请求中恢复后返回原搜索](candidate-restored-east-returns-to-search.jpg)。[待更新的数据读回后，Control 的恢复显示成功](candidate-restore-still-works-after-refresh.jpg)。
- [阶段回执及最终精确身份](candidate-archive-reading-receipts.json)。
