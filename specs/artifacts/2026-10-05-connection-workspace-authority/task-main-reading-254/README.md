# 254 Task 主阅读位置

- [Recall、共享分析与实施方案](../task-main-reading-plan-254.md)。
- [首个实际失败及完整退出](live-01/README.md)。
- [首次新鲜启动审查](../task-main-readiness-254/README.md)。
- [修复后新鲜启动审查](../task-main-readiness-254-after/README.md)。
- [第一次修改后仍失败](after-01/README.md)及[进一步修改的新鲜审查](../task-main-readiness-254-final/README.md)。
- [最终真实页面结果](final-01/README.md)。

253普通Session通过之后，真正已完成Task第一次中段582保持，第二次来源段落978返回到1055.3333740234375。第一次修改后又偏移至882.6666870117188，两次原失败均保留。共享原因包含未退休的索引对齐及挂载期间的消息锚点绝对位置变化；现在通过现keepMounted（保持真实卡片挂载）挂载目标，由原滚动控制器持续计算实际消息偏移并在真正尺寸稳定后退休。第三次实际来源978和四条消息偏移保持，明确末尾1302/true也保持；历史子Sources标题/域名与top0重开保持。全部完整截图亲自查看，类型/build只辅助；原实时Dock、长分页、Mission、运行中等矩阵仍未完成。
