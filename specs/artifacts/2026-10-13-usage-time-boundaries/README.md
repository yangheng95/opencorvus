# 用量时间边界与连续键盘操作验收

[Recall、根因、全调用影响与方案](../../records/2026-10/2026-10-13-usage-time-boundaries.md)。本批同时修复唯一自然时间边界及分桶数据流、Usage工具栏卸载导致的真实焦点丢失。没有真实凭据或模型请求。

## 桌面页面交互与人工视觉复核

1280×720 Windows桌面真实源码服务`/ui`，独有私有前端构建、空实际账本，中英文深色。全部截图实际呈现并由主agent人工查看；没有UI自动化测试、组件/DOM断言或像素断言。

| 场景 | 真实结果与证据 |
| --- | --- |
| 修复前年→月 | 点击年、Left、Space后月份更新，但周期组选项重建，焦点落到页面；再Left/Space无法继续。见[基线截图](period-before.png)。 |
| 修复前刷新 | 组选项再次重建、焦点落到页面。见[基线截图](refresh-before.png)。 |
| 修复后英文连续年→月→周 | 相同键盘操作后月份、周范围和选中项正确，group-cl-228保持，焦点依次留在month/week。见[月状态](period-month-after.txt)、[周状态](period-week-after.txt)、[截图](period-en-after.png)。 |
| 修复后英文刷新再切今天 | 刷新完成焦点仍在按钮，Shift+Tab、Left、Space可直接切今天。见[刷新焦点](refresh-after.txt)、[截图](refresh-after.png)。 |
| 修复后中文年→月→周与刷新 | 焦点留在本周，日期与正文为中文；刷新后焦点留在刷新按钮。见[周期状态](period-zh-after.txt)、[刷新状态](refresh-zh-after.txt)、[截图](period-zh-after.png)。 |
| 中文下半页 | 洞察、Provider真实空状态、价格覆盖和官方对账入口的顺序、间距与文字正常。见[截图](details-zh-after.png)。 |

本次真实请求较快，没有单独捕获加载帧或故意制造错误；加载/错误仅有代码复核，不能冒充这些状态的视觉验收。未扩展移动端、浅色或其他主题。本批视觉结果覆盖控件生命周期、现有空统计和整体桌面布局；人工统计事件未注入此视觉页面。

## 正向功能验证

- [初始基线](tests-before.log)：20项统计测试，13通过、7失败；有记录的Lord Howe/Santiago场景证明漏桶与错误窗口。
- [中间修复](tests-intermediate.log)：统计与账本22项通过，尚不覆盖午夜回拨。
- [独立复核后的重复午夜基线](tests-midnight-before.log)：30项统计测试，24通过、6失败；Havana第二午夜和中午观察、下一周期previous窗口暴露同一边界双义性。
- [最终](tests-after.log)：30项usage-stats及2项stream-ledger共32测试、242断言全部通过，实际runner退出0。包含全Token分量/成本/次数合计、精确半开边界、前一周期、上海/纽约/闰年、半小时前进/回拨、午夜前移/回拨与无序原记录保留。stream-ledger的上游为测试流，不能称为真实Provider验收。

最终命令：Bun1.4.0运行`packages/opencorvus/script/run-tests.ts test/usage/usage-stats.test.ts test/usage/stream-ledger.test.ts`。统计既有Server.App().request测试是实际handler合同，不是独立socket。

另行真实功能链：生产UsageLedger.record→隔离数据库→生产listener/recovery→真实18574 HTTP路由。明确[人工统计输入](http-ledger-input.json)为2026-09三个事件，非实际Provider调用或账单。执行[有界checker](http-checker.mjs)查询当前2026年Santiago统计，实际200、3次/600Token/$0.006，三个自然日桶均准确，桶链与终点一致，见[回执](http-receipt.json)和[输出](http-checker.log)。此checker仅为2026-10-13一次验收产物，不是跨年CI测试。

[后端类型](backend-types-final.log)、[Overlay类型](overlay-types.log)、[两语言2156键检查](i18n.log)、[私有正式构建](build-summary.log)、[文档checker](docs-final.log)通过。三产品/测试文件格式及范围git diff --check通过。无无目标全量测试。

## 自有服务收尾与范围

基线[启动](before-ready.json)→[终态](before-terminal.json)，原exec66900返回0；后态[启动](after-ready.json)→[终态](after-terminal.json)，原exec65376返回0；HTTP[启动](http-after-ready.json)→[终态](http-after-terminal.json)，原exec61781返回0。先关闭自有页面，再向各自scope写stop标记，由生产runtime停止与释放。随后[物理进程与端口复核](physical-closure.json)三个原PID已退出、18573/18574没有listener；未操作其他用户进程或页面。

没有改版本、发布、tag、Release或外部统计管理凭据。本批无需GPT-6.1 Sol验收；官方partial金额显示为独立未验收候选，不纳入已完成结论。
