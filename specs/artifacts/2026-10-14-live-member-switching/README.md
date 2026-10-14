# 流中双成员切换证据

对应[方案与共享审计](../../records/2026-10/2026-10-14-live-member-switching.md)。本批是**并发失败基线**，尚未修改产品或宣称修复。真实Task tsk_g00VY0Dhzi00R4lvcuZT明示同时启动，实际第二位在第一位完成后13.417秒才开始；Root续跑两次仍未重叠，随后通过产品Stop取消自有Task。

- [实际事实检查](persisted-check.json)：精确两位Session/4次lineage、独立来源、5个真实生成窗口、取消事件与UnknownError；保留416全部13条消息及Part/工具/artifact原内容。
- [执行汇总](execution-summary.json)：19次真实Sol流式200，18 EOF、1主动取消aborted；17项后端契约/34断言通过；Native原handle join exit0、物理收尾及复制配对退休。测试通过不代表真实并发通过。
- [第一位生成中](02-first-live-source.jpg)、[流中来源第2行](03-live-source-line2.jpg)、[停留位置](04-price-live-reading.jpg)、[新成员加入后](05-first-position-after-growth.jpg)。
- [第二位运行状态](06-second-running-list.jpg)、[第二位生成中](07-delivery-live.jpg)、[暂停阅读](08-delivery-paused.jpg)、[完成后返回](10-delivery-restored-after-completion.jpg)、[来源第3行](11-delivery-source-line3.jpg)。
- [正常Stop后的内部错误](14-cancellation-error-detail.jpg)：Task已Cancelled，root正文出现activation fence普通错误，待完整类型链修复。
- 14张原图均人工查看。09文件名/原采集备注不能证明peer仍在生成，实际已经完成；facts/observations.jsonl.gz含原始时间与追加更正。
- live/包含配对预检、真实请求审计/工具声明、Task取消失败记录、Native及shutdown/清理；facts/是只读生产SQLite；execution/是checker、两类生产manifest路径、原构建/测试日志；previous-416/保留上批已完成推送证据。

共享影响：120个生产包只授予单成员入口，2个包使用集合入口。正式修复需继续覆盖所有授予/authoring/安装、Task/Mission/Session轮次与取消终态、多项目及重启，不将Base或一条UI路径单独通过当作总完成。
