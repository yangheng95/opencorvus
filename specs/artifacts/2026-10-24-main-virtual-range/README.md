# Main虚拟窗口与尺寸测量

584单agent；见[方案与根因](../../records/2026-10/2026-10-24-main-virtual-range.md)和[原始身份/几何/闭合元数据](evidence.json)。

主对话跟随期间后缓冲随滚动/停顿切换引发旧正文回收，现由同一tracking信号选取buffer。基线加载完成后的跟随退休观察39次，修复后1次（旧正文正常离开视口）；主动阅读/缩放仍可按窗口正常回收，不声称完全不重建。两个scope共8次真实Sol流式200/原reader EOF、退出0，源库全部原行字段时间保持；凭据目录已清退。

人工页面交互、截图及被动元数据，无UI自动化断言。两次模型自然输出长度不同，不拿总高度当相等验收。原非虚拟成员Rendering高频回收尚未复现；本修复不冒称解决该独立问题。

## 01-real-request.png

基线：原Session相同请求草稿。

![基线：原Session相同请求草稿。](01-real-request.png)

## 02-live-follow.png

基线：真实未完成输出及跟随。

![基线：真实未完成输出及跟随。](02-live-follow.png)

## 03-live-reading.png

基线：上滚时已完成，不能称流中阅读。

![基线：上滚时已完成，不能称流中阅读。](03-live-reading.png)

## 04-source-reading.png

基线：回读原user与预告附近。

![基线：回读原user与预告附近。](04-source-reading.png)

## 05-source-copied.png

基线：原L2实际复制反馈。

![基线：原L2实际复制反馈。](05-source-copied.png)

## 06-final-guide.png

基线：完整最终表格与结束标记。

![基线：完整最终表格与结束标记。](06-final-guide.png)

## 07-after-request.png

修复后：相同请求草稿及原历史。

![修复后：相同请求草稿及原历史。](07-after-request.png)

## 08-after-live-follow.png

修复后：真实流中预告、read和L2来源。

![修复后：真实流中预告、read和L2来源。](08-after-live-follow.png)

## 09-after-live-reading.png

修复后：真实流中上滚，L2/L3和正文可读。

![修复后：真实流中上滚，L2/L3和正文可读。](09-after-live-reading.png)

## 10-after-live-source-copy.png

修复后：流中复制，AX已确认Copied及实际剪贴板，截图时图标已回普通状态。

![修复后：流中复制，AX已确认Copied及实际剪贴板，截图时图标已回普通状态。](10-after-live-source-copy.png)

## 11-after-resumed-follow.png

修复后：真实流中回到底部，正文继续增长。

![修复后：真实流中回到底部，正文继续增长。](11-after-resumed-follow.png)

## 12-after-completed.png

修复后：最终四行表、完整结束标记和Not running。

![修复后：最终四行表、完整结束标记和Not running。](12-after-completed.png)

## 13-after-history-reading.png

修复后：完成后回读Sources和正文。

![修复后：完成后回读Sources和正文。](13-after-history-reading.png)

## 14-after-zoom160.png

修复后：160%菜单仍覆盖页面，只证明设置过程。

![修复后：160%菜单仍覆盖页面，只证明设置过程。](14-after-zoom160.png)

## 15-after-zoom160-reading.png

修复后：菜单仍覆盖页面，不作无遮挡阅读验收。

![修复后：菜单仍覆盖页面，不作无遮挡阅读验收。](15-after-zoom160-reading.png)

## 16-after-zoom160-uncovered.png

修复后：菜单关闭后的160%来源阅读。

![修复后：菜单关闭后的160%来源阅读。](16-after-zoom160-uncovered.png)

## 17-after-restored100.png

修复后：恢复100%并保留来源附近阅读。

![修复后：恢复100%并保留来源附近阅读。](17-after-restored100.png)

## 18-after-source-confirmation.png

修复后：L2实际绿色复制反馈。

![修复后：L2实际绿色复制反馈。](18-after-source-confirmation.png)

## 19-after-task-reading.png

修复后：切Task期间尚在加载，非最终空正文结论。

![修复后：切Task期间尚在加载，非最终空正文结论。](19-after-task-reading.png)

## 20-after-task-history.png

修复后：Task加载完成，主动阅读原成员进度与历史。

![修复后：Task加载完成，主动阅读原成员进度与历史。](20-after-task-history.png)

## 21-after-member-dock.png

修复后：原B成员X86d完整最终正文和主对话共同可读。

![修复后：原B成员X86d完整最终正文和主对话共同可读。](21-after-member-dock.png)
