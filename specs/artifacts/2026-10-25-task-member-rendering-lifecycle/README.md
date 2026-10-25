# 原Task成员续跑与渲染生命周期

对应[Recall、分析和实际结果](../../records/2026-10/2026-10-25-task-member-rendering-lifecycle.md)。仅一个编码agent；真实产品B成员只承担该隔离功能验收，不委派编码工作。

- `delivery.json`：原Task/B、真实新用户Message、三份来源与原completed工具事实的绑定、3510字符八节正文与六行数据表。
- `browser-observation.json` / `browser-events.json`：七次被动日志采样的584条安全标量及覆盖边界。最终长文只覆盖379字符之后；并非完整帧捕获或闪烁计数。
- `reading-before.json`、`reading-dispatch.json`、`reading-first-source.json`、`reading-third-source.json`：手工页面操作期间原正文/滚动组件身份、可见字符和已渲染块采样。
- `reading-after-shutdown.json`：公开关闭后保留页面的身份与内容，只作收敛后补充，不称在线验收。
- `live-events-summary.json`：真实GlobalBus事件覆盖；delta长度是单次增量，不能当累计文本长度。
- `preservation.json` / `build-preservation.json`：源92表214319原行逐字段保持、目标七个自然变化、schema8不变及Node构建前后DB大小/mtime。
- `runtime-closure.json` / `retirement.json`：原exec/native/launcher退出0、物理/输出/请求完成、15次精确Sol流全部reader settled、14次EOF及唯一shutdown窗口内memory取消、成对副本退休。全流自然EOF指标未达成。

三张截图已由主agent实际呈现并人工查看：

1. `baseline.png`：原Task/B历史来源和正文基线。
2. `first-source-live.png`：本轮首份真实来源与新增可见说明。
3. `source-excerpt-final.png`：本轮Task完成后展开真实Tabs摘录，保留工具、标题/域名及成员上下文。

这是含既有未提交message.moved修复的当前工作区构建；不能代替纯净已提交版本的验收。原用户后来报告的高频Rendering未复现、根因未定；不据本样本宣布修复完成。没有UI自动化测试、合成消息或用户进程操作，18571保持原样。
