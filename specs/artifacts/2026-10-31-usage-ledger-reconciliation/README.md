# 用量周期真实账本对照

对应[方案](../../records/2026-10/2026-10-31-usage-ledger-reconciliation.md)。2026-10-31，单agent，在独立原生开发服务 `/ui` 使用内置浏览器人工交互并逐图查看，桌面1280×720。冻结当前界面 main-DXSogkYB.js。当前统计和页面通过，产品代码未改；只删除当前架构里残留的五指标等权/双列布局描述，保留已经存在的当前布局合同。

| 周期（Asia/Shanghai） | 当前调用 | 当前Token | 前周期调用/Token | 实际桶数 |
| --- | ---: | ---: | ---: | ---: |
| 今天，10月31日 | 22 | 545,393 | 123 / 6,591,892 | 24 |
| 本周，10月26日–11月1日 | 733 | 36,428,624 | 0 / 0 | 7 |
| 本月，10月1日–31日 | 733 | 36,428,624 | 0 / 0 | 31 |
| 今年，1月1日–12月31日 | 733 | 36,428,624 | 0 / 0 | 365 |

两轮真实GET `/global/usage`，逐字段与原SQLite自然区间的独立SQL查询比较，包含六类Token、调用、请求时估算费用、覆盖、模型/Provider分组、比较及每个半开桶。没有改系统时间或人工写计费事件。733条原账本完整保持。模型为openai/gpt-6.1-sol；本批新增模型请求0，跨批验收累计1118。页面按既有紧凑格式显示36m/18m，精确数值在模型明细及桶提示中可读。账本估算费用合计0不能证明官方账单免费；管理环境变量在依赖初始化前确认均未配置，未读取管理凭据或请求官方账单。

| 实图 | 人工复核 |
| --- | --- |
| [01-year-en.png](01-year-en.png) | 默认年度、主总量与紧凑支持指标、365桶 |
| [02-day-en.png](02-day-en.png) | 当日22次/545k、实际小时桶、前周期-91.7% |
| [03-week-en.png](03-week-en.png) | 周一到周日的本周范围及总计 |
| [04-month-en.png](04-month-en.png) | 本月范围及总计 |
| [05-zero-bucket-en.png](05-zero-bucket-en.png) | 键盘Home查看真实零桶、焦点及GMT+8区间 |
| [06-nonzero-bucket-en.png](06-nonzero-bucket-en.png) | 键盘End查看545,393精确数值；随后Escape、Shift+Tab及Space刷新 |
| [07-details-en.png](07-details-en.png) | 价格覆盖、纵向组合及Provider明细 |
| [08-model-en.png](08-model-en.png) | 模型733次/36,428,624精确总量 |
| [09-official-scope-en.png](09-official-scope-en.png) | 展开官方独立对照、实际未配置范围说明 |
| [10-year-zh.png](10-year-zh.png) | 中文页面及默认年度 |
| [11-day-zh.png](11-day-zh.png) | 中文当日周期、数值及日期 |
| [12-peak-bucket-zh.png](12-peak-bucket-zh.png) | 中文键盘方向键峰值18,234,654与实际GMT+8区间 |

[verification.json](verification.json)保存脱敏验收摘要。原请求和数据库原文只存本地私有目录。92表216,595条原记录所有列保持，新增仅独立服务正常启动的2条activation lease/grant；schema9。75附件、13 Git项目/28 tracked文件、13+39+22+3受保护文件、既有对话/Goal/Sources、两个paused远期定义均保持。服务已公共shutdown200，原exec/native/launcher均0，物理/输出/请求/进程出生身份结清，两份凭据/模型目录配对副本退休，源认证元数据及模型目录字节/元数据不变；结清时距固定deadline49分钟以上。用户18571实例、真实数据库与进程未操作。

这是当前真实账本的只读验收，不宣称全部时区、官方付费账户或并发切换的覆盖。未新增、修改或运行UI自动化测试；真实交互与截图是页面证据，后端对照不替代视觉验收。
